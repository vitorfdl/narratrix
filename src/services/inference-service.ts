import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useCurrentChatActiveChapterID, useCurrentChatId } from "@/hooks/chatStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useInference } from "@/hooks/useInference";
import type { ModelSpecs } from "@/schema/inference-engine-schema";
import { chatEventBus } from "./chat-event-bus";
import { formatFinalText } from "./inference/formatter/format-response";
import { removeNestedFields } from "./inference/formatter/remove-nested-fields";
import { useMessageManager } from "./inference/message-manager";
import { usePromptFormatter } from "./inference/prompt-formatter";
import { processStreamChunk } from "./inference/stream-processor";
import { useStreamingStateManager } from "./inference/streaming-state-manager";
import type { GenerationOptions } from "./inference/types";
import { batchedStreamingUpdate, playBeepSound } from "./inference/utils";

/**
 * Main inference service hook that orchestrates all inference functionality.
 * Supports multiple concurrent inference sessions across different chats.
 */
export function useInferenceService() {
  const currentProfile = useCurrentProfile();
  const currentChatId = useCurrentChatId();
  const currentChapterID = useCurrentChatActiveChapterID();

  if (!currentProfile) {
    throw new Error("Current profile not found");
  }

  const streamingManager = useStreamingStateManager();
  const messageManager = useMessageManager();
  const promptFormatter = usePromptFormatter();

  // Per-request message snapshot: preserves the messages array at generation start
  // so streaming updates can correctly rebuild the array for any chat (not just the selected one).
  const messageSnapshotsRef = useRef<Map<string, string[]>>(new Map());

  const { runInference, cancelRequest } = useInference({
    onStream: (response, requestId) => {
      const session = streamingManager.getSessionByRequest(requestId);
      if (!session) {
        return;
      }

      // Accumulate explicit reasoning directly on the session reference
      // (processStreamChunk also mutates chunkBuffer/isThinking on this reference)
      session.accumulatedReasoning += response.result.reasoning || "";

      const currentChunk = response.result.text || response.result.full_response || "";
      const { textToAdd, reasoningToAdd } = processStreamChunk(currentChunk, session, session.formatTemplate);

      streamingManager.batchUpdateSessionByRequest(requestId, (s) => ({
        accumulatedText: s.accumulatedText + textToAdd,
        accumulatedReasoning: s.accumulatedReasoning + reasoningToAdd,
      }));

      const updated = streamingManager.getSessionByRequest(requestId);
      if (updated?.characterId && updated?.messageId) {
        const snapshot = messageSnapshotsRef.current.get(requestId);
        batchedStreamingUpdate(() => {
          messageManager.updateMessageDirect(updated.chatId!, updated.messageId!, updated.accumulatedText, updated.messageIndex || 0, snapshot);
        });
      }
    },

    onComplete: (response, requestId) => {
      const session = streamingManager.getSessionByRequest(requestId);
      if (!session) {
        return;
      }

      if (session.characterId && session.messageId) {
        const rawText = response.result?.full_response || response.result?.text || session.accumulatedText;
        const { text: finalText, reasoning: finalReasoning } = formatFinalText(rawText, session.formatTemplate);

        streamingManager.batchUpdateSessionByRequest(requestId, () => ({
          accumulatedReasoning: finalReasoning || "",
        }));

        const snapshot = messageSnapshotsRef.current.get(requestId);
        messageManager.updateMessageDirect(session.chatId!, session.messageId, finalText, session.messageIndex || 0, snapshot);

        streamingManager.resetSessionByRequest(requestId);
        messageSnapshotsRef.current.delete(requestId);
        playBeepSound(currentProfile.settings.chat.beepSound);

        // Emit after_participant_message event so agent triggers can react.
        // The emitChatEvents flag is stored on the session so the onComplete handler can read it.
        if (session.chatId && session.characterId !== "generate-input-area" && session.emitChatEvents !== false) {
          chatEventBus.emit({
            type: "after_participant_message",
            chatId: session.chatId,
            message: finalText,
            participantId: session.characterId,
          });
        }
      }
    },

    onError: (error: unknown, requestId) => {
      const session = streamingManager.getSessionByRequest(requestId);
      if (!session) {
        return;
      }

      const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : "Unknown error";

      toast.error("Inference error:", {
        description: message,
      });
      console.error("Inference error:", error);

      streamingManager.resetSessionByRequest(requestId);
      messageSnapshotsRef.current.delete(requestId);
    },
  });

  const generateMessage = useCallback(
    async (options: GenerationOptions): Promise<string | null> => {
      const {
        chatId: optionsChatId,
        chapterId: optionsChapterId,
        chatTemplateID,
        characterId,
        userMessage,
        quietUserMessage = false,
        quietResponse = false,
        systemPromptOverride = "",
        parametersOverride,
        stream = true,
        existingMessageId = null,
        messageIndex = 0,
        onStreamingStateChange,
        extraSuggestions = {},
        messageHistoryOverride,
        emitChatEvents = true,
      } = options;

      const chatId = optionsChatId ?? currentChatId;
      const chapterId = optionsChapterId ?? currentChapterID;

      if (streamingManager.isStreaming(chatId)) {
        toast.warning("This chat is already generating a message.");
        return null;
      }

      const localRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      try {
        streamingManager.createSession(chatId, localRequestId);
        streamingManager.updateSessionByRequest(localRequestId, {
          characterId,
          messageId: existingMessageId,
          messageIndex,
          emitChatEvents,
        });

        if (onStreamingStateChange) {
          onStreamingStateChange(streamingManager.getSessionByRequest(localRequestId)!);
        }

        const freshMessages = messageHistoryOverride || (await promptFormatter.fetchChatMessages(chatId, chapterId));

        const promptResult = await promptFormatter.formatPrompt(userMessage, characterId, systemPromptOverride, chatTemplateID, freshMessages, extraSuggestions, existingMessageId || undefined);

        if (!promptResult) {
          throw new Error("Failed to format prompt");
        }

        const { inferenceMessages, systemPrompt, manifestSettings, modelSettings, chatTemplate, formatTemplate, isChat, customStopStrings } = promptResult;

        if (!modelSettings || !manifestSettings) {
          throw new Error("Model or manifest settings not available. Check chat template configuration.");
        }

        streamingManager.updateSessionByRequest(localRequestId, { formatTemplate });

        let messageId: string;

        if (userMessage && !quietUserMessage) {
          await messageManager.createUserMessage(userMessage);
          // Emit after_user_message so agents can react to the user's input
          if (emitChatEvents) {
            chatEventBus.emit({
              type: "after_user_message",
              chatId,
              message: userMessage,
              participantId: "user",
            });
          }
        }

        // Emit before_participant_message before inference starts
        if (emitChatEvents) {
          chatEventBus.emit({
            type: "before_participant_message",
            chatId,
            participantId: characterId,
          });
        }

        if (existingMessageId) {
          messageId = existingMessageId;
          await messageManager.setMessageLoading(messageId, messageIndex);

          // Capture snapshot of existing message versions for safe background updates
          const existing = messageManager.getMessageById(messageId);
          if (existing) {
            messageSnapshotsRef.current.set(localRequestId, [...existing.messages]);
          }
        } else if (!quietResponse) {
          const newMessage = await messageManager.createCharacterMessage(characterId);
          messageId = newMessage.id;
          messageSnapshotsRef.current.set(localRequestId, [...newMessage.messages]);
        } else {
          messageId = "generate-input-area";
        }

        streamingManager.updateSessionByRequest(localRequestId, {
          messageId,
          messageIndex,
        });

        const modelSpecs: ModelSpecs = {
          id: modelSettings.id,
          model_type: isChat ? "chat" : "completion",
          config: modelSettings.config || {},
          max_concurrent_requests: modelSettings.max_concurrency || 1,
          engine: manifestSettings.engine,
        };

        const parameters = removeNestedFields(parametersOverride || chatTemplate?.config || {});
        if (customStopStrings) {
          parameters.stop = parameters.stop ? [...parameters.stop, ...customStopStrings] : customStopStrings;
        }

        const confirmID = await runInference({
          messages: inferenceMessages,
          modelSpecs,
          systemPrompt,
          parameters,
          stream,
          requestId: localRequestId,
        });

        if (!confirmID) {
          streamingManager.resetSessionByRequest(localRequestId);
          messageSnapshotsRef.current.delete(localRequestId);
          return null;
        }

        if (onStreamingStateChange) {
          onStreamingStateChange(streamingManager.getSessionByRequest(localRequestId)!);
        }

        const session = streamingManager.getSessionByRequest(localRequestId);
        if (session?.messageId) {
          const snapshot = messageSnapshotsRef.current.get(localRequestId);
          messageManager.updateMessageDirect(chatId, session.messageId, session.accumulatedText ?? "...", messageIndex, snapshot);
        }

        return confirmID;
      } catch (error) {
        console.error("Error generating message:", error);

        streamingManager.resetSessionByRequest(localRequestId);
        messageSnapshotsRef.current.delete(localRequestId);

        if (onStreamingStateChange) {
          onStreamingStateChange(null);
        }

        throw error;
      }
    },
    [streamingManager, messageManager, promptFormatter, currentChatId, currentChapterID, runInference],
  );

  const regenerateMessage = useCallback(
    async (messageId: string, options: Partial<Omit<GenerationOptions, "existingMessageId">> = {}): Promise<string | null> => {
      const chatId = options.chatId ?? currentChatId;

      // Cancel any ongoing request for THIS chat only
      if (streamingManager.isStreaming(chatId)) {
        const session = streamingManager.getSessionByChatId(chatId);
        if (session?.requestId) {
          await cancelRequest(session.requestId);
          streamingManager.resetSession(chatId);
        }
      }

      if (!options.characterId) {
        console.error("Character ID is required for regeneration");
        return null;
      }

      return generateMessage({
        chatId,
        characterId: options.characterId,
        userMessage: options.userMessage,
        systemPromptOverride: options.systemPromptOverride,
        parametersOverride: options.parametersOverride,
        stream: options.stream !== undefined ? options.stream : true,
        existingMessageId: messageId,
        messageIndex: options.messageIndex !== undefined ? options.messageIndex : 0,
        onStreamingStateChange: options.onStreamingStateChange,
      });
    },
    [cancelRequest, generateMessage, streamingManager, currentChatId],
  );

  const cancelGeneration = useCallback(
    async (chatId?: string): Promise<boolean> => {
      const targetChatId = chatId ?? currentChatId;
      const session = streamingManager.getSessionByChatId(targetChatId);

      if (!session?.requestId) {
        return false;
      }

      try {
        const success = await cancelRequest(session.requestId);

        if (success) {
          messageSnapshotsRef.current.delete(session.requestId);
          streamingManager.resetSession(targetChatId);
        }

        return success ?? false;
      } catch (error) {
        console.error("Error canceling generation:", error);
        return false;
      }
    },
    [cancelRequest, streamingManager, currentChatId],
  );

  return {
    generateMessage,
    regenerateMessage,
    cancelGeneration,
    getStreamingState: streamingManager.getStreamingState,
    subscribeToStateChanges: streamingManager.subscribeToStateChanges,
    isStreaming: streamingManager.isStreaming,
  };
}

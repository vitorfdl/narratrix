import { useCallback } from "react";
import { toast } from "sonner";
import { useCurrentChatActiveChapterID, useCurrentChatId } from "@/hooks/chatStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useInference } from "@/hooks/useInference";
import { ModelSpecs } from "@/schema/inference-engine-schema";
import { formatFinalText } from "./inference/formatter/format-response";
import { removeNestedFields } from "./inference/formatter/remove-nested-fields";

import { useMessageManager } from "./inference/message-manager";
import { usePromptFormatter } from "./inference/prompt-formatter";
import { processStreamChunk } from "./inference/stream-processor";
// Import separated modules
import { useStreamingStateManager } from "./inference/streaming-state-manager";
import { GenerationOptions } from "./inference/types";
import { batchedStreamingUpdate, playBeepSound } from "./inference/utils";

/**
 * Main inference service hook that orchestrates all inference functionality
 */
export function useInferenceService() {
  const currentProfile = useCurrentProfile();
  const currentChatId = useCurrentChatId();
  const currentChapterID = useCurrentChatActiveChapterID();

  if (!currentProfile) {
    throw new Error("Current profile not found");
  }

  // Initialize separated modules
  const streamingManager = useStreamingStateManager();
  const messageManager = useMessageManager();
  const promptFormatter = usePromptFormatter();

  // Set up inference with callbacks
  const { runInference, cancelRequest } = useInference({
    onStream: (response, requestId) => {
      if (requestId !== streamingManager.streamingState.current.requestId) {
        return;
      }

      // Process explicit reasoning if provided
      streamingManager.streamingState.current.accumulatedReasoning += response.result.reasoning || "";

      const currentChunk = response.result.text || response.result.full_response || "";

      // Process chunk with buffer
      const { textToAdd, reasoningToAdd } = processStreamChunk(currentChunk, streamingManager.streamingState.current, streamingManager.streamingState.current.formatTemplate);

      // Batch update streaming state for better performance
      streamingManager.batchUpdateStreamingState((currentState) => ({
        accumulatedText: currentState.accumulatedText + textToAdd,
        accumulatedReasoning: currentState.accumulatedReasoning + reasoningToAdd,
      }));

      // Use batched updates for UI performance during high-frequency streaming
      if (streamingManager.streamingState.current.characterId && streamingManager.streamingState.current.messageId) {
        batchedStreamingUpdate(() => {
          messageManager.updateMessageById(
            streamingManager.streamingState.current.messageId!,
            streamingManager.streamingState.current.accumulatedText,
            streamingManager.streamingState.current.messageIndex || 0,
          );
        });
      }
    },
    onComplete: (response, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingManager.streamingState.current.requestId) {
        return;
      }

      if (streamingManager.streamingState.current.characterId && streamingManager.streamingState.current.messageId) {
        const rawText = response.result?.full_response || response.result?.text || streamingManager.streamingState.current.accumulatedText;
        const { text: finalText, reasoning: finalReasoning } = formatFinalText(rawText, streamingManager.streamingState.current.formatTemplate);

        // Final update with optimized batch operation
        streamingManager.batchUpdateStreamingState(() => ({
          accumulatedReasoning: finalReasoning || "",
        }));

        // Final update to the message
        messageManager.updateMessageById(streamingManager.streamingState.current.messageId, finalText, streamingManager.streamingState.current.messageIndex || 0);

        // Reset streaming state (this will notify subscribers)
        streamingManager.resetStreamingState();
        playBeepSound(currentProfile.settings.chat.beepSound);
      }
    },
    onError: (error: any, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingManager.streamingState.current.requestId) {
        return;
      }

      toast.error("Inference error:", {
        description: error.message || error.details || JSON.stringify(error || "Unknown error"),
      });
      console.error("Inference error:", error);

      // Reset streaming state (this will notify subscribers)
      streamingManager.resetStreamingState();
    },
  });

  /**
   * Generate a new message
   */
  const generateMessage = useCallback(
    async (options: GenerationOptions): Promise<string | null> => {
      const {
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
      } = options;

      try {
        // Reset any previous streaming state
        streamingManager.resetStreamingState();

        // Batch initial state updates
        streamingManager.batchUpdateStreamingState(() => ({
          characterId,
          messageId: existingMessageId,
          messageIndex,
        }));

        // Notify about streaming state change if callback provided
        if (onStreamingStateChange) {
          onStreamingStateChange(streamingManager.streamingState.current);
        }

        const freshMessages = messageHistoryOverride || (await promptFormatter.fetchChatMessages(currentChatId, currentChapterID));

        // Prepare messages for inference
        const promptResult = await promptFormatter.formatPrompt(userMessage, characterId, systemPromptOverride, chatTemplateID, freshMessages, extraSuggestions, existingMessageId || undefined);

        if (!promptResult) {
          throw new Error("Failed to format prompt");
        }

        const { inferenceMessages, systemPrompt, manifestSettings, modelSettings, chatTemplate, formatTemplate, isChat, customStopStrings } = promptResult;

        if (!modelSettings || !manifestSettings) {
          console.error("Model or manifest settings not available. Check chat template configuration.");
          throw new Error("Model or manifest settings not available. Check chat template configuration.");
        }

        // Store the format template in the streaming state for use during streaming
        streamingManager.updateStreamingState({ formatTemplate });

        // Create or use existing message
        let messageId: string;

        if (userMessage && !quietUserMessage) {
          // Add user message if not quiet
          await messageManager.createUserMessage(userMessage);
        }

        if (existingMessageId) {
          // Use existing message
          messageId = existingMessageId;
          await messageManager.setMessageLoading(messageId, messageIndex);
        } else if (!quietResponse) {
          // Create a placeholder message for the character
          const newMessage = await messageManager.createCharacterMessage(characterId);
          messageId = newMessage.id;
        } else {
          messageId = "generate-input-area";
        }

        // Batch update streaming state with message info
        streamingManager.batchUpdateStreamingState(() => ({
          messageId,
          messageIndex,
        }));

        // Create ModelSpecs using the model and manifest settings
        const modelSpecs: ModelSpecs = {
          id: modelSettings.id,
          model_type: isChat ? "chat" : "completion",
          config: modelSettings.config || {},
          max_concurrent_requests: modelSettings.max_concurrency || 1,
          engine: manifestSettings.engine,
        };

        const localRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Set request ID to streaming state BEFORE making the backend call
        streamingManager.updateStreamingState({ requestId: localRequestId });

        // Setup Parameters with Custom Stop Strings
        const parameters = removeNestedFields(parametersOverride || chatTemplate?.config || {});
        if (customStopStrings) {
          parameters.stop = parameters.stop ? [...parameters.stop, ...customStopStrings] : customStopStrings;
        }

        // Start the inference process
        const confirmID = await runInference({
          messages: inferenceMessages,
          modelSpecs,
          systemPrompt: systemPrompt,
          parameters,
          stream,
          requestId: localRequestId,
        });

        if (!confirmID || !streamingManager.streamingState.current.requestId) {
          streamingManager.resetStreamingState();
          return null;
        }

        if (onStreamingStateChange) {
          onStreamingStateChange(streamingManager.streamingState.current);
        }

        messageManager.updateMessageById(streamingManager.streamingState.current.messageId!, streamingManager.streamingState.current.accumulatedText ?? "...", messageIndex);

        return confirmID;
      } catch (error) {
        console.error("Error generating message:", error);

        // Reset streaming state (this will notify subscribers)
        streamingManager.resetStreamingState();

        // Notify about streaming state change if callback provided
        if (onStreamingStateChange) {
          onStreamingStateChange(null);
        }

        throw error;
      }
    },
    [streamingManager, messageManager, promptFormatter, currentChatId, currentChapterID, runInference],
  );

  /**
   * Regenerate a specific message
   */
  const regenerateMessage = useCallback(
    async (messageId: string, options: Partial<Omit<GenerationOptions, "existingMessageId">> = {}): Promise<string | null> => {
      // Cancel any ongoing requests
      if (streamingManager.isStreaming()) {
        await cancelRequest(streamingManager.streamingState.current.requestId!);
      }

      // Ensure character ID is provided
      if (!options.characterId) {
        console.error("Character ID is required for regeneration");
        return null;
      }

      // Call generateMessage with the existing message ID
      return generateMessage({
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
    [cancelRequest, generateMessage, streamingManager],
  );

  /**
   * Cancel ongoing generation
   */
  const cancelGeneration = useCallback(async (): Promise<boolean> => {
    if (!streamingManager.isStreaming()) {
      return false;
    }

    try {
      const success = await cancelRequest(streamingManager.streamingState.current.requestId!);

      if (success) {
        streamingManager.resetStreamingState(); // This will notify subscribers
      }

      return success ?? false;
    } catch (error) {
      console.error("Error canceling generation:", error);
      return false;
    }
  }, [cancelRequest, streamingManager]);

  // Return the public API
  return {
    generateMessage,
    regenerateMessage,
    cancelGeneration,
    getStreamingState: streamingManager.getStreamingState,
    resetStreamingState: streamingManager.resetStreamingState,
    subscribeToStateChanges: streamingManager.subscribeToStateChanges,
    isStreaming: streamingManager.isStreaming,
  };
}

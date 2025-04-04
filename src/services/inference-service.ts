import { useProfile } from "@/hooks/ProfileContext";
import { useCharacters } from "@/hooks/characterStore";
import { useChatActions, useCurrentChatId, useCurrentChatMessages, useCurrentChatTemplateID, useCurrentChatUserCharacterID } from "@/hooks/chatStore";
import { useChatTemplate } from "@/hooks/chatTemplateStore";
import { useModelManifestById } from "@/hooks/manifestStore";
import { useModelById } from "@/hooks/modelsStore";
import { useFormatTemplate, useInferenceTemplate, usePromptTemplate } from "@/hooks/templateStore";
import { useInference } from "@/hooks/useInference";
import { Character } from "@/schema/characters-schema";
import { ChatMessageType } from "@/schema/chat-message-schema";
import { InferenceMessage, ModelSpecs } from "@/schema/inference-engine-schema";
import { formatPrompt as formatPromptUtil } from "@/services/inference-steps/prompt-formatter";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

/**
 * StreamingState interface for tracking the streaming state of a message
 */
export interface StreamingState {
  messageId: string | null;
  requestId: string | null;
  accumulatedText: string;
  characterId: string | null;
  messageIndex?: number;
}

/**
 * Simplified options interface that requires less parameters
 */
export interface GenerationOptions {
  characterId: string; // Participant ID
  userMessage?: string;
  systemPromptOverride?: string; // Override System Prompt
  parametersOverride?: Record<string, any>; // Override Parameters
  stream?: boolean; // Stream the response
  existingMessageId?: string; // Existing Message ID
  messageIndex?: number; // Message Index
  onStreamingStateChange?: (state: StreamingState | null) => void; // Callback for streaming state changes
}

/**
 * UseInferenceService hook for centralizing inference functionality
 */
export function useInferenceService() {
  // Create a ref to track streaming state
  const streamingState = useRef<StreamingState>({
    messageId: null,
    requestId: null,
    accumulatedText: "",
    characterId: null,
    messageIndex: 0,
  });
  const { currentProfile } = useProfile();

  // Get chat store information directly
  const currentChatId = useCurrentChatId();
  const chatTemplateId = useCurrentChatTemplateID();
  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const chatMessages = useCurrentChatMessages();
  const { addChatMessage, updateChatMessage } = useChatActions();

  // Get model and template information directly
  const chatTemplate = useChatTemplate(chatTemplateId || "");
  const modelSettings = useModelById(chatTemplate?.model_id || "");
  const manifestSettings = useModelManifestById(modelSettings?.manifest_id || "");

  const formatTemplate = useFormatTemplate(modelSettings?.format_template_id || "");
  const systemPromptTemplate = usePromptTemplate(formatTemplate?.prompt_template_id || "");
  const inferenceTemplate = useInferenceTemplate(formatTemplate?.inference_template_id || "");

  const characterList = useCharacters();

  const userCharacter = characterList.find((character) => character.id === currentChatUserCharacterID);
  const userCharacterOrProfileName = userCharacter?.name || currentProfile?.name;

  // Set up inference with callbacks
  const { runInference, cancelRequest } = useInference({
    onStream: (response, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      if (streamingState.current.characterId && streamingState.current.messageId && response.result?.text) {
        // Append the new text to our accumulated text
        streamingState.current.accumulatedText += response.result.text;

        // Update the message with the accumulated text
        updateMessageByID(streamingState.current.messageId, streamingState.current.accumulatedText, streamingState.current.messageIndex || 0);
      }
    },
    onComplete: (response, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      if (streamingState.current.characterId && streamingState.current.messageId) {
        // Determine the final text, prioritizing the most complete response
        const finalText = response.result?.full_response || response.result?.text || streamingState.current.accumulatedText;

        // Final update to the message
        updateMessageByID(streamingState.current.messageId, finalText, streamingState.current.messageIndex || 0);

        // Reset streaming state
        resetStreamingState();
      }
    },
    onError: (error: unknown, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      toast.error("Inference error:", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      console.error("Inference error:", error);

      // Reset streaming state
      resetStreamingState();
    },
  });

  /**
   * Updates a character message with new text
   */
  const updateMessageByID = async (messageId: string, messageText: string, messageIndex = 0) => {
    try {
      // Get the existing message
      const existingMessage = chatMessages?.find((msg) => msg.id === messageId);

      // Create a new messages array, preserving existing messages if any
      const updatedMessages = existingMessage?.messages ? [...existingMessage.messages] : [];

      // Update or create the message at the specified index
      if (updatedMessages.length <= messageIndex) {
        // Pad the array with empty strings if the index is beyond the current length
        while (updatedMessages.length < messageIndex) {
          updatedMessages.push("");
        }
        // Add the new message at the end
        updatedMessages.push(messageText);
      } else {
        // Update the existing message at the specified index
        updatedMessages[messageIndex] = messageText;
      }

      // Update the message with the new messages array
      await updateChatMessage(messageId, {
        messages: updatedMessages,
        message_index: messageIndex,
      });
    } catch (err) {
      console.error("Failed to update character message:", err);
    }
  };

  /**
   * Resets the streaming state
   */
  const resetStreamingState = useCallback(() => {
    const previousState = { ...streamingState.current };

    // Reset the streaming state
    streamingState.current = {
      messageId: null,
      requestId: null,
      accumulatedText: "",
      characterId: null,
      messageIndex: 0,
    };

    return previousState;
  }, []);

  /**
   * Format prompts for the inference engine
   */
  const formatPrompt = useCallback(
    (userMessage?: string): { inferenceMessages: InferenceMessage[]; systemPrompt?: string } => {
      const chatWithNames = chatMessages
        ?.map((msg) => {
          return {
            ...msg,
            character_name: msg.character_id ? characterList.find((character) => character.id === msg.character_id)?.name : undefined,
          };
        })
        ?.filter((msg) => streamingState.current.messageId !== msg.id);

      return formatPromptUtil({
        messages: chatWithNames || [],
        userMessage,
        modelSettings,
        formatTemplate,
        systemPromptTemplate,
        inferenceTemplate,
        chatTemplate: {
          custom_prompts: chatTemplate?.custom_prompts,
          config: chatTemplate?.config,
        },
        chatConfig: {
          character: characterList.find((character) => character.id === streamingState.current.characterId),
          user_character: (userCharacter as Character) || { name: userCharacterOrProfileName, custom: { personality: "" } },
        },
      });
    },
    [chatMessages, modelSettings, formatTemplate, systemPromptTemplate, inferenceTemplate, chatTemplate],
  );

  /**
   * Generate a new message
   */
  const generateMessage = useCallback(
    async (options: GenerationOptions): Promise<string | null> => {
      const {
        characterId,
        userMessage,
        systemPromptOverride = "",
        parametersOverride = {},
        stream = true,
        existingMessageId = null,
        messageIndex = 0,
        onStreamingStateChange,
      } = options;

      if (!characterId) {
        console.error("Character ID is required");
        return null;
      }

      // Check if the model and manifest are available
      if (!modelSettings || !manifestSettings) {
        console.error("Model or manifest settings not available. Check chat template configuration.");
        return null;
      }

      try {
        // Reset any previous streaming state
        resetStreamingState();

        // Update streaming state with new character ID
        streamingState.current.characterId = characterId;

        // Notify about streaming state change if callback provided
        if (onStreamingStateChange) {
          onStreamingStateChange(streamingState.current);
        }

        // Create or use existing message
        let messageId: string;

        if (existingMessageId) {
          // Use existing message
          messageId = existingMessageId;

          const existingMessage = chatMessages.find((msg) => msg.id === messageId);
          if (existingMessage) {
            existingMessage.messages[messageIndex] = "...";
          }

          // Update message to show loading state
          await updateChatMessage(messageId, {
            messages: existingMessage?.messages || ["..."],
            message_index: messageIndex,
          });
        } else if (userMessage && !existingMessageId) {
          // Add user message first if provided and no existing message ID
          await addChatMessage({
            character_id: null,
            type: "user" as ChatMessageType,
            messages: [userMessage],
          });

          // Then create a placeholder message for the character
          const newMessage = await addChatMessage({
            character_id: characterId,
            type: "character" as ChatMessageType,
            messages: ["..."],
          });

          messageId = newMessage.id;
        } else {
          // Create a placeholder message for the character
          const newMessage = await addChatMessage({
            character_id: characterId,
            type: "character" as ChatMessageType,
            messages: ["..."],
          });

          messageId = newMessage.id;
        }

        // Store the message ID for streaming updates
        streamingState.current.messageId = messageId;
        streamingState.current.messageIndex = messageIndex;

        // Prepare messages for inference
        const { inferenceMessages, systemPrompt } = formatPrompt(userMessage);
        console.log("inferenceMessages", inferenceMessages);
        console.log("systemPrompt", systemPrompt);

        // Create ModelSpecs using the model and manifest settings
        const modelSpecs: ModelSpecs = {
          id: modelSettings.id,
          model_type: "chat",
          config: modelSettings.config || {},
          max_concurrent_requests: modelSettings.max_concurrency || 1,
          engine: manifestSettings.engine,
        };

        // Start the inference process
        const requestId = await runInference({
          messages: inferenceMessages,
          modelSpecs,
          systemPrompt: systemPromptOverride || systemPrompt,
          parameters: parametersOverride || chatTemplate?.config,
          stream,
        });

        // Store the request ID
        if (requestId) {
          streamingState.current.requestId = requestId;

          // Notify about streaming state change if callback provided
          if (onStreamingStateChange) {
            onStreamingStateChange(streamingState.current);
          }
        }

        // Update the message with the accumulated text
        updateMessageByID(streamingState.current.messageId, streamingState.current.accumulatedText, messageIndex);

        return requestId;
      } catch (error) {
        console.error("Error generating message:", error);

        // Reset streaming state
        resetStreamingState();

        // Notify about streaming state change if callback provided
        if (onStreamingStateChange) {
          onStreamingStateChange(null);
        }

        return null;
      }
    },
    [
      currentChatId,
      modelSettings,
      manifestSettings,
      addChatMessage,
      updateChatMessage,
      runInference,
      resetStreamingState,
      formatPrompt,
      chatMessages,
    ],
  );

  /**
   * Regenerate a specific message
   */
  const regenerateMessage = useCallback(
    async (messageId: string, options: Partial<Omit<GenerationOptions, "existingMessageId">> = {}): Promise<string | null> => {
      // Cancel any ongoing requests
      if (streamingState.current.requestId) {
        await cancelRequest(streamingState.current.requestId);
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
    [generateMessage, cancelRequest, currentChatId],
  );

  /**
   * Cancel ongoing generation
   */
  const cancelGeneration = useCallback(async (): Promise<boolean> => {
    if (!streamingState.current.requestId) {
      return false;
    }

    try {
      const success = await cancelRequest(streamingState.current.requestId);

      if (success) {
        resetStreamingState();
      }

      return success;
    } catch (error) {
      console.error("Error canceling generation:", error);
      return false;
    }
  }, [cancelRequest, resetStreamingState]);

  /**
   * Get the current streaming state
   */
  const getStreamingState = useCallback((): StreamingState => {
    return { ...streamingState.current };
  }, []);

  // Return the public API
  return {
    generateMessage,
    regenerateMessage,
    cancelGeneration,
    getStreamingState,
    resetStreamingState,
  };
}

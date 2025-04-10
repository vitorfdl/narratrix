import { useProfile } from "@/hooks/ProfileContext";
import { useCharacters } from "@/hooks/characterStore";
import {
  useChatActions,
  useCurrentChatActiveChapterID,
  useCurrentChatChapters,
  useCurrentChatId,
  useCurrentChatMessages,
  useCurrentChatTemplateID,
  useCurrentChatUserCharacterID,
} from "@/hooks/chatStore";
import { useChatTemplateList } from "@/hooks/chatTemplateStore";
import { useModelManifests } from "@/hooks/manifestStore";
import { useModels } from "@/hooks/modelsStore";
import { useFormatTemplateList, useInferenceTemplateList } from "@/hooks/templateStore";
import { useInference } from "@/hooks/useInference";
import { Character } from "@/schema/characters-schema";
import { ChatMessageType } from "@/schema/chat-message-schema";
import { ModelSpecs } from "@/schema/inference-engine-schema";
import { formatPrompt as formatPromptUtil } from "@/services/inference-steps/formatter";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { removeNestedFields } from "./inference-steps/remove-nested-fields";
import { trimToEndSentence } from "./inference-steps/trim-incomplete-sentence";

/**
 * StreamingState interface for tracking the streaming state of a message
 */
export interface StreamingState {
  messageId: string | null;
  requestId: string | null;
  accumulatedText: string;
  accumulatedReasoning: string;
  characterId: string | null;
  messageIndex?: number;
  isThinking: boolean;
}

/**
 * Simplified options interface that requires less parameters
 */
export interface GenerationOptions {
  chatTemplateID?: string; // Override current chat template
  characterId: string; // Participant ID
  userMessage?: string;
  quietUserMessage?: boolean; // do not save this message to the chat history
  quietResponse?: boolean; // do not save the response to the chat history
  systemPromptOverride?: string; // Override System Prompt
  parametersOverride?: Record<string, any>; // Override Parameters
  stream?: boolean; // Stream the response
  existingMessageId?: string; // Existing Message ID
  messageIndex?: number; // Message Index
  extraSuggestions?: Record<string, any>; // Extra suggestions
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
    accumulatedReasoning: "",
    characterId: null,
    messageIndex: 0,
    isThinking: false,
  });
  const { currentProfile } = useProfile();

  // Get chat store information directly
  const currentChatId = useCurrentChatId();
  const currentChatTemplateId = useCurrentChatTemplateID();
  const currentChatUserCharacterID = useCurrentChatUserCharacterID();
  const chatMessages = useCurrentChatMessages();
  const { addChatMessage, updateChatMessage } = useChatActions();

  // Get model and template information directly
  const chatTemplateList = useChatTemplateList();
  const modelList = useModels();
  const modelManifestList = useModelManifests();
  const inferenceTemplateList = useInferenceTemplateList();
  const formatTemplateList = useFormatTemplateList();

  const chapterList = useCurrentChatChapters();
  const currentChapterID = useCurrentChatActiveChapterID();

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

      // Directly append any explicit reasoning provided
      streamingState.current.accumulatedReasoning += response.result.reasoning || "";

      let currentChunk = response.result.text || "";
      let textToAdd = "";
      let reasoningToAdd = "";

      // Process the text chunk to separate user-facing text and <think> content
      while (currentChunk.length > 0) {
        if (streamingState.current.isThinking) {
          const endTagIndex = currentChunk.indexOf("</think>");
          if (endTagIndex !== -1) {
            // Found the end tag in this chunk
            reasoningToAdd += currentChunk.substring(0, endTagIndex);
            currentChunk = currentChunk.substring(endTagIndex + "</think>".length);
            streamingState.current.isThinking = false;
          } else {
            // End tag not in this chunk, the whole remaining chunk is reasoning
            reasoningToAdd += currentChunk;
            currentChunk = ""; // Consumed the whole chunk
          }
        } else {
          const startTagIndex = currentChunk.indexOf("<think>");
          if (startTagIndex !== -1) {
            // Found the start tag in this chunk
            textToAdd += currentChunk.substring(0, startTagIndex);
            currentChunk = currentChunk.substring(startTagIndex + "<think>".length);
            streamingState.current.isThinking = true;
          } else {
            // Start tag not in this chunk, the whole remaining chunk is text
            textToAdd += currentChunk;
            currentChunk = ""; // Consumed the whole chunk
          }
        }
      }

      // Append processed parts to the accumulated state
      streamingState.current.accumulatedText += textToAdd;
      streamingState.current.accumulatedReasoning += reasoningToAdd;

      if (streamingState.current.characterId && streamingState.current.messageId) {
        // Update the message in the UI with the accumulated *user-facing text* only
        updateMessageByID(
          streamingState.current.messageId,
          streamingState.current.accumulatedText, // Only show user-facing text
          streamingState.current.messageIndex || 0,
        );
      }
    },
    onComplete: (response, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      if (streamingState.current.characterId && streamingState.current.messageId) {
        // Determine the final text, prioritizing the most complete response
        const finalText = trimToEndSentence(response.result?.full_response || response.result?.text || streamingState.current.accumulatedText);
        // Final update to the message
        updateMessageByID(streamingState.current.messageId, finalText, streamingState.current.messageIndex || 0);

        // Reset streaming state
        resetStreamingState();
      }
    },
    onError: (error: any, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      toast.error("Inference error:", {
        description: error.message || error.details || JSON.stringify(error || "Unknown error"),
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
      if (messageId === "generate-input-area") {
        return;
      }

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
      accumulatedReasoning: "",
      characterId: null,
      messageIndex: 0,
      isThinking: false,
    };

    return previousState;
  }, []);

  /**
   * Format prompts for the inference engine
   */
  const formatPrompt = (userMessage?: string, systemPromptOverride?: string, chatTemplateID?: string, extraSuggestions?: Record<string, any>) => {
    const chatTemplate = chatTemplateID
      ? chatTemplateList.find((template) => template.id === chatTemplateID)!
      : chatTemplateList.find((template) => template.id === currentChatTemplateId)!;

    if (!chatTemplate) {
      throw new Error("Chat template not found");
    }

    const modelSettings = modelList.find((model) => model.id === chatTemplate.model_id)!;
    const manifestSettings = modelManifestList.find((manifest) => manifest.id === modelSettings.manifest_id)!;

    const formatTemplate = formatTemplateList.find((template) => template.id === chatTemplate.format_template_id)!;
    const inferenceTemplate = inferenceTemplateList.find((template) => template.id === modelSettings.inference_template_id)!;

    const chatWithNames = chatMessages
      ?.map((msg) => {
        return {
          ...msg,
          character_name: msg.character_id ? characterList.find((character) => character.id === msg.character_id)?.name : undefined,
        };
      })
      ?.filter((msg) => streamingState.current.messageId !== msg.id);

    const prompt = formatPromptUtil({
      messageHistory: chatWithNames || [],
      userPrompt: userMessage,
      systemOverridePrompt: systemPromptOverride,
      modelSettings,
      formatTemplate,
      inferenceTemplate,
      chatTemplate: {
        custom_prompts: chatTemplate?.custom_prompts,
        config: chatTemplate?.config,
      },
      chatConfig: {
        character: characterList.find((character) => character.id === streamingState.current.characterId),
        user_character: (userCharacter as Character) || { name: userCharacterOrProfileName, custom: { personality: "" } },
        chapter: chapterList.find((chapter) => chapter.id === currentChapterID),
        extra: extraSuggestions,
        censorship: {
          words: currentProfile?.settings?.censorship?.customWords,
        },
      },
    });
    return { ...prompt, manifestSettings, modelSettings, chatTemplate };
  };

  /**
   * Generate a new message
   */
  const generateMessage = async (options: GenerationOptions): Promise<string | null> => {
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
    } = options;

    if (!characterId) {
      throw new Error("Character ID is required");
    }

    // Prepare messages for inference
    const promptResult = formatPrompt(userMessage, systemPromptOverride, chatTemplateID, extraSuggestions);
    if (!promptResult) {
      throw new Error("Failed to format prompt");
    }

    const { inferenceMessages, systemPrompt, manifestSettings, modelSettings, chatTemplate } = promptResult;
    if (!modelSettings || !manifestSettings) {
      console.error("Model or manifest settings not available. Check chat template configuration.");
      throw new Error("Model or manifest settings not available. Check chat template configuration.");
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

      if (userMessage && !quietUserMessage) {
        // Add user message if not quiet
        await addChatMessage({
          character_id: null,
          type: "user" as ChatMessageType,
          messages: [userMessage],
        });
      }

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
      } else if (!quietResponse) {
        // Then create a placeholder message for the character
        const newMessage = await addChatMessage({
          character_id: characterId,
          type: "character" as ChatMessageType,
          messages: ["..."],
        });

        messageId = newMessage.id;
      } else {
        messageId = "generate-input-area";
      }

      // Store the message ID for streaming updates
      streamingState.current.messageId = messageId;
      streamingState.current.messageIndex = messageIndex;

      // Create ModelSpecs using the model and manifest settings
      const modelSpecs: ModelSpecs = {
        id: modelSettings.id,
        model_type: "chat",
        config: modelSettings.config || {},
        max_concurrent_requests: modelSettings.max_concurrency || 1,
        engine: manifestSettings.engine,
      };

      const localRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      // Set it to streaming state BEFORE making the backend call
      streamingState.current.requestId = localRequestId;

      // Start the inference process
      const confirmID = await runInference({
        messages: inferenceMessages,
        modelSpecs,
        systemPrompt: systemPrompt,
        parameters: removeNestedFields(parametersOverride || chatTemplate?.config || {}),
        stream,
        requestId: localRequestId,
      });

      if (!confirmID || !streamingState.current.requestId) {
        resetStreamingState();
        return null;
      }

      if (onStreamingStateChange) {
        onStreamingStateChange(streamingState.current);
      }

      updateMessageByID(streamingState.current.messageId, streamingState.current.accumulatedText ?? "...", messageIndex);

      return confirmID;
    } catch (error) {
      console.error("Error generating message:", error);

      // Reset streaming state
      resetStreamingState();

      // Notify about streaming state change if callback provided
      if (onStreamingStateChange) {
        onStreamingStateChange(null);
      }

      throw error;
    }
  };

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
    [generateMessage, cancelRequest, modelList, currentChatId],
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

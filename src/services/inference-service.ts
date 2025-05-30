import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useChatActions, useCurrentChatActiveChapterID, useCurrentChatChapters, useCurrentChatId, useCurrentChatMessages } from "@/hooks/chatStore";
import { useModelManifests } from "@/hooks/manifestStore";
import { useInference } from "@/hooks/useInference";
import { Character } from "@/schema/characters-schema";
import { ChatMessage, ChatMessageType } from "@/schema/chat-message-schema";
import { ModelSpecs } from "@/schema/inference-engine-schema";
import { FormatTemplate } from "@/schema/template-format-schema";
import { formatPrompt as formatPromptUtil } from "@/services/inference-steps/formatter";
import { useLocalSummarySettings } from "@/utils/local-storage";
import { Howl } from "howler";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { listCharacters } from "./character-service";
import { getChatById } from "./chat-service";
import { formatFinalText } from "./inference-steps/format-response";
import { removeNestedFields } from "./inference-steps/remove-nested-fields";
import { listModels } from "./model-service";
import { listChatTemplates } from "./template-chat-service";
import { getFormatTemplateById } from "./template-format-service";
import { listInferenceTemplates } from "./template-inference-service";

// Cache Howl instances by sound name to ensure reliable playback across platforms
const beepHowlCache: Record<string, Howl> = {};

function playBeepSound(beepSound: string): void {
  if (beepSound === "none" || !beepSound) {
    return;
  }

  const soundPath = `/sounds/${beepSound}.mp3`;

  try {
    // Reuse Howl instance if available, otherwise create and cache it
    let beep = beepHowlCache[beepSound];
    if (!beep) {
      beep = new Howl({
        src: [soundPath],
        volume: 0.5,
      });
      beepHowlCache[beepSound] = beep;
    }
    // Stop and play to ensure the sound always plays from the start
    beep.stop();
    beep.play();
  } catch (error) {
    // Log error for debugging
    console.error("Failed to play beep sound:", error);
  }
}

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
  /**
   * The format template used for this streaming session. This is required for correct reasoning and message formatting.
   */
  formatTemplate: FormatTemplate | null;
  chunkBuffer: string;
}

/**
 * Callback type for streaming state changes
 */
export type StreamingStateChangeCallback = (state: StreamingState) => void;

/**
 * Simplified options interface that requires less parameters
 */
export interface GenerationOptions {
  // Template Configuration
  chatTemplateID?: string; // Override current chat template

  // Participant Configuration
  characterId: string; // Participant ID

  // Message Configuration
  userMessage?: string;
  quietUserMessage?: boolean; // do not save this message to the chat history
  quietResponse?: boolean; // do not save the response to the chat history

  // Prompt Configuration
  systemPromptOverride?: string; // Override System Prompt
  parametersOverride?: Record<string, any>; // Override Parameters
  messageHistoryOverride?: ChatMessage[]; // Override Message History

  // Streaming Configuration
  stream?: boolean; // Stream the response
  onStreamingStateChange?: (state: StreamingState | null) => void; // Callback for streaming state changes

  // Message Management
  existingMessageId?: string; // Existing Message ID
  messageIndex?: number; // Message Index
  extraSuggestions?: Record<string, any>; // Extra suggestions
}

const DEFAULT_THINKING_CONFIG = {
  prefix: "<think>",
  suffix: "</think>",
};

const INITIAL_STREAMING_STATE: StreamingState = {
  messageId: null,
  requestId: null,
  accumulatedText: "",
  accumulatedReasoning: "",
  characterId: null,
  messageIndex: 0,
  isThinking: false,
  formatTemplate: null,
  chunkBuffer: "",
};

// Add a debounced update function
const createDebouncedUpdate = () => {
  let timeoutId: number | null = null;
  let pendingUpdate: (() => void) | null = null;

  return (updateFn: () => void, delay = 50) => {
    pendingUpdate = updateFn;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (pendingUpdate) {
        pendingUpdate();
        pendingUpdate = null;
      }
      timeoutId = null;
    }, delay);
  };
};

// Create debounced updater instance
const debouncedMessageUpdate = createDebouncedUpdate();

// Enhanced chunk processor with buffer
const processStreamChunk = (
  chunk: string,
  streamingState: StreamingState,
  formatTemplate: FormatTemplate | null,
): { textToAdd: string; reasoningToAdd: string } => {
  const { prefix = "<think>", suffix = "</think>" } = formatTemplate?.config.reasoning || DEFAULT_THINKING_CONFIG;

  // Combine buffer with new chunk
  let workingText = streamingState.chunkBuffer + chunk;
  let textToAdd = "";
  let reasoningToAdd = "";

  // Process the working text
  while (workingText.length > 0) {
    if (streamingState.isThinking) {
      // Look for end tag
      const endTagIndex = workingText.indexOf(suffix);

      if (endTagIndex !== -1) {
        // Found complete end tag
        reasoningToAdd += workingText.substring(0, endTagIndex);
        workingText = workingText.substring(endTagIndex + suffix.length);
        streamingState.isThinking = false;
      } else {
        // Check if we have a partial end tag at the end
        const partialMatch = findPartialTagMatch(workingText, suffix);
        if (partialMatch > -1) {
          // Save partial match in buffer
          reasoningToAdd += workingText.substring(0, partialMatch);
          streamingState.chunkBuffer = workingText.substring(partialMatch);
          workingText = "";
        } else {
          // No partial match, consume all as reasoning
          reasoningToAdd += workingText;
          streamingState.chunkBuffer = "";
          workingText = "";
        }
      }
    } else {
      // Look for start tag
      const startTagIndex = workingText.indexOf(prefix);

      if (startTagIndex !== -1) {
        // Found complete start tag
        textToAdd += workingText.substring(0, startTagIndex);
        workingText = workingText.substring(startTagIndex + prefix.length);
        streamingState.isThinking = true;
      } else {
        // Check if we have a partial start tag at the end
        const partialMatch = findPartialTagMatch(workingText, prefix);
        if (partialMatch > -1) {
          // Save partial match in buffer
          textToAdd += workingText.substring(0, partialMatch);
          streamingState.chunkBuffer = workingText.substring(partialMatch);
          workingText = "";
        } else {
          // No partial match, consume all as text
          textToAdd += workingText;
          streamingState.chunkBuffer = "";
          workingText = "";
        }
      }
    }
  }

  return { textToAdd, reasoningToAdd };
};

// Helper function to find partial tag matches
const findPartialTagMatch = (text: string, tag: string): number => {
  // Check if the end of text could be the beginning of the tag
  for (let i = 1; i < tag.length && i <= text.length; i++) {
    if (text.endsWith(tag.substring(0, i))) {
      return text.length - i;
    }
  }
  return -1;
};

/**
 * UseInferenceService hook for centralizing inference functionality
 */
export function useInferenceService() {
  const streamingState = useRef<StreamingState>({ ...INITIAL_STREAMING_STATE });
  const stateChangeCallbacks = useRef<Set<StreamingStateChangeCallback>>(new Set());
  const currentProfile = useCurrentProfile();
  if (!currentProfile) {
    throw new Error("Current profile not found");
  }

  // Get chat store information directly
  const currentChatId = useCurrentChatId();
  const chatMessages = useCurrentChatMessages();
  const { addChatMessage, updateChatMessage, fetchChatMessages } = useChatActions();

  const modelManifestList = useModelManifests();

  const chapterList = useCurrentChatChapters();
  const currentChapterID = useCurrentChatActiveChapterID();

  const [localSummarySettings] = useLocalSummarySettings();

  /**
   * Notify all registered callbacks about streaming state changes
   */
  const notifyStateChange = useCallback(() => {
    const currentState = { ...streamingState.current };
    stateChangeCallbacks.current.forEach((callback) => {
      try {
        callback(currentState);
      } catch (error) {
        console.error("Error in streaming state change callback:", error);
      }
    });
  }, []);

  /**
   * Subscribe to streaming state changes
   */
  const subscribeToStateChanges = useCallback((callback: StreamingStateChangeCallback) => {
    stateChangeCallbacks.current.add(callback);

    // Return unsubscribe function
    return () => {
      stateChangeCallbacks.current.delete(callback);
    };
  }, []);

  // Set up inference with callbacks
  const { runInference, cancelRequest } = useInference({
    onStream: (response, requestId) => {
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      // Process explicit reasoning if provided
      streamingState.current.accumulatedReasoning += response.result.reasoning || "";

      const currentChunk = response.result.text || response.result.full_response || "";

      // Process chunk with buffer
      const { textToAdd, reasoningToAdd } = processStreamChunk(currentChunk, streamingState.current, streamingState.current.formatTemplate);

      // Accumulate the processed text and reasoning
      streamingState.current.accumulatedText += textToAdd;
      streamingState.current.accumulatedReasoning += reasoningToAdd;

      // Notify subscribers about the state change
      notifyStateChange();

      // Debounce UI updates to prevent overwhelming the frontend
      if (streamingState.current.characterId && streamingState.current.messageId) {
        debouncedMessageUpdate(() => {
          inferenceUpdateMessageID(
            streamingState.current.messageId!,
            streamingState.current.accumulatedText,
            streamingState.current.messageIndex || 0,
          );
        });
      }
    },
    onComplete: (response, requestId) => {
      // Skip if this is for a different request
      if (requestId !== streamingState.current.requestId) {
        return;
      }

      if (streamingState.current.characterId && streamingState.current.messageId) {
        // Helper to apply conditional formatting based on FormatTemplate settings

        const rawText = response.result?.full_response || response.result?.text || streamingState.current.accumulatedText;
        const { text: finalText, reasoning: finalReasoning } = formatFinalText(rawText, streamingState.current.formatTemplate);

        streamingState.current.accumulatedReasoning = finalReasoning || "";
        // Final update to the message
        inferenceUpdateMessageID(streamingState.current.messageId, finalText, streamingState.current.messageIndex || 0);

        // Reset streaming state (this will notify subscribers)
        resetStreamingState();
        playBeepSound(currentProfile.settings.chat.beepSound);
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

      // Reset streaming state (this will notify subscribers)
      resetStreamingState();
    },
  });

  /**
   * Updates a character message with new text
   */
  const inferenceUpdateMessageID = async (messageId: string, messageText: string, messageIndex = 0) => {
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
    streamingState.current = { ...INITIAL_STREAMING_STATE };

    // Notify all subscribers about the state change
    notifyStateChange();

    return previousState;
  }, [notifyStateChange]);

  /**
   * Format prompts for the inference engine
   */
  const formatPrompt = async (
    userMessage?: string,
    characterId?: string,
    systemPromptOverride?: string,
    chatTemplateID?: string,
    messagesToUse?: ChatMessage[],
    extraSuggestions?: Record<string, any>,
  ) => {
    const currentChat = await getChatById(currentChatId);

    const chatTemplateList = await listChatTemplates({ profile_id: currentProfile!.id });
    const chatTemplate = chatTemplateID
      ? chatTemplateList.find((template) => template.id === chatTemplateID)!
      : chatTemplateList.find((template) => template.id === currentChat?.chat_template_id)!;

    if (!chatTemplate) {
      throw new Error("Chat template not found");
    }

    const modelList = await listModels({ profile_id: currentProfile!.id });
    const modelSettings = modelList.find((model) => model.id === chatTemplate.model_id)!;

    if (!modelSettings) {
      throw new Error(`Model settings for chat template ${chatTemplate.name} not found`);
    }

    const manifestSettings = modelManifestList.find((manifest) => manifest.id === modelSettings.manifest_id)!;
    if (!manifestSettings) {
      throw new Error(`Manifest settings for model ${modelSettings.name} not found`);
    }

    const formatTemplate = await getFormatTemplateById(chatTemplate.format_template_id || "");
    if (!formatTemplate) {
      throw new Error(`Format template for chat template ${chatTemplate.name} not found`);
    }

    // Store the format template in the streaming state for use during streaming (reasoning, etc)
    streamingState.current.formatTemplate = formatTemplate;

    const inferenceTemplateList = await listInferenceTemplates({ profile_id: currentProfile!.id });
    const inferenceTemplate = inferenceTemplateList.find((template) => template.id === modelSettings.inference_template_id)!;
    const characterList = await listCharacters(currentProfile!.id);

    // Get the user character name or the profile name
    const userCharacter = characterList.find((character) => character.id === currentChat?.user_character_id);
    const userCharacterOrProfileName = userCharacter?.name || currentProfile?.name;

    // Add the character name to the messages, so the formatter can prefix if enabled
    const chatWithNames = (messagesToUse || chatMessages)
      ?.map((msg) => {
        return {
          ...msg,
          character_name: msg.character_id
            ? characterList.find((character) => character.id === msg.character_id)?.name
            : msg.type === "user"
              ? userCharacterOrProfileName
              : undefined,
        };
      })
      ?.filter((msg) => streamingState.current.messageId !== msg.id)
      .filter((msg) => !msg.disabled);

    const characterPromptOverride = characterList.find((character) => character.id === characterId)?.system_override;

    const character = characterList.find((character) => character.id === characterId);
    // Format the prompt
    const prompt = await formatPromptUtil({
      messageHistory: chatWithNames || [],
      userPrompt: userMessage,
      systemOverridePrompt: systemPromptOverride || characterPromptOverride || undefined,
      modelSettings,
      formatTemplate,
      inferenceTemplate,
      chatTemplate: {
        custom_prompts: chatTemplate?.custom_prompts,
        config: chatTemplate?.config,
        lorebook_list: chatTemplate?.lorebook_list || [],
      },
      chatConfig: {
        injectionPrompts: {
          summary: localSummarySettings.requestPrompt,
        },
        character,
        user_character: (userCharacter as Character) || { name: userCharacterOrProfileName, custom: { personality: "" } },
        chapter: chapterList.find((chapter) => chapter.id === currentChapterID),
        extra: extraSuggestions,
        censorship: {
          words: formatTemplate.config.settings.apply_censorship ? currentProfile?.settings?.censorship?.customWords : [],
        },
      },
    });

    return { ...prompt, manifestSettings, modelSettings, chatTemplate, isChat: !inferenceTemplate };
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
      messageHistoryOverride,
    } = options;

    try {
      // Reset any previous streaming state
      resetStreamingState();

      // Update streaming state with new character ID
      streamingState.current.characterId = characterId;

      // Notify about streaming state change if callback provided
      if (onStreamingStateChange) {
        onStreamingStateChange(streamingState.current);
      }

      // Notify all subscribers about the state change
      notifyStateChange();

      if (existingMessageId) {
        streamingState.current.messageId = existingMessageId;
        streamingState.current.messageIndex = messageIndex;
        // Notify subscribers about the updated message ID
        notifyStateChange();
      }

      const freshMessages = messageHistoryOverride || (await fetchChatMessages(currentChatId, currentChapterID));

      // Prepare messages for inference
      const promptResult = await formatPrompt(userMessage, characterId, systemPromptOverride, chatTemplateID, freshMessages, extraSuggestions);
      if (!promptResult) {
        throw new Error("Failed to format prompt");
      }

      const { inferenceMessages, systemPrompt, manifestSettings, modelSettings, chatTemplate, isChat, customStopStrings } = promptResult;
      if (!modelSettings || !manifestSettings) {
        console.error("Model or manifest settings not available. Check chat template configuration.");
        throw new Error("Model or manifest settings not available. Check chat template configuration.");
      }

      // Create or use existing message
      let messageId: string;

      if (userMessage && !quietUserMessage) {
        // Add user message if not quiet
        await addChatMessage({
          character_id: null,
          type: "user" as ChatMessageType,
          messages: [userMessage],
          extra: {},
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
          extra: {},
        });

        messageId = newMessage.id;
      } else {
        messageId = "generate-input-area";
      }

      // Store the message ID for streaming updates
      streamingState.current.messageId = messageId;
      streamingState.current.messageIndex = messageIndex;

      // Notify subscribers about the updated message ID
      notifyStateChange();

      // Create ModelSpecs using the model and manifest settings
      const modelSpecs: ModelSpecs = {
        id: modelSettings.id,
        model_type: isChat ? "chat" : "completion",
        config: modelSettings.config || {},
        max_concurrent_requests: modelSettings.max_concurrency || 1,
        engine: manifestSettings.engine,
      };

      const localRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      // Set it to streaming state BEFORE making the backend call
      streamingState.current.requestId = localRequestId;

      // Notify subscribers about the updated request ID
      notifyStateChange();

      // Setup Parameters with Custom Stop Strigns.
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

      if (!confirmID || !streamingState.current.requestId) {
        resetStreamingState();
        return null;
      }

      if (onStreamingStateChange) {
        onStreamingStateChange(streamingState.current);
      }

      inferenceUpdateMessageID(streamingState.current.messageId, streamingState.current.accumulatedText ?? "...", messageIndex);

      return confirmID;
    } catch (error) {
      console.error("Error generating message:", error);

      // Reset streaming state (this will notify subscribers)
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
    [cancelRequest, currentChatId, chatMessages, generateMessage],
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
        resetStreamingState(); // This will notify subscribers
      }

      return success ?? false;
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
    subscribeToStateChanges,
  };
}

import { ChatMessage } from "@/schema/chat-message-schema";
import { FormatTemplate } from "@/schema/template-format-schema";

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

export const DEFAULT_THINKING_CONFIG = {
  prefix: "<think>",
  suffix: "</think>",
};

export const INITIAL_STREAMING_STATE: StreamingState = {
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

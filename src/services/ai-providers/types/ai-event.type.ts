import type { InferenceToolCall } from "@/schema/inference-engine-schema";

interface AIStreamPayload {
  text?: string;
  reasoning?: string;
  fullResponse?: string;
  toolCalls?: InferenceToolCall[];
}

interface AIToolCallPayload {
  id: string;
  toolCall: InferenceToolCall;
}

interface AIToolResultPayload extends AIToolCallPayload {
  output?: string;
  error?: string;
}

interface AIEvent {
  readonly requestId: string;
  sendStream: (payload: AIStreamPayload) => void;
  sendThinkingStream?: (text: string) => void;
  sendImage?: (image: string) => void;
  sendToolCallStart?: (payload: AIToolCallPayload) => void;
  sendToolCallResult?: (payload: AIToolResultPayload) => void;
  sendError: (error: { message: string; code?: string; details?: unknown }) => void;
  finish: (payload?: AIStreamPayload) => void;
  registerAborter: (aborter: () => void) => void;
}

export type { AIEvent, AIStreamPayload, AIToolCallPayload, AIToolResultPayload };

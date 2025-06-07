// Main service
export { useInferenceService } from "../inference-service";

// Types
export type {
  GenerationOptions,
  StreamingState,
  StreamingStateChangeCallback,
} from "./types";

// Individual modules (for advanced usage)
export { useMessageManager } from "./message-manager";
export { usePromptFormatter } from "./prompt-formatter";
export { processStreamChunk } from "./stream-processor";
export { useStreamingStateManager } from "./streaming-state-manager";
export {
  batchedStreamingUpdate,
  createBatchedUpdate,
  createDebouncedUpdate,
  debouncedMessageUpdate,
  playBeepSound,
} from "./utils";

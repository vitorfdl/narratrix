import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentChatId } from "@/hooks/chatStore";
import { INITIAL_STREAMING_STATE, StreamingState } from "../services/inference/types";
import { useInferenceService as useInferenceServiceOriginal } from "../services/inference-service";

export type { GenerationOptions, StreamingState, StreamingStateChangeCallback } from "../services/inference/types";

const InferenceServiceContext = createContext<ReturnType<typeof useInferenceServiceOriginal> | null>(null);

export const InferenceServiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const inferenceService = useInferenceServiceOriginal();

  return <InferenceServiceContext.Provider value={inferenceService}>{children}</InferenceServiceContext.Provider>;
};

export const useInferenceServiceFromContext = () => {
  const context = useContext(InferenceServiceContext);
  if (!context) {
    toast.error("useInferenceServiceFromContext must be used within an InferenceServiceProvider");
    throw new Error("useInferenceServiceFromContext must be used within an InferenceServiceProvider");
  }
  return context;
};

/**
 * Convenience hook that subscribes to the streaming state of the currently selected chat.
 * Re-renders only when the current chat's streaming state changes.
 */
export const useChatInferenceState = () => {
  const chatId = useCurrentChatId();
  const inferenceService = useInferenceServiceFromContext();
  const [streamingState, setStreamingState] = useState<StreamingState>({ ...INITIAL_STREAMING_STATE });

  useEffect(() => {
    setStreamingState(inferenceService.getStreamingState(chatId));

    const unsubscribe = inferenceService.subscribeToStateChanges((state) => {
      setStreamingState(state);
    }, chatId);

    return unsubscribe;
  }, [chatId, inferenceService]);

  return {
    streamingState,
    isStreaming: !!(streamingState.requestId && streamingState.characterId),
    chatId,
  };
};

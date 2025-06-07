import React, { createContext, ReactNode, useContext } from "react";
import { toast } from "sonner";
import { useInferenceService as useInferenceServiceOriginal } from "../services/inference-service";

// Re-export types from the separated modules for convenience
export type { GenerationOptions, StreamingState, StreamingStateChangeCallback } from "../services/inference/types";

// Create a context for the inference service
const InferenceServiceContext = createContext<ReturnType<typeof useInferenceServiceOriginal> | null>(null);

// Provider component
export const InferenceServiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const inferenceService = useInferenceServiceOriginal();

  return <InferenceServiceContext.Provider value={inferenceService}>{children}</InferenceServiceContext.Provider>;
};

// Custom hook to use the inference service from context
// ! TODO: I'm doing some weird stuff with the service, now a provider. May need to refactor this.
export const useInferenceServiceFromContext = () => {
  const context = useContext(InferenceServiceContext);
  if (!context) {
    toast.error("useInferenceServiceFromContext must be used within an InferenceServiceProvider");
    throw new Error("useInferenceServiceFromContext must be used within an InferenceServiceProvider");
  }
  return context;
};

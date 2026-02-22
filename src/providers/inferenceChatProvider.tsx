import React, { type ReactNode } from "react";
import { InferenceServiceContext } from "@/hooks/useChatInference";
import { useInferenceService as useInferenceServiceOriginal } from "../services/inference-service";

export const InferenceServiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const inferenceService = useInferenceServiceOriginal();

  return <InferenceServiceContext.Provider value={inferenceService}>{children}</InferenceServiceContext.Provider>;
};

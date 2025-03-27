import { setupInferenceListener } from "@/hooks/useInference";
import { ReactNode, useEffect } from "react";

interface InferenceProviderProps {
  children: ReactNode;
}

/**
 * Provider component that initializes the inference system.
 * Place this near the root of your application.
 */
export function InferenceProvider({ children }: InferenceProviderProps) {
  // Set up the global inference listener when the app starts
  useEffect(() => {
    console.log("InferenceProvider: Initializing inference system");
    setupInferenceListener();
  }, []);

  return <>{children}</>;
}

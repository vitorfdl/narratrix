import { ReactNode } from "react";

interface InferenceProviderProps {
  children: ReactNode;
}

/**
 * Provider component that initializes the inference system.
 * Place this near the root of your application.
 */
export function InferenceProvider({ children }: InferenceProviderProps) {
  // Our new implementation handles listener setup automatically in the hook
  return <>{children}</>;
}

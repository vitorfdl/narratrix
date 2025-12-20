import { invoke } from "@tauri-apps/api/core";

type TemporaryModelType = "Llama2" | "Llama3" | "Deepseek" | "Mistral" | "DEFAULT";
export function countTokens(text: string, modelType: TemporaryModelType): Promise<{ count: number }> {
  return invoke<{ count: number }>("count_tokens", {
    text,
    modelType,
  });
}

import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { mapReasoningEffort } from "./shared";

function getGeminiProviderOptions(parameters: Record<string, any>) {
  const providerOptions: GoogleGenerativeAIProviderOptions = {};

  const thinkingConfig: GoogleGenerativeAIProviderOptions["thinkingConfig"] = {};

  if ("reasoning_budget" in parameters && parameters.reasoning_budget !== 0) {
    thinkingConfig.thinkingBudget = parameters.reasoning_budget;
  }

  if ("reasoning_temperature" in parameters && parameters.reasoning_temperature !== -1) {
    thinkingConfig.thinkingLevel = mapReasoningEffort(parameters.reasoning_temperature, "minimal");
  }

  if (Object.keys(thinkingConfig).length > 0) {
    providerOptions.thinkingConfig = thinkingConfig;
  }

  return providerOptions;
}

export { getGeminiProviderOptions };

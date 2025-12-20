import { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";

function parseReasoningEffort(reasoning?: number) {
  switch (reasoning) {
    case 0:
      return "minimal";
    case 1:
      return "low";
    case 2:
      return "medium";
    case 3:
      return "high";
    default:
      return "minimal";
  }
}

function getGeminiProviderOptions(parameters: Record<string, any>) {
  const providerOptions: GoogleGenerativeAIProviderOptions = {};

  const thinkingConfig: GoogleGenerativeAIProviderOptions["thinkingConfig"] = {};

  if ("reasoning_budget" in parameters && parameters.reasoning_budget !== 0) {
    thinkingConfig.thinkingBudget = parameters.reasoning_budget;
  }

  if ("reasoning_temperature" in parameters && parameters.reasoning_temperature !== -1) {
    thinkingConfig.thinkingLevel = parseReasoningEffort(parameters.reasoning_temperature);
  }

  if (Object.keys(thinkingConfig).length > 0) {
    providerOptions.thinkingConfig = thinkingConfig;
  }

  return providerOptions;
}

export { getGeminiProviderOptions };

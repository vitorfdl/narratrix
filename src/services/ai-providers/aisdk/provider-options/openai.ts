import { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";

function parseReasoningEffort(reasoning?: number) {
  switch (reasoning) {
    case 0:
      return "none";
    case 1:
      return "low";
    case 2:
      return "medium";
    case 3:
      return "high";
    default:
      return "none";
  }
}

function getOpenAIProviderOptions(parameters: Record<string, any>): OpenAIResponsesProviderOptions {
  const providerOptions: OpenAIResponsesProviderOptions = {};

  if ("reasoning_temperature" in parameters && parameters.reasoning_temperature !== -1) {
    providerOptions.reasoningEffort = parseReasoningEffort(parameters.reasoning_temperature);
  }

  if ("verbosity" in parameters && parameters.verbosity !== -1) {
    providerOptions.textVerbosity = parseReasoningEffort(parameters.verbosity) as "low" | "medium" | "high" | null | undefined;
  }

  return providerOptions;
}

export { getOpenAIProviderOptions };

import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { mapReasoningEffort } from "./shared";

function getOpenAIProviderOptions(parameters: Record<string, any>): OpenAIResponsesProviderOptions {
  const providerOptions: OpenAIResponsesProviderOptions = {};

  if ("reasoning_temperature" in parameters && parameters.reasoning_temperature !== -1) {
    providerOptions.reasoningEffort = mapReasoningEffort(parameters.reasoning_temperature);
  }

  if ("verbosity" in parameters && parameters.verbosity !== -1) {
    providerOptions.textVerbosity = mapReasoningEffort(parameters.verbosity) as "low" | "medium" | "high" | null | undefined;
  }

  return providerOptions;
}

export { getOpenAIProviderOptions };

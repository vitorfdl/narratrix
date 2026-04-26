import type { OpenRouterProviderOptions } from "@openrouter/ai-sdk-provider";
import { mapReasoningEffort, pickDefined } from "./shared";

const OPENROUTER_PASSTHROUGH_KEYS = ["min_p", "top_a", "repetition_penalty"] as const;

type OpenRouterProviderOptionsWithPassthrough = Omit<OpenRouterProviderOptions, "reasoning"> & {
  reasoning?: OpenRouterProviderOptions["reasoning"] | { enabled: false };
} & Record<string, unknown>;

function getOpenRouterProviderOptions(parameters: Record<string, any>): OpenRouterProviderOptionsWithPassthrough {
  const providerOptions: OpenRouterProviderOptionsWithPassthrough = {};

  const hasReasoningBudget = "reasoning_budget" in parameters;
  const hasReasoningEffort = "reasoning_temperature" in parameters;
  const hasEffort = hasReasoningEffort && parameters.reasoning_temperature !== -1;
  const hasBudget = hasReasoningBudget && parameters.reasoning_budget > 0;
  const isReasoningExplicitlyDisabled = hasReasoningBudget && hasReasoningEffort && parameters.reasoning_budget === 0 && parameters.reasoning_temperature === -1;

  if (hasBudget) {
    providerOptions.reasoning = { max_tokens: parameters.reasoning_budget };
  } else if (hasEffort) {
    providerOptions.reasoning = { effort: mapReasoningEffort(parameters.reasoning_temperature) };
  } else if (isReasoningExplicitlyDisabled) {
    providerOptions.reasoning = { enabled: false };
  }

  Object.assign(providerOptions, pickDefined(parameters, OPENROUTER_PASSTHROUGH_KEYS));

  return providerOptions;
}

export { getOpenRouterProviderOptions };

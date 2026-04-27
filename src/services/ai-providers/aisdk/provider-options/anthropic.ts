import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";

function getAnthropicProviderOptions(parameters: Record<string, any>): AnthropicProviderOptions {
  const providerOptions: AnthropicProviderOptions = {};

  const hasBudget = "reasoning_budget" in parameters && parameters.reasoning_budget > 0;
  const hasEffort = "reasoning_temperature" in parameters && parameters.reasoning_temperature !== -1;

  if (hasBudget) {
    providerOptions.thinking = { type: "enabled", budgetTokens: parameters.reasoning_budget };
  } else if (hasEffort) {
    providerOptions.thinking = { type: "enabled" };
  }

  return providerOptions;
}

export { getAnthropicProviderOptions };

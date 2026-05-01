import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";

type AdaptiveEffort = NonNullable<AnthropicProviderOptions["effort"]>;

// Claude Opus 4.7+ rejects thinking.type "enabled" and requires "adaptive".
// Confirmed for Opus 4.7; assumed for any 4.7+ or 5+ across Opus/Sonnet/Haiku.
// Older models (including Opus 4.6 and Sonnet 4.6) still use "enabled" with budgetTokens.
const ADAPTIVE_MODEL_PATTERN = /claude-(?:opus|sonnet|haiku)-(?:(?:[5-9]|\d{2})-\d{1,2}|4-(?:[7-9]|\d{2}))(?!\d)/;

function usesAdaptiveReasoning(modelName: string | undefined): boolean {
  return modelName ? ADAPTIVE_MODEL_PATTERN.test(modelName) : false;
}

function mapAdaptiveEffort(value: number | undefined): AdaptiveEffort | undefined {
  switch (value) {
    case 0:
    case 1:
      return "low";
    case 2:
      return "medium";
    case 3:
      return "high";
    default:
      return undefined;
  }
}

function getAnthropicProviderOptions(parameters: Record<string, any>, modelName?: string): AnthropicProviderOptions {
  const providerOptions: AnthropicProviderOptions = {};

  const hasBudget = "reasoning_budget" in parameters && parameters.reasoning_budget > 0;
  const hasEffort = "reasoning_temperature" in parameters && parameters.reasoning_temperature !== -1;
  const explicitlyOff = parameters.reasoning_temperature === -1;

  if (usesAdaptiveReasoning(modelName)) {
    if (!explicitlyOff && (hasEffort || hasBudget)) {
      // display defaults to "omitted" on Opus 4.7+; opt back into "summarized" so the reasoning UI keeps showing progress.
      providerOptions.thinking = { type: "adaptive", display: "summarized" };
      providerOptions.effort = mapAdaptiveEffort(parameters.reasoning_temperature) ?? "high";
    }
  } else if (hasBudget) {
    providerOptions.thinking = { type: "enabled", budgetTokens: parameters.reasoning_budget };
  } else if (hasEffort) {
    providerOptions.thinking = { type: "enabled" };
  }

  return providerOptions;
}

export { getAnthropicProviderOptions };

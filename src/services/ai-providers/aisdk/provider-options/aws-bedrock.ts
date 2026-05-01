import { BedrockProviderOptions } from "@ai-sdk/amazon-bedrock";

type AdaptiveEffort = NonNullable<NonNullable<BedrockProviderOptions["reasoningConfig"]>["maxReasoningEffort"]>;

// Claude Opus 4.7+ on Bedrock rejects thinking.type "enabled" and requires "adaptive".
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

function getAWSBedrockProviderOptions(parameters: Record<string, any>, modelName?: string) {
  const providerOptions: BedrockProviderOptions = {};

  const hasBudget = "reasoning_budget" in parameters && parameters.reasoning_budget > 0;
  const hasEffort = "reasoning_temperature" in parameters && parameters.reasoning_temperature !== -1;
  const explicitlyOff = parameters.reasoning_temperature === -1;

  if (usesAdaptiveReasoning(modelName)) {
    if (!explicitlyOff && (hasEffort || hasBudget)) {
      const effort = mapAdaptiveEffort(parameters.reasoning_temperature) ?? "high";
      // display defaults to "omitted" on Opus 4.7+; opt back into "summarized" so the reasoning UI keeps showing progress.
      providerOptions.reasoningConfig = { type: "adaptive", maxReasoningEffort: effort, display: "summarized" };
    }
  } else if (hasBudget) {
    providerOptions.reasoningConfig = { type: "enabled", budgetTokens: parameters.reasoning_budget };
  }

  return providerOptions;
}

export { getAWSBedrockProviderOptions };

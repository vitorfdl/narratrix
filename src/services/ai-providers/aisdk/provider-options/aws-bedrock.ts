import { BedrockProviderOptions } from "@ai-sdk/amazon-bedrock";

function getAWSBedrockProviderOptions(parameters: Record<string, any>) {
  const providerOptions: BedrockProviderOptions = {};

  const reasoningConfig: BedrockProviderOptions["reasoningConfig"] = {};

  if ("reasoning_budget" in parameters && parameters.reasoning_budget !== 0) {
    reasoningConfig.budgetTokens = parameters.reasoning_budget;
  }

  if (Object.keys(reasoningConfig).length > 0) {
    providerOptions.reasoningConfig = { ...reasoningConfig, type: "enabled" };
  }

  return providerOptions;
}

export { getAWSBedrockProviderOptions };

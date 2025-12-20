import { Engine } from "@/schema/model-manifest-schema";
import { getAWSBedrockProviderOptions } from "./aws-bedrock";
import { getGeminiProviderOptions } from "./gemini";
import { getOpenAIProviderOptions } from "./openai";

function getProviderOptions(engine: Engine, parameters: Record<string, any>) {
  switch (engine) {
    case "google":
      return getGeminiProviderOptions(parameters);
    case "aws_bedrock":
      return getAWSBedrockProviderOptions(parameters);
    case "openai":
      return getOpenAIProviderOptions(parameters);
    // case "openrouter":
    //   return getOpenRouterProviderOptions(parameters);
    // case "anthropic":
    //   return getAnthropicProviderOptions(parameters);
    default:
      return {};
  }
}

export { getProviderOptions };

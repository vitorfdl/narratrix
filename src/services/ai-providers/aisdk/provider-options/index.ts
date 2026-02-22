import type { Engine } from "@/schema/model-manifest-schema";
import { getAWSBedrockProviderOptions } from "./aws-bedrock";
import { getGeminiProviderOptions } from "./gemini";
import { getOpenAIProviderOptions } from "./openai";
import { getOpenAICompatibleProviderOptions } from "./openai-compatible";

function getProviderOptions(engine: Engine, parameters: Record<string, any>) {
  switch (engine) {
    case "google":
      return { google: getGeminiProviderOptions(parameters) };
    case "aws_bedrock":
      return { bedrock: getAWSBedrockProviderOptions(parameters) };
    case "openai":
      return { openai: getOpenAIProviderOptions(parameters) };
    // case "openrouter":
    //   return { openrouter: getOpenRouterProviderOptions(parameters) };
    // case "anthropic":
    //   return { anthropic: getAnthropicProviderOptions(parameters) };
    case "openai_compatible":
      return { openai: getOpenAICompatibleProviderOptions(parameters) };
    case "ollama":
      return {};
    default:
      return {};
  }
}

export { getProviderOptions };

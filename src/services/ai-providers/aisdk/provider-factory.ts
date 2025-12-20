import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { decryptApiKey } from "@/commands/security";
import { ModelSpecs } from "@/schema/inference-engine-schema";

async function getAISDKModel(modelProvider: ModelSpecs) {
  const engineName = modelProvider.engine;
  const authParams = modelProvider.config;

  const modelName = modelProvider.config.model;
  if (!modelName && engineName !== "openai_compatible") {
    throw new Error("Model name is required");
  }

  const fetchOverride = (input: RequestInfo | URL, init?: RequestInit) => tauriFetch(input, init);

  if (engineName === "google") {
    const APIKey = authParams?.api_key ? await decryptApiKey(authParams?.api_key) : "None";
    const google = createGoogleGenerativeAI({
      apiKey: APIKey,
      fetch: fetchOverride,
    });
    return google(modelName);
  }

  if (engineName === "aws_bedrock") {
    const AWSSecretAccessKey = authParams?.aws_secret_access_key ? await decryptApiKey(authParams?.aws_secret_access_key) : "None";
    const awsBedrock = createAmazonBedrock({
      accessKeyId: authParams?.aws_access_key_id || "",
      secretAccessKey: AWSSecretAccessKey,
      region: authParams?.aws_region || "us-east-1",
    });
    return awsBedrock(modelName);
  }

  if (engineName === "anthropic") {
    const APIKey = authParams?.api_key ? await decryptApiKey(authParams?.api_key) : "None";
    const anthropic = createAnthropic({
      apiKey: APIKey,
      baseURL: authParams?.base_url,
      fetch: fetchOverride,
    });
    return anthropic(modelName);
  }

  if (engineName === "openrouter") {
    const APIKey = authParams?.api_key ? await decryptApiKey(authParams?.api_key) : "None";
    const openrouter = createOpenRouter({
      apiKey: APIKey,
      baseURL: authParams?.base_url || "https://openrouter.ai/api/v1",
      fetch: fetchOverride,
    });

    if (modelProvider.model_type === "chat") {
      return openrouter.chat(modelName);
    } else {
      return openrouter.completion(modelName);
    }
  }

  if (engineName === "openai_compatible") {
    const APIKey = authParams?.api_key ? await decryptApiKey(authParams?.api_key) : "None";
    const openai = createOpenAI({
      apiKey: APIKey,
      baseURL: authParams?.base_url,
      fetch: fetchOverride,
    });

    if (modelProvider.model_type === "chat") {
      return openai.chat(modelName || "any");
    } else {
      return openai.completion(modelName || "any");
    }
  }

  // OpenAI (default)
  const APIKey = authParams?.api_key ? await decryptApiKey(authParams?.api_key) : "None";
  const openai = createOpenAI({
    apiKey: APIKey,
    organization: authParams?.apiOrg,
    baseURL: authParams?.base_url,
    fetch: fetchOverride,
  });

  if (modelProvider.model_type === "chat") {
    return openai.chat(modelName);
  } else {
    return openai.completion(modelName);
  }
}

export { getAISDKModel };

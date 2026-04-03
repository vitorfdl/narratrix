import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { EmbeddingModel } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { decryptApiKey } from "@/commands/security";
import type { ModelSpecs } from "@/schema/inference-engine-schema";

async function getEmbeddingModel(modelProvider: ModelSpecs): Promise<EmbeddingModel> {
  const engineName = modelProvider.engine;
  const authParams = modelProvider.config;
  const modelName = authParams.model;

  if (!modelName && engineName !== "openai_compatible") {
    throw new Error("Embedding model name is required");
  }

  const fetchOverride = (input: RequestInfo | URL, init?: RequestInit) => tauriFetch(input, init);

  if (engineName === "google") {
    const apiKey = authParams?.api_key ? await decryptApiKey(authParams.api_key) : "None";
    const google = createGoogleGenerativeAI({ apiKey, fetch: fetchOverride });
    return google.embeddingModel(modelName);
  }

  if (engineName === "aws_bedrock") {
    const secretKey = authParams?.aws_secret_access_key ? await decryptApiKey(authParams.aws_secret_access_key) : "None";
    const bedrock = createAmazonBedrock({
      accessKeyId: authParams?.aws_access_key_id || "",
      secretAccessKey: secretKey,
      region: authParams?.aws_region || "us-east-1",
    });
    return bedrock.embeddingModel(modelName);
  }

  if (engineName === "ollama") {
    const apiKey = authParams?.api_key ? await decryptApiKey(authParams.api_key) : undefined;
    const ollama = createOllama({
      baseURL: authParams?.base_url || "http://127.0.0.1:11434",
      apiKey,
      fetch: fetchOverride,
    });
    return ollama.embedding(modelName);
  }

  if (engineName === "openai_compatible") {
    const apiKey = authParams?.api_key ? await decryptApiKey(authParams.api_key) : "None";
    const openai = createOpenAI({
      apiKey,
      baseURL: authParams?.base_url,
      fetch: fetchOverride,
    });
    return openai.embeddingModel(modelName || "any");
  }

  // OpenAI (default)
  const apiKey = authParams?.api_key ? await decryptApiKey(authParams.api_key) : "None";
  const openai = createOpenAI({
    apiKey,
    organization: authParams?.apiOrg,
    baseURL: authParams?.base_url,
    fetch: fetchOverride,
  });
  return openai.embeddingModel(modelName);
}

export { getEmbeddingModel };

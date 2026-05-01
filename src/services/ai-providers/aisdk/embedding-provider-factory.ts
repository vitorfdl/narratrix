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

  const requireApiKey = async (): Promise<string> => {
    if (!authParams?.api_key) {
      throw new Error(`Embedding model "${modelName}" has no API key configured for engine "${engineName}"`);
    }
    return decryptApiKey(authParams.api_key);
  };

  if (engineName === "google") {
    const apiKey = await requireApiKey();
    const google = createGoogleGenerativeAI({ apiKey, fetch: fetchOverride });
    return google.embeddingModel(modelName);
  }

  if (engineName === "aws_bedrock") {
    if (!authParams?.aws_access_key_id || !authParams?.aws_secret_access_key) {
      throw new Error(`Embedding model "${modelName}" is missing AWS credentials (aws_access_key_id / aws_secret_access_key)`);
    }
    const secretKey = await decryptApiKey(authParams.aws_secret_access_key);
    const bedrock = createAmazonBedrock({
      accessKeyId: authParams.aws_access_key_id,
      secretAccessKey: secretKey,
      region: authParams?.aws_region || "us-east-1",
      fetch: fetchOverride,
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
    if (!authParams?.base_url) {
      throw new Error(`Embedding model "${modelName}" requires a base_url for engine "openai_compatible"`);
    }
    const apiKey = authParams?.api_key ? await decryptApiKey(authParams.api_key) : "";
    const openai = createOpenAI({
      apiKey,
      baseURL: authParams.base_url,
      fetch: fetchOverride,
    });
    return openai.embeddingModel(modelName || "any");
  }

  if (engineName === "openai") {
    const apiKey = await requireApiKey();
    const openai = createOpenAI({
      apiKey,
      organization: authParams?.apiOrg,
      baseURL: authParams?.base_url,
      fetch: fetchOverride,
    });
    return openai.embeddingModel(modelName);
  }

  throw new Error(`Embedding engine "${engineName}" is not supported`);
}

export { getEmbeddingModel };

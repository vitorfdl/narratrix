import { cosineSimilarity, embed, embedMany } from "ai";
import type { EmbedManyResult, EmbedResult, Embedding } from "ai";
import type { ModelSpecs } from "@/schema/inference-engine-schema";
import { getEmbeddingModel } from "./ai-providers/aisdk/embedding-provider-factory";
import { getEmbeddingManifestById } from "./manifest-service";
import { getModelById } from "./model-service";

export interface EmbedOptions {
  maxRetries?: number;
  abortSignal?: AbortSignal;
}

async function buildEmbeddingModelSpecs(modelId: string): Promise<ModelSpecs> {
  const model = await getModelById(modelId);
  if (!model) {
    throw new Error(`Embedding model not found: ${modelId}`);
  }

  if (model.type !== "embedding") {
    throw new Error(`Model ${modelId} is not an embedding model (type: ${model.type})`);
  }

  const manifest = await getEmbeddingManifestById(model.manifest_id);
  if (!manifest) {
    throw new Error(`Embedding manifest not found: ${model.manifest_id}`);
  }

  return {
    id: model.id,
    model_type: "embedding",
    config: model.config,
    max_concurrent_requests: model.max_concurrency,
    engine: manifest.engine,
  };
}

async function embedText(modelId: string, text: string, options?: EmbedOptions): Promise<EmbedResult> {
  const specs = await buildEmbeddingModelSpecs(modelId);
  const embeddingModel = await getEmbeddingModel(specs);

  return embed({
    model: embeddingModel,
    value: text,
    maxRetries: options?.maxRetries ?? 2,
    abortSignal: options?.abortSignal,
  });
}

async function embedTexts(modelId: string, texts: string[], options?: EmbedOptions & { maxParallelCalls?: number }): Promise<EmbedManyResult> {
  const specs = await buildEmbeddingModelSpecs(modelId);
  const embeddingModel = await getEmbeddingModel(specs);

  return embedMany({
    model: embeddingModel,
    values: texts,
    maxRetries: options?.maxRetries ?? 2,
    abortSignal: options?.abortSignal,
    maxParallelCalls: options?.maxParallelCalls,
  });
}

export { cosineSimilarity, embedText, embedTexts };
export type { EmbedManyResult, EmbedResult, Embedding };

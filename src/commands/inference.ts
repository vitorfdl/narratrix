import { invoke } from "@tauri-apps/api/core";
import type { Event } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import type { InferenceRequest, InferenceResponse, ModelSpecs } from "../schema/inference-engine-schema";

/**
 * Queue an inference request to be processed by the LLM
 * @param request The inference request to queue
 * @param specs The model specifications for the request
 * @returns A promise that resolves to the request ID
 */
export async function queueInferenceRequest(request: InferenceRequest, specs: ModelSpecs): Promise<string> {
  try {
    return await invoke<string>("queue_inference_request", {
      request,
      specs,
    });
  } catch (error) {
    throw new Error(`Failed to queue inference request: ${error}`);
  }
}

/**
 * Cancel an inference request that is in progress
 * @param modelId The ID of the model
 * @param requestId The ID of the request to cancel
 * @returns A promise that resolves to a boolean indicating if the cancellation was successful
 */
export async function cancelInferenceRequest(modelId: string, requestId: string): Promise<boolean> {
  try {
    return await invoke<boolean>("cancel_inference_request", {
      modelId,
      requestId,
    });
  } catch (error) {
    throw new Error(`Failed to cancel inference request: ${error}`);
  }
}

/**
 * Clean up any empty inference queues
 * @returns A promise that resolves when the operation is complete
 */
export async function cleanInferenceQueues(): Promise<void> {
  try {
    await invoke<void>("clean_inference_queues");
  } catch (error) {
    throw new Error(`Failed to clean inference queues: ${error}`);
  }
}

/**
 * Listen for inference responses from the backend
 * @param callback The callback function to handle inference responses
 * @returns A function to unlisten from inference response events
 */
export function listenForInferenceResponses(callback: (response: InferenceResponse) => void): () => Promise<void> {
  const unlisten = listen<InferenceResponse>("inference-response", (event: Event<InferenceResponse>) => {
    callback(event.payload);
  });

  // Return a function to unlisten
  return async () => {
    const unlistenFn = await unlisten;
    unlistenFn();
  };
}

type TemporaryModelType = "Llama2" | "Llama3" | "Deepseek" | "Mistral" | "DEFAULT";
export function countTokens(text: string, modelType: TemporaryModelType): Promise<{ count: number }> {
  return invoke<{ count: number }>("count_tokens", {
    text,
    modelType,
  });
}

/**
 * Safety-net timeout for non-streaming inference requests.
 * Local models (llama.cpp, Ollama, etc.) can take several minutes;
 * 5 minutes is generous while still preventing orphaned promises.
 * Users can always cancel manually via cancelWorkflow / cancelRequest.
 */
export const INFERENCE_TIMEOUT_MS = 300_000;

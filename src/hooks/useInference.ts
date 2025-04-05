import { cancelInferenceRequest, listenForInferenceResponses, queueInferenceRequest } from "@/commands/inference";
import type { InferenceMessage, InferenceResponse, ModelSpecs } from "@/schema/inference-engine-schema";
import { useCallback, useEffect, useRef, useState } from "react";

// Define types needed for inference
type InferenceStatus = "idle" | "queued" | "streaming" | "completed" | "error" | "cancelled";

interface InferenceRequestState {
  id: string;
  modelId: string;
  status: InferenceStatus;
  response: InferenceResponse | null;
  error: string | null;
  timestamp: number;
}

interface UseInferenceOptions {
  onComplete?: (response: InferenceResponse, requestId: string) => void;
  onError?: (error: string, requestId: string) => void;
  onStream?: (partialResponse: InferenceResponse, requestId: string) => void;
}

interface InferenceParams {
  messages: InferenceMessage[];
  modelSpecs: ModelSpecs;
  systemPrompt?: string;
  parameters?: Record<string, any>;
  stream?: boolean;
}

// Global listener to ensure it's only initialized once
let listenerInitialized = false;
const globalListeners = new Set<(response: InferenceResponse) => void>();
let unlisten: (() => Promise<void>) | null = null;

/**
 * Hook for managing inference requests
 */
export function useInference(options: UseInferenceOptions = {}) {
  // Track all active requests in local state
  const [requests, setRequests] = useState<Record<string, InferenceRequestState>>({});

  // Use refs for callback options to avoid unnecessary effect triggers
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Track the last seen stream chunk for each request to avoid duplicates
  const lastStreamChunks = useRef<Record<string, string>>({});

  // Initialize global listener once
  useEffect(() => {
    const setupListener = async () => {
      if (!listenerInitialized) {
        try {
          // Function to distribute events to all hooks
          const handleInferenceResponse = (response: InferenceResponse) => {
            globalListeners.forEach((listener) => {
              listener(response);
            });
          };

          unlisten = await listenForInferenceResponses(handleInferenceResponse);
          listenerInitialized = true;
          console.log("Global inference listener initialized");

          // Cleanup on window unload
          window.addEventListener("beforeunload", () => {
            if (unlisten) {
              unlisten().catch(console.error);
            }
          });
        } catch (error) {
          console.error("Failed to initialize inference listener:", error);
        }
      }
    };

    setupListener();
  }, []);

  // Register this hook's response handler
  useEffect(() => {
    const handleResponse = (response: InferenceResponse) => {
      const requestId = response.request_id;

      // Skip if this request isn't being tracked by this hook instance
      if (!requests[requestId]) {
        return;
      }

      // For streaming responses, detect duplicates using the text content
      if (response.status === "streaming" && response.result?.text) {
        // Create a unique signature for this stream chunk
        const chunkText = response.result.text;
        const chunkSignature = `${requestId}:${chunkText}`;

        // If we've seen this exact chunk before, skip it
        if (lastStreamChunks.current[requestId] === chunkSignature) {
          return;
        }

        // Update the last seen chunk for this request
        lastStreamChunks.current[requestId] = chunkSignature;

        // Call the stream callback
        optionsRef.current.onStream?.(response, requestId);
      }
      // For completion, error, or cancellation - always process
      else if (response.status === "completed") {
        // Clean up the last chunks record for this request
        delete lastStreamChunks.current[requestId];
        optionsRef.current.onComplete?.(response, requestId);
      } else if (response.status === "error" || response.status === "cancelled") {
        // Clean up the last chunks record for this request
        delete lastStreamChunks.current[requestId];
        if (response.status === "error") {
          optionsRef.current.onError?.(response.error || "Unknown error", requestId);
        } else {
          optionsRef.current.onComplete?.(response, requestId);
        }
      }

      // Update the request state regardless of the event type
      setRequests((currentRequests) => {
        return {
          ...currentRequests,
          [requestId]: {
            ...currentRequests[requestId],
            status: response.status as InferenceStatus,
            response: response,
            error: response.error || null,
          },
        };
      });
    };

    // Register this handler
    globalListeners.add(handleResponse);

    // Clean up when component unmounts
    return () => {
      globalListeners.delete(handleResponse);
    };
  }, [requests]);

  // Run inference and track the request
  const runInference = useCallback(async (params: InferenceParams) => {
    const { messages, modelSpecs, systemPrompt, parameters = {}, stream = false } = params;

    try {
      // Queue request with backend
      const requestId = await queueInferenceRequest(
        {
          id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          message_list: messages,
          system_prompt: systemPrompt,
          parameters,
          stream,
        },
        modelSpecs,
      );

      // Clear any existing tracking for this request ID
      delete lastStreamChunks.current[requestId];

      // Add to local tracking state
      setRequests((current) => ({
        ...current,
        [requestId]: {
          id: requestId,
          modelId: modelSpecs.id,
          status: "queued",
          response: null,
          error: null,
          timestamp: Date.now(),
        },
      }));

      return requestId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      optionsRef.current.onError?.(errorMessage, "queue-error");
      return null;
    }
  }, []);

  // Cancel a specific request
  const cancelRequest = useCallback(
    async (requestId: string) => {
      const request = requests[requestId];
      if (!request) {
        return false;
      }

      try {
        const success = await cancelInferenceRequest(request.modelId, requestId);

        if (success) {
          // Clean up tracking for this request
          delete lastStreamChunks.current[requestId];

          setRequests((current) => ({
            ...current,
            [requestId]: {
              ...current[requestId],
              status: "cancelled",
            },
          }));
        }

        return success;
      } catch (error) {
        console.error("Failed to cancel request:", error);
        return false;
      }
    },
    [requests],
  );

  // Cleanup old completed/cancelled/error requests
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRequests((current) => {
        const updated = { ...current };
        let changed = false;

        // Clean up requests older than 10 minutes that are no longer active
        Object.entries(updated).forEach(([id, request]) => {
          if (
            (request.status === "completed" || request.status === "error" || request.status === "cancelled") &&
            now - request.timestamp > 10 * 60 * 1000
          ) {
            delete updated[id];
            // Also clean up any stream tracking for this request
            delete lastStreamChunks.current[id];
            changed = true;
          }
        });

        return changed ? updated : current;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return {
    // Core functions
    runInference,
    cancelRequest,

    // Request data
    requests,

    // Helper methods
    getActiveRequestIds: () => {
      return Object.keys(requests).filter((id) => requests[id].status === "queued" || requests[id].status === "streaming");
    },

    getRequestById: (id: string) => {
      return requests[id] || null;
    },

    cancelAllRequests: async () => {
      const activeIds = Object.keys(requests).filter((id) => requests[id].status === "queued" || requests[id].status === "streaming");

      const results = await Promise.all(activeIds.map((id) => cancelRequest(id)));

      return results.every(Boolean);
    },
  };
}

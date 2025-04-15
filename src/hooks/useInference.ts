import { cancelInferenceRequest, listenForInferenceResponses, queueInferenceRequest } from "@/commands/inference";
import type { InferenceMessage, InferenceResponse, ModelSpecs } from "@/schema/inference-engine-schema";
import { Engine } from "@/schema/model-manifest-schema";
import { parseEngineParameters } from "@/services/inference-steps/parse-engine-parameters";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useConsoleStoreActions } from "./consoleStore";

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
  onError?: (error: any, requestId: string) => void;
  onStream?: (partialResponse: InferenceResponse, requestId: string) => void;
}

interface InferenceParams {
  messages: InferenceMessage[];
  modelSpecs: ModelSpecs;
  systemPrompt?: string;
  parameters?: Record<string, any>;
  stream?: boolean;
  requestId?: string;
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

  // Get console store actions for history tracking
  const consoleActions = useConsoleStoreActions();

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
    const handleResponse = async (response: InferenceResponse) => {
      const requestId = response.request_id;

      // Skip if this request isn't being tracked by this hook instance
      if (!requests[requestId]) {
        return;
      }

      // For streaming responses, detect duplicates using the text content
      if (response.status === "streaming" && (response.result?.text || response.result?.reasoning)) {
        // Create a unique signature for this stream chunk
        const chunkText = response.result.text || response.result.reasoning;
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
      else if (response.status === "completed" || response.status === "cancelled") {
        // Clean up the last chunks record for this request
        delete lastStreamChunks.current[requestId];
        optionsRef.current.onComplete?.(response, requestId);

        // Update the console store with the completed response
        if (response.status === "completed") {
          consoleActions.updateRequestResponse(requestId, response);
        }
      } else if (response.status === "error") {
        // Clean up the last chunks record for this request
        delete lastStreamChunks.current[requestId];
        optionsRef.current.onError?.(JSON.parse(response.error || "{}") || "Unknown error", requestId);
        consoleActions.updateRequestResponse(requestId, response);
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
  }, [requests, consoleActions]);

  // Run inference and track the request
  const runInference = useCallback(
    async (params: InferenceParams) => {
      const { messages, modelSpecs, systemPrompt, parameters = {}, stream = false, requestId: providedId } = params;

      // Use provided ID or generate a new one
      const requestId = providedId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Immediately register this request in our tracking
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

      // Clear any existing tracking for this request ID
      delete lastStreamChunks.current[requestId];

      const parsedParameters = parseEngineParameters(modelSpecs.engine as Engine, modelSpecs.config, parameters);

      try {
        // Add request to console store history
        consoleActions.addRequest({
          id: requestId,
          systemPrompt: systemPrompt || "",
          messages: messages,
          modelSpecs: modelSpecs,
          parameters: { ...parameters, ...parsedParameters },
          engine: modelSpecs.engine as Engine,
        });

        // Queue request with backend
        await queueInferenceRequest(
          {
            id: requestId,
            message_list: messages,
            system_prompt: systemPrompt,
            parameters: parsedParameters,
            stream,
          },
          modelSpecs,
        );

        return requestId;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        optionsRef.current.onError?.(errorMessage, "queue-error");
        return null;
      }
    },
    [consoleActions],
  );

  // Cancel a specific request
  const cancelRequest = useCallback(
    async (requestId: string) => {
      const request = requests[requestId];
      if (!request) {
        return false;
      }

      try {
        const success = await cancelInferenceRequest(request.modelId, requestId);
        if (!success) {
          toast.error("Failed to cancel request");
        }

        // Clean up tracking for this request
        delete lastStreamChunks.current[requestId];
        consoleActions.updateRequestResponse(requestId, {
          status: "cancelled",
          request_id: requestId,
          result: {
            text: "\n\n<Request cancelled by user>",
          },
        });

        setRequests((current) => ({
          ...current,
          [requestId]: {
            ...current[requestId],
            status: "cancelled",
          },
        }));

        return true;
      } catch (error) {
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

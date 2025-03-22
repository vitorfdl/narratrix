import { useCallback, useEffect } from "react";
import { listenForInferenceResponses } from "@/commands/inference";
import { useInferenceStore } from "@/stores/inferenceStore";
import type {
  InferenceMessage,
  InferenceResponse,
  ModelSpecs,
} from "@/schema/inference-engine";

interface UseInferenceOptions {
  onComplete?: (response: InferenceResponse, requestId: string) => void;
  onError?: (error: string, requestId: string) => void;
  onStream?: (partialResponse: InferenceResponse, requestId: string) => void;
}

// Global listener state to ensure it's only set up once for the entire app
let listenerInitialized = false;
let cleanup: (() => Promise<void>) | undefined;

// Set up the global listener for all inference responses
// This is called once for the entire application
export function setupInferenceListener() {
  if (listenerInitialized) {
    return;
  }

  // Get the store actions without triggering renders
  const { updateRequestStatus } = useInferenceStore.getState();

  // Use an async IIFE to properly handle the Promise
  (async () => {
    try {
      // Set up the listener and await the promise
      const unlisten = await listenForInferenceResponses((response) => {
        const requestId = response.request_id;

        // Get the current state of the store
        const { requests } = useInferenceStore.getState();

        // Skip if the request isn't in our store
        if (!requests[requestId]) {
          return;
        }

        // Update the store with the response
        if (response.status === "streaming") {
          updateRequestStatus(requestId, "streaming", response);
        } else if (response.status === "completed") {
          updateRequestStatus(requestId, "completed", response);
        } else if (
          response.status === "error" || response.status === "cancelled"
        ) {
          const errorMessage = response.error || "Unknown error occurred";
          updateRequestStatus(
            requestId,
            response.status,
            response,
            errorMessage,
          );
        }
      });

      // Store the cleanup function
      cleanup = unlisten;
      listenerInitialized = true;
      console.log("Global inference response listener initialized");
    } catch (error: unknown) {
      console.error("Failed to set up inference response listener:", error);
    }
  })();

  // Set up cleanup for app shutdown
  window.addEventListener("beforeunload", () => {
    if (cleanup) {
      cleanup().catch(console.error);
    }
  });
}

// Initialize the listener immediately
setupInferenceListener();

/**
 * Hook for working with inference requests.
 * Uses a global zustand store to manage all requests and a listener for inference events.
 */
export function useInference(options: UseInferenceOptions = {}) {
  // Access store state and actions
  const {
    requests,
    latestRequestId,
    queueRequest,
    cancelRequest,
  } = useInferenceStore();

  // Derive loading state and other status information
  const isLoading = latestRequestId
    ? requests[latestRequestId]?.status === "queued" ||
      requests[latestRequestId]?.status === "streaming"
    : false;

  const error = latestRequestId
    ? requests[latestRequestId]?.error || null
    : null;

  const response = latestRequestId
    ? requests[latestRequestId]?.response || null
    : null;

  // Set up effects to call the provided callbacks when request statuses change
  useEffect(() => {
    const handleRequestUpdates = () => {
      // Use for...of instead of forEach
      for (const [requestId, request] of Object.entries(requests)) {
        // Call the appropriate callback based on the request status
        if (request.status === "streaming" && request.response) {
          options.onStream?.(request.response, requestId);
        } else if (request.status === "completed" && request.response) {
          options.onComplete?.(request.response, requestId);
        } else if (request.status === "error" && request.error) {
          options.onError?.(request.error, requestId);
        }
      }
    };

    // Run once on mount to handle any existing requests
    handleRequestUpdates();

    // Set up a subscription to the store
    const unsubscribe = useInferenceStore.subscribe(handleRequestUpdates);

    return () => {
      unsubscribe();
    };
  }, [options, requests]);

  // Run inference by queuing a request through the store
  const runInference = useCallback(
    async (
      messages: InferenceMessage[],
      modelSpecs: ModelSpecs,
      systemPrompt?: string,
      parameters: Record<string, any> = {},
      stream = false,
    ) => {
      try {
        const requestId = await queueRequest(
          messages,
          modelSpecs,
          systemPrompt,
          parameters,
          stream,
        );
        console.log(`Queued inference request ${requestId}`);
        return requestId;
      } catch (err) {
        console.error("Failed to run inference:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        options.onError?.(errorMessage, "queue-error");
        return null;
      }
    },
    [queueRequest, options],
  );

  // Cancel a specific request
  const cancelInferenceRequest = useCallback(
    async (requestId: string) => {
      return await cancelRequest(requestId);
    },
    [cancelRequest],
  );

  // Cancel the most recent request (for backwards compatibility)
  const cancelInference = useCallback(
    async () => {
      if (latestRequestId) {
        return await cancelInferenceRequest(latestRequestId);
      }
      return false;
    },
    [latestRequestId, cancelInferenceRequest],
  );

  // Cancel all active requests
  const cancelAllRequests = useCallback(
    async () => {
      const activeRequestIds = Object.keys(requests).filter((id) =>
        requests[id].status === "queued" || requests[id].status === "streaming"
      );

      const results = await Promise.all(
        activeRequestIds.map((id) => cancelInferenceRequest(id)),
      );

      return results.every(Boolean);
    },
    [requests, cancelInferenceRequest],
  );

  return {
    // Core functions
    runInference,
    cancelInference,
    cancelRequest: cancelInferenceRequest,
    cancelAllRequests,

    // State
    isLoading,
    error,
    response,

    // Request info
    latestRequestId,
    activeRequestIds: Object.keys(requests).filter((id) =>
      requests[id].status === "queued" || requests[id].status === "streaming"
    ),
    activeRequestCount:
      Object.keys(requests).filter((id) =>
        requests[id].status === "queued" || requests[id].status === "streaming"
      ).length,
    requests,
  };
}

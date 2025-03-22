import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import {
  cancelInferenceRequest,
  queueInferenceRequest,
} from "@/commands/inference";
import type {
  InferenceMessage,
  InferenceRequest,
  InferenceResponse,
  ModelSpecs,
} from "@/schema/inference-engine";

// Types for our store
interface RequestStatus {
  id: string;
  modelId: string;
  status: "queued" | "streaming" | "completed" | "error" | "cancelled";
  response?: InferenceResponse | null;
  error?: string | null;
}

interface InferenceStore {
  // State
  requests: Record<string, RequestStatus>;
  latestRequestId: string | null;

  // Actions
  addRequest: (requestId: string, modelId: string) => void;
  updateRequestStatus: (
    requestId: string,
    status: RequestStatus["status"],
    response?: InferenceResponse | null,
    error?: string | null,
  ) => void;
  removeRequest: (requestId: string) => void;
  clearRequests: () => void;

  // API Operations
  queueRequest: (
    messages: InferenceMessage[],
    modelSpecs: ModelSpecs,
    systemPrompt?: string,
    parameters?: Record<string, any>,
    stream?: boolean,
  ) => Promise<string>;
  cancelRequest: (requestId: string) => Promise<boolean>;
}

export const useInferenceStore = create<InferenceStore>((set, get) => ({
  // State
  requests: {},
  latestRequestId: null,

  // Actions
  addRequest: (requestId, modelId) =>
    set((state) => ({
      requests: {
        ...state.requests,
        [requestId]: {
          id: requestId,
          modelId,
          status: "queued",
          response: null,
          error: null,
        },
      },
      latestRequestId: requestId,
    })),

  updateRequestStatus: (requestId, status, response, error) =>
    set((state) => {
      // Skip update if request doesn't exist
      if (!state.requests[requestId]) {
        return state;
      }

      return {
        requests: {
          ...state.requests,
          [requestId]: {
            ...state.requests[requestId],
            status,
            ...(response !== undefined ? { response } : {}),
            ...(error !== undefined ? { error } : {}),
          },
        },
      };
    }),

  removeRequest: (requestId) =>
    set((state) => {
      const { [requestId]: removed, ...remaining } = state.requests;
      return {
        requests: remaining,
        // If we're removing the latest request, set latestRequestId to null
        latestRequestId: state.latestRequestId === requestId
          ? null
          : state.latestRequestId,
      };
    }),

  clearRequests: () => set({ requests: {}, latestRequestId: null }),

  // API Operations
  queueRequest: async (
    messages,
    modelSpecs,
    systemPrompt,
    parameters = {},
    stream = false,
  ) => {
    const requestId = uuidv4();

    // Create the request
    const request: InferenceRequest = {
      id: requestId,
      message_list: messages,
      system_prompt: systemPrompt,
      parameters,
      stream,
    };

    // IMPORTANT: Add request to store SYNCHRONOUSLY before the async call
    // This ensures the store has the request before any events can arrive
    get().addRequest(requestId, modelSpecs.id);

    try {
      // Queue the request with the backend
      await queueInferenceRequest(request, modelSpecs);
      return requestId;
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : "Failed to queue inference request";

      // Update store with error status
      get().updateRequestStatus(requestId, "error", null, errorMessage);
      throw err;
    }
  },

  cancelRequest: async (requestId) => {
    const request = get().requests[requestId];
    if (!request) {
      return false;
    }

    try {
      const result = await cancelInferenceRequest(request.modelId, requestId);
      if (result) {
        get().updateRequestStatus(requestId, "cancelled");
      }
      return result;
    } catch (err) {
      console.error("Failed to cancel inference:", err);
      return false;
    }
  },
}));

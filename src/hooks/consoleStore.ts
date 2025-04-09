import { InferenceMessage, InferenceResponse, ModelSpecs } from "@/schema/inference-engine-schema";
import { Engine } from "@/schema/model-manifest-schema";
import { create } from "zustand";

/**
 * Represents a single inference request with all relevant data
 */
export interface ConsoleRequest {
  id: string;
  timestamp: number;
  systemPrompt: string;
  messages: InferenceMessage[];
  modelSpecs: ModelSpecs;
  parameters: Record<string, any>;
  engine: Engine;
  fullResponse?: string;
}

/**
 * Console store state interface
 */
interface ConsoleState {
  requests: ConsoleRequest[];
  actions: {
    addRequest: (request: Omit<ConsoleRequest, "timestamp">) => void;
    updateRequestResponse: (id: string, response: InferenceResponse) => void;
    clearHistory: () => void;
    getRequestById: (id: string) => ConsoleRequest | undefined;
  };
}

/**
 * Maximum number of requests to store in history
 */
const MAX_HISTORY_LENGTH = 15;

/**
 * Console store for tracking inference requests
 */
export const useConsoleStore = create<ConsoleState>((set, get) => ({
  requests: [],
  actions: {
    /**
     * Add a new request to the console history
     */
    addRequest: (request) =>
      set((state) => {
        const newRequest: ConsoleRequest = {
          ...request,
          modelSpecs: {
            ...request.modelSpecs,
            config: {},
          },
          timestamp: Date.now(),
        };

        // Add new request at the beginning and limit array to MAX_HISTORY_LENGTH
        const updatedRequests = [newRequest, ...state.requests].slice(0, MAX_HISTORY_LENGTH);

        return {
          requests: updatedRequests,
          activeRequestId: newRequest.id,
        };
      }),

    /**
     * Update a request's response by ID
     */
    updateRequestResponse: (id, inferenceResponse) =>
      set((state) => {
        const updatedRequests = state.requests.map((req) => {
          if (req.id === id) {
            let response = req.fullResponse || "";
            if (inferenceResponse.result?.full_response) {
              response = inferenceResponse.result.full_response;
            } else if (inferenceResponse.result?.text) {
              response = inferenceResponse.result.text;
            }

            return {
              ...req,
              fullResponse: response,
            };
          }
          return req;
        });

        return { requests: updatedRequests };
      }),

    /**
     * Clear all requests from history
     */
    clearHistory: () =>
      set({
        requests: [],
      }),

    /**
     * Get a specific request by ID
     */
    getRequestById: (id) => {
      return get().requests.find((req) => req.id === id);
    },
  },
}));

export const useConsoleStoreActions = () => useConsoleStore((state) => state.actions);
export const useConsoleStoreRequests = () => useConsoleStore((state) => state.requests);

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
            config: {
              model: request.modelSpecs.config?.model,
            },
          },
          timestamp: Date.now(),
        };

        // Add new request at the beginning
        const requestsWithNew = [newRequest, ...state.requests];

        // Group by model id and keep only 5 most recent per model
        const requestsByModel: Record<string, ConsoleRequest[]> = {};
        for (const req of requestsWithNew) {
          const modelId = req.modelSpecs.id;
          if (!modelId) {
            continue;
          }
          if (!requestsByModel[modelId]) {
            requestsByModel[modelId] = [];
          }
          if (requestsByModel[modelId].length < 5) {
            requestsByModel[modelId].push(req);
          }
        }

        // Flatten and preserve order (most recent first)
        const limitedRequests = Object.values(requestsByModel).flat();

        // Apply global MAX_HISTORY_LENGTH
        const updatedRequests = limitedRequests.slice(0, MAX_HISTORY_LENGTH);

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
            } else if (inferenceResponse.error) {
              response = JSON.stringify(JSON.parse(inferenceResponse.error), null, 2);
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

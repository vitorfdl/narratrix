import { create } from "zustand";
import { InferenceMessage, InferenceResponse, ModelSpecs } from "@/schema/inference-engine-schema";
import { Engine } from "@/schema/model-manifest-schema";

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

export type ConsoleLogType = "tool-call" | "node-execution" | "js-console";

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;
  type: ConsoleLogType;
  agentId?: string;
  nodeId?: string;
  nodeLabel?: string;
  title: string;
  input?: string;
  output?: string;
  error?: string;
  durationMs?: number;
}

/**
 * Console store state interface
 */
interface ConsoleState {
  requests: ConsoleRequest[];
  logs: ConsoleLogEntry[];
  actions: {
    addRequest: (request: Omit<ConsoleRequest, "timestamp">) => void;
    updateRequestResponse: (id: string, response: InferenceResponse) => void;
    clearHistory: () => void;
    getRequestById: (id: string) => ConsoleRequest | undefined;
    addLog: (entry: Omit<ConsoleLogEntry, "id" | "timestamp"> & { id?: string }) => void;
    updateLog: (id: string, updates: Partial<ConsoleLogEntry>) => void;
    clearLogs: () => void;
  };
}

/**
 * Maximum number of requests to store in history
 */
const MAX_HISTORY_LENGTH = 15;
const MAX_LOGS_LENGTH = 50;

/**
 * Console store for tracking inference requests
 */
export const useConsoleStore = create<ConsoleState>((set, get) => ({
  requests: [],
  logs: [],
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

    addLog: (entry) =>
      set((state) => {
        const newEntry: ConsoleLogEntry = {
          ...entry,
          id: entry.id ?? `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
        };
        return { logs: [newEntry, ...state.logs].slice(0, MAX_LOGS_LENGTH) };
      }),

    updateLog: (id, updates) =>
      set((state) => ({
        logs: state.logs.map((log) => (log.id === id ? { ...log, ...updates } : log)),
      })),

    clearLogs: () => set({ logs: [] }),
  },
}));

export const useConsoleStoreActions = () => useConsoleStore((state) => state.actions);
export const useConsoleStoreRequests = () => useConsoleStore((state) => state.requests);
export const useConsoleStoreLogs = () => useConsoleStore((state) => state.logs);

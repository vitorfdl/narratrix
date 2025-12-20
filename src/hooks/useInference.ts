import { useCallback, useEffect, useRef, useState } from "react";

import {
  InferenceCancelledResponse,
  InferenceCompletedResponse,
  InferenceMessage,
  InferenceResponse,
  InferenceStreamingResponse,
  InferenceToolCall,
  InferenceToolDefinition,
  ModelSpecs,
} from "@/schema/inference-engine-schema";
import { Engine } from "@/schema/model-manifest-schema";
import { callProviderConverseEndpoint } from "@/services/ai-providers/start-inference";
import type { AIEvent, AIStreamPayload } from "@/services/ai-providers/types/ai-event.type";
import type { AIProviderParams, InternalAIParameters, OpenAIToolDefinition, ToolSettings } from "@/services/ai-providers/types/request.type";
import { parseEngineParameters } from "@/services/inference/formatter/parse-engine-parameters";

import { useConsoleStoreActions } from "./consoleStore";

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
  onComplete?: (response: InferenceCompletedResponse | InferenceCancelledResponse, requestId: string) => void;
  onError?: (error: unknown, requestId: string) => void;
  onStream?: (partialResponse: InferenceStreamingResponse, requestId: string) => void;
}

interface InferenceParams {
  messages: InferenceMessage[];
  modelSpecs: ModelSpecs;
  systemPrompt?: string;
  parameters?: Record<string, unknown>;
  stream?: boolean;
  requestId?: string;
  disableLogs?: boolean;
  tools?: InferenceToolDefinition[];
}

interface RequestRuntimeState {
  modelId: string;
  accumulatedText: string;
  accumulatedReasoning: string;
  accumulatedFullResponse: string;
  toolCalls: InferenceToolCall[];
  abort?: () => void;
  cancelled: boolean;
  finished: boolean;
}

interface ConcurrencyState {
  active: number;
  queue: Array<() => void>;
}

const MAX_COMPLETED_AGE_MS = 10 * 60 * 1000; // 10 minutes

const toAIProviderParams = (modelSpecs: ModelSpecs): AIProviderParams => ({
  id: modelSpecs.id,
  model_type: modelSpecs.model_type === "completion" ? "completion" : "chat",
  engine: modelSpecs.engine as AIProviderParams["engine"],
  config: modelSpecs.config,
});

const toToolSettings = (engine: string, tools?: InferenceToolDefinition[]): ToolSettings | undefined => {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  if (engine === "openai") {
    const formattedTools: OpenAIToolDefinition[] = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || undefined,
      },
    }));
    return { tools: formattedTools };
  }

  return undefined;
};

const createStreamingResult = (payload: AIStreamPayload, state: RequestRuntimeState) => ({
  text: payload.text,
  reasoning: payload.reasoning,
  full_response: state.accumulatedFullResponse || undefined,
  tool_calls: state.toolCalls.length > 0 ? state.toolCalls : undefined,
});

const mergeToolCalls = (existing: InferenceToolCall[], incoming?: InferenceToolCall[]): InferenceToolCall[] => {
  if (!incoming || incoming.length === 0) {
    return existing;
  }

  const callMap = new Map<string, InferenceToolCall>();
  for (const call of existing) {
    if (call.id) {
      callMap.set(call.id, call);
    }
  }

  for (const call of incoming) {
    if (call.id) {
      callMap.set(call.id, call);
    } else {
      callMap.set(`${call.name}-${callMap.size}`, call);
    }
  }

  return Array.from(callMap.values());
};

export function useInference(options: UseInferenceOptions = {}) {
  const [requests, setRequests] = useState<Record<string, InferenceRequestState>>({});
  const consoleActions = useConsoleStoreActions();

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const runtimeStateRef = useRef<Record<string, RequestRuntimeState>>({});
  const concurrencyRef = useRef<Record<string, ConcurrencyState>>({});

  const updateRequestState = useCallback((requestId: string, updater: (previous: InferenceRequestState | undefined) => InferenceRequestState) => {
    setRequests((current) => {
      const previous = current[requestId];
      const next = updater(previous);
      return {
        ...current,
        [requestId]: next,
      };
    });
  }, []);

  const finalizeRequest = useCallback((requestId: string) => {
    delete runtimeStateRef.current[requestId];
  }, []);

  const releaseConcurrencySlot = useCallback((modelKey: string) => {
    const state = concurrencyRef.current[modelKey];
    if (!state) {
      return;
    }

    state.active = Math.max(0, state.active - 1);
    const next = state.queue.shift();
    if (next) {
      state.active += 1;
      next();
    }
  }, []);

  const handleStream = useCallback(
    (requestId: string, payload: AIStreamPayload) => {
      const runtime = runtimeStateRef.current[requestId];
      if (!runtime || runtime.finished) {
        return;
      }

      if (payload.text) {
        runtime.accumulatedText += payload.text;
        runtime.accumulatedFullResponse = runtime.accumulatedText;
      }

      if (payload.fullResponse) {
        runtime.accumulatedFullResponse = payload.fullResponse;
      }

      if (payload.reasoning) {
        runtime.accumulatedReasoning += payload.reasoning;
      }

      runtime.toolCalls = mergeToolCalls(runtime.toolCalls, payload.toolCalls);

      const streamingResponse: InferenceStreamingResponse = {
        request_id: requestId,
        status: "streaming",
        result: createStreamingResult(payload, runtime),
      };

      updateRequestState(requestId, (previous) => ({
        id: requestId,
        modelId: previous?.modelId || runtime.modelId,
        status: "streaming",
        response: streamingResponse,
        error: null,
        timestamp: previous?.timestamp || Date.now(),
      }));

      optionsRef.current.onStream?.(streamingResponse, requestId);
    },
    [updateRequestState],
  );

  const handleCompletion = useCallback(
    (requestId: string, payload?: AIStreamPayload) => {
      const runtime = runtimeStateRef.current[requestId];
      if (!runtime || runtime.finished) {
        return;
      }

      runtime.finished = true;

      if (payload) {
        handleStream(requestId, payload);
      }

      const result: InferenceCompletedResponse = {
        request_id: requestId,
        status: "completed",
        result: {
          text: runtime.accumulatedText || payload?.text,
          reasoning: runtime.accumulatedReasoning || payload?.reasoning,
          full_response: runtime.accumulatedFullResponse || payload?.fullResponse,
          tool_calls: runtime.toolCalls.length > 0 ? runtime.toolCalls : payload?.toolCalls,
        },
      };

      updateRequestState(requestId, (previous) => ({
        id: requestId,
        modelId: previous?.modelId || runtime.modelId,
        status: "completed",
        response: result,
        error: null,
        timestamp: previous?.timestamp || Date.now(),
      }));

      consoleActions.updateRequestResponse(requestId, result);
      optionsRef.current.onComplete?.(result, requestId);
      finalizeRequest(requestId);
    },
    [consoleActions, finalizeRequest, handleStream, updateRequestState],
  );

  const handleCancellation = useCallback(
    (requestId: string) => {
      const runtime = runtimeStateRef.current[requestId];
      if (!runtime || runtime.finished) {
        return;
      }

      runtime.finished = true;

      const result: InferenceCancelledResponse = {
        request_id: requestId,
        status: "cancelled",
        result: {
          text: runtime.accumulatedText,
          reasoning: runtime.accumulatedReasoning,
          full_response: runtime.accumulatedFullResponse,
          tool_calls: runtime.toolCalls.length > 0 ? runtime.toolCalls : undefined,
        },
        error: undefined,
      };

      updateRequestState(requestId, (previous) => ({
        id: requestId,
        modelId: previous?.modelId || runtime.modelId,
        status: "cancelled",
        response: result,
        error: null,
        timestamp: previous?.timestamp || Date.now(),
      }));

      consoleActions.updateRequestResponse(requestId, result);
      optionsRef.current.onComplete?.(result, requestId);
      finalizeRequest(requestId);
    },
    [consoleActions, finalizeRequest, updateRequestState],
  );

  const handleError = useCallback(
    (requestId: string, error: unknown) => {
      const runtime = runtimeStateRef.current[requestId];
      if (!runtime || runtime.finished) {
        return;
      }

      runtime.finished = true;

      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message || "Unknown error")
            : typeof error === "string"
              ? error
              : "Unknown error";
      const serializedError = JSON.stringify({ message: errorMessage, details: error });

      const response: InferenceResponse = {
        request_id: requestId,
        status: "error",
        error: serializedError,
      } as InferenceResponse;

      updateRequestState(requestId, (previous) => ({
        id: requestId,
        modelId: previous?.modelId || runtime.modelId,
        status: "error",
        response,
        error: errorMessage,
        timestamp: previous?.timestamp || Date.now(),
      }));

      consoleActions.updateRequestResponse(requestId, response);
      optionsRef.current.onError?.(error, requestId);
      finalizeRequest(requestId);
    },
    [consoleActions, finalizeRequest, updateRequestState],
  );

  const createEvent = useCallback(
    (requestId: string): AIEvent => ({
      requestId,
      sendStream: (payload) => handleStream(requestId, payload),
      sendThinkingStream: (text: string) => handleStream(requestId, { reasoning: text }),
      sendError: (error) => handleError(requestId, error),
      finish: (payload) => handleCompletion(requestId, payload),
      registerAborter: (aborter: () => void) => {
        const runtime = runtimeStateRef.current[requestId];
        if (runtime) {
          runtime.abort = aborter;
        }
      },
    }),
    [handleCompletion, handleError, handleStream],
  );

  const enqueueRequest = useCallback(
    async (modelKey: string, maxConcurrent: number, executor: () => Promise<void>) => {
      const state: ConcurrencyState = concurrencyRef.current[modelKey] ?? { active: 0, queue: [] };
      concurrencyRef.current[modelKey] = state;

      const run = () => {
        executor()
          .catch(() => {
            /* errors handled downstream */
          })
          .finally(() => {
            releaseConcurrencySlot(modelKey);
          });
      };

      if (state.active < maxConcurrent) {
        state.active += 1;
        run();
      } else {
        state.queue.push(() => {
          run();
        });
      }
    },
    [releaseConcurrencySlot],
  );

  const runInference = useCallback(
    async (params: InferenceParams) => {
      const { messages, modelSpecs, systemPrompt, parameters = {}, stream = false, requestId: providedId, tools, disableLogs } = params;

      const requestId = providedId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      runtimeStateRef.current[requestId] = {
        modelId: modelSpecs.id,
        accumulatedText: "",
        accumulatedReasoning: "",
        accumulatedFullResponse: "",
        toolCalls: [],
        cancelled: false,
        finished: false,
      };

      updateRequestState(requestId, () => ({
        id: requestId,
        modelId: modelSpecs.id,
        status: "queued",
        response: null,
        error: null,
        timestamp: Date.now(),
      }));

      if (!disableLogs) {
        consoleActions.addRequest({
          id: requestId,
          systemPrompt: systemPrompt || "",
          messages,
          modelSpecs,
          parameters: parameters,
          engine: modelSpecs.engine as Engine,
        });
      }

      const providerParams = toAIProviderParams(modelSpecs);
      const toolSettings = toToolSettings(modelSpecs.engine, tools);

      const internalParams: InternalAIParameters = {
        model: modelSpecs.config.model as string | undefined,
        parameters: parameters,
        max_response_tokens: parameters?.max_response_tokens as number | undefined,
        system_message: systemPrompt,
        messages,
        stream,
        tool_settings: toolSettings,
      };

      const executor = async () => {
        const runtime = runtimeStateRef.current[requestId];
        if (!runtime) {
          return;
        }

        const event = createEvent(requestId);

        try {
          await callProviderConverseEndpoint(event, providerParams, internalParams);

          if (runtime.cancelled) {
            handleCancellation(requestId);
            return;
          }

          handleCompletion(requestId);
        } catch (error) {
          if (runtime.cancelled) {
            handleCancellation(requestId);
            return;
          }

          handleError(requestId, error);
        }
      };

      await enqueueRequest(modelSpecs.id, modelSpecs.max_concurrent_requests, executor);

      return requestId;
    },
    [consoleActions, createEvent, enqueueRequest, handleCancellation, handleCompletion, handleError, updateRequestState],
  );

  const cancelRequest = useCallback(
    async (requestId: string) => {
      const runtime = runtimeStateRef.current[requestId];
      if (!runtime || runtime.finished) {
        return false;
      }

      runtime.cancelled = true;
      runtime.abort?.();

      handleCancellation(requestId);

      return true;
    },
    [handleCancellation],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRequests((current) => {
        const updated = { ...current };
        let changed = false;

        for (const [id, request] of Object.entries(updated)) {
          if ((request.status === "completed" || request.status === "error" || request.status === "cancelled") && now - request.timestamp > MAX_COMPLETED_AGE_MS) {
            delete updated[id];
            changed = true;
          }
        }

        return changed ? updated : current;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return {
    runInference,
    cancelRequest,
    requests,
    getActiveRequestIds: () => Object.keys(requests).filter((id) => requests[id]?.status === "queued" || requests[id]?.status === "streaming"),
    getRequestById: (id: string) => requests[id] || null,
    cancelAllRequests: async () => {
      const activeIds = Object.keys(requests).filter((id) => requests[id]?.status === "queued" || requests[id]?.status === "streaming");
      const results = await Promise.all(activeIds.map((id) => cancelRequest(id)));
      return results.every(Boolean);
    },
  };
}

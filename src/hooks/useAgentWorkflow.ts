import { useCallback, useMemo, useRef, useState } from "react";
import { useModelManifests } from "@/hooks/manifestStore";
import { useInference } from "@/hooks/useInference";
import { AgentType } from "@/schema/agent-schema";
import type { InferenceCancelledResponse, InferenceCompletedResponse, InferenceMessage, InferenceToolCall, InferenceToolDefinition } from "@/schema/inference-engine-schema";
import { cancelWorkflow as cancelWf, executeWorkflow as executeWf, isWorkflowRunning as isWfRunning } from "@/services/agent-workflow/runner";
import type { NodeExecutionResult, WorkflowToolDefinition } from "@/services/agent-workflow/types";
import { formatPrompt as formatPromptCore, PromptFormatterConfig } from "@/services/inference/formatter";
import { removeNestedFields } from "@/services/inference/formatter/remove-nested-fields";
import { getModelById } from "@/services/model-service";
import { getChatTemplateById } from "@/services/template-chat-service";
import { getFormatTemplateById } from "@/services/template-format-service";
import { getInferenceTemplateById } from "@/services/template-inference-service";

export interface AgentWorkflowState {
  isRunning: boolean;
  currentNodeId?: string;
  executedNodes: string[];
  error?: string;
}

/**
 * Hook for executing agent workflows with proper integration to inference service
 */
interface PendingResolver {
  resolve: (response: InferenceCompletedResponse | InferenceCancelledResponse) => void;
  reject: (error: Error) => void;
  timeout?: number;
}

const DEFAULT_TOOL_PARAMETERS = { type: "object", properties: {} } as const;
const MAX_TOOL_ITERATIONS = 15;

export function useAgentWorkflow() {
  const [workflowState, setWorkflowState] = useState<AgentWorkflowState>({
    isRunning: false,
    executedNodes: [],
  });
  const pendingResolvers = useRef<Record<string, PendingResolver>>({});

  const toInferenceToolDefinition = useCallback((tool: WorkflowToolDefinition): InferenceToolDefinition => {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? DEFAULT_TOOL_PARAMETERS,
    };
  }, []);

  const parseToolArguments = useCallback((call: InferenceToolCall): Record<string, any> => {
    if (!call?.arguments) {
      return {};
    }
    if (typeof call.arguments === "string") {
      try {
        const parsed = JSON.parse(call.arguments);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        return {};
      }
    }
    if (typeof call.arguments === "object" && !Array.isArray(call.arguments)) {
      return call.arguments as Record<string, any>;
    }
    return {};
  }, []);

  const serializeToolResult = useCallback((result: unknown): string => {
    if (typeof result === "string") {
      return result;
    }
    try {
      return JSON.stringify(result ?? null);
    } catch {
      return String(result ?? "");
    }
  }, []);

  const { runInference, cancelRequest } = useInference({
    onComplete: (response: InferenceCompletedResponse | InferenceCancelledResponse, requestId: string) => {
      const resolver = pendingResolvers.current[requestId];
      if (!resolver) {
        return;
      }
      if (resolver.timeout) {
        window.clearTimeout(resolver.timeout);
      }
      resolver.resolve(response);
      delete pendingResolvers.current[requestId];
    },
    onError: (error: any, requestId: string) => {
      const resolver = pendingResolvers.current[requestId];
      if (!resolver) {
        return;
      }
      if (resolver.timeout) {
        window.clearTimeout(resolver.timeout);
      }
      resolver.reject(new Error(error?.message || "Inference error"));
      delete pendingResolvers.current[requestId];
    },
  });
  const modelManifests = useModelManifests();

  const waitForResponse = useCallback(
    (requestId: string): Promise<InferenceCompletedResponse | InferenceCancelledResponse> => {
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          delete pendingResolvers.current[requestId];
          cancelRequest(requestId).catch(() => {});
          reject(new Error("Agent inference timed out"));
        }, 60000);
        pendingResolvers.current[requestId] = { resolve, reject, timeout };
      });
    },
    [cancelRequest],
  );

  const deps = useMemo(() => {
    return {
      formatPrompt: (config: PromptFormatterConfig) => formatPromptCore(config),
      removeNestedFields,
      getChatTemplateById,
      getModelById,
      getInferenceTemplateById,
      getFormatTemplateById,
      getManifestById: (id: string) => modelManifests.find((m) => m.id === id) || null,
      runInference: async (opts: {
        messages: InferenceMessage[];
        modelSpecs: { id: string; model_type: "chat" | "completion"; config: any; max_concurrent_requests: number; engine: string };
        systemPrompt?: string;
        parameters?: Record<string, any>;
        stream?: boolean;
        toolset?: WorkflowToolDefinition[];
      }): Promise<string | null> => {
        const toolset = opts.toolset ?? [];
        const toolDefinitions: InferenceToolDefinition[] = toolset.map(toInferenceToolDefinition);
        let conversation: InferenceMessage[] = opts.messages.map((message) => ({ ...message }));
        let iterations = 0;

        while (iterations < MAX_TOOL_ITERATIONS) {
          const requestId = await runInference({
            messages: conversation,
            modelSpecs: opts.modelSpecs,
            systemPrompt: opts.systemPrompt,
            parameters: opts.parameters,
            stream: false,
            tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
          });

          if (!requestId) {
            return null;
          }

          const response = await waitForResponse(requestId);
          if (response.status === "cancelled") {
            throw new Error("Inference request cancelled");
          }

          const completion = response as InferenceCompletedResponse;
          const result = completion.result || {};
          const responseText: string | null = result?.full_response || result?.text || null;
          const toolCalls: InferenceToolCall[] = Array.isArray(result?.tool_calls) ? (result.tool_calls as InferenceToolCall[]) : [];

          if (toolCalls.length === 0) {
            return responseText;
          }

          if (toolset.length === 0) {
            throw new Error("Model requested tool calls but no toolset is available");
          }

          const timestamp = Date.now();
          const assistantToolCalls = toolCalls.map((call, index) => {
            const callId = call.id ?? `${call.name}-${timestamp}-${index}`;
            return { ...call, id: callId };
          });
          const assistantMessage: InferenceMessage = {
            role: "assistant",
            text: responseText || "",
            tool_calls: assistantToolCalls,
          };
          conversation = [...conversation, assistantMessage];

          for (const call of assistantToolCalls) {
            const matchingTool = toolset.find((tool) => tool.name === call.name);
            if (!matchingTool) {
              throw new Error(`No registered tool found for ${call.name}`);
            }

            const args = parseToolArguments(call);
            let toolResult: unknown;
            try {
              toolResult = await matchingTool.invoke(args);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              throw new Error(`Tool ${matchingTool.name} execution failed: ${message}`);
            }

            const toolCallId = call.id || `${matchingTool.name}-${timestamp}-${Math.random().toString(36).slice(2)}`;
            const toolMessage: InferenceMessage = {
              role: "tool",
              text: serializeToolResult(toolResult),
              tool_call_id: toolCallId,
              // name: matchingTool.name,
            };
            conversation = [...conversation, toolMessage];
          }

          iterations += 1;
        }

        throw new Error("Maximum tool execution depth exceeded");
      },
    } as const;
  }, [runInference, waitForResponse, modelManifests, parseToolArguments, serializeToolResult, toInferenceToolDefinition]);

  /**
   * Execute an agent workflow
   */
  const executeWorkflow = useCallback(
    async (agent: AgentType, initialInput?: string, onProgress?: (nodeId: string, result: NodeExecutionResult) => void): Promise<string | null> => {
      setWorkflowState({
        isRunning: true,
        executedNodes: [],
        currentNodeId: undefined,
        error: undefined,
      });

      try {
        const result = await executeWf(agent, initialInput, deps, (nodeId: string, result: NodeExecutionResult) => {
          setWorkflowState((prev) => ({
            ...prev,
            currentNodeId: nodeId,
            executedNodes: [...prev.executedNodes, nodeId],
          }));
          onProgress?.(nodeId, result);
        });

        setWorkflowState((prev) => ({
          ...prev,
          isRunning: false,
          currentNodeId: undefined,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setWorkflowState((prev) => ({
          ...prev,
          isRunning: false,
          currentNodeId: undefined,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [deps],
  );

  /**
   * Cancel workflow execution
   */
  const cancelWorkflow = useCallback((agentId: string) => {
    cancelWf(agentId);
    setWorkflowState((prev) => ({
      ...prev,
      isRunning: false,
      currentNodeId: undefined,
    }));
  }, []);

  /**
   * Check if a specific workflow is running
   */
  const isWorkflowRunning = useCallback((agentId: string) => {
    return isWfRunning(agentId);
  }, []);

  return {
    workflowState,
    executeWorkflow,
    cancelWorkflow,
    isWorkflowRunning,
  };
}

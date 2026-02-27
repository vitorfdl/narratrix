import { useCallback, useMemo, useRef, useState } from "react";
import type { ConsoleLogEntry } from "@/hooks/consoleStore";
import { useConsoleStore } from "@/hooks/consoleStore";
import { useModelManifests } from "@/hooks/manifestStore";
import { type ExecutableToolDefinition, useInference } from "@/hooks/useInference";
import type { AgentType, TriggerContext } from "@/schema/agent-schema";
import type { InferenceCancelledResponse, InferenceCompletedResponse } from "@/schema/inference-engine-schema";
import { cancelWorkflow as cancelWf, executeWorkflow as executeWf, isWorkflowRunning as isWfRunning } from "@/services/agent-workflow/runner";
import type { NodeExecutionResult, WorkflowToolDefinition } from "@/services/agent-workflow/types";

export type { TriggerContext };

import { getCharacterById } from "@/services/character-service";
import { getChatById } from "@/services/chat-service";
import { formatPrompt as formatPromptCore, type PromptFormatterConfig } from "@/services/inference/formatter";
import { removeNestedFields } from "@/services/inference/formatter/remove-nested-fields";
import { getModelById } from "@/services/model-service";
import { getChatTemplateById } from "@/services/template-chat-service";
import { getFormatTemplateById } from "@/services/template-format-service";
import { getInferenceTemplateById } from "@/services/template-inference-service";
import { useAgentWorkflowStore } from "./agentWorkflowStore";

// Re-export from the store so consumers can import from one place
export type { AgentWorkflowState } from "./agentWorkflowStore";

/**
 * Hook for executing agent workflows with proper integration to inference service
 */
interface PendingResolver {
  resolve: (response: InferenceCompletedResponse | InferenceCancelledResponse) => void;
  reject: (error: Error) => void;
  timeout?: number;
}

export function useAgentWorkflow() {
  const [workflowState, setWorkflowState] = useState<import("./agentWorkflowStore").AgentWorkflowState>({
    isRunning: false,
    executedNodes: [],
  });
  const pendingResolvers = useRef<Record<string, PendingResolver>>({});
  const { setAgentState, clearAgentState } = useAgentWorkflowStore();

  /**
   * Wraps a WorkflowToolDefinition's invoke function with console logging and
   * converts it to an ExecutableToolDefinition ready for the AI SDK.
   */
  const toExecutableTool = useCallback((tool: WorkflowToolDefinition): ExecutableToolDefinition => {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
      execute: async (args: Record<string, any>): Promise<unknown> => {
        const toolLogId = `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const toolStartTime = Date.now();

        useConsoleStore.getState().actions.addLog({
          id: toolLogId,
          type: "tool-call",
          title: `Tool: ${tool.name}`,
          nodeLabel: tool.name,
          input: JSON.stringify(args, null, 2),
        });

        try {
          const result = await tool.invoke(args);
          useConsoleStore.getState().actions.updateLog(toolLogId, {
            output: typeof result === "string" ? result : JSON.stringify(result),
            durationMs: Date.now() - toolStartTime,
          });
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          useConsoleStore.getState().actions.updateLog(toolLogId, {
            error: message,
            durationMs: Date.now() - toolStartTime,
          });
          throw new Error(`Tool ${tool.name} execution failed: ${message}`);
        }
      },
    };
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
      getCharacterById,
      getChatById,
      getManifestById: (id: string) => modelManifests.find((m) => m.id === id) || null,
      onLog: (entry: Omit<ConsoleLogEntry, "id" | "timestamp"> & { id?: string }) => {
        useConsoleStore.getState().actions.addLog(entry);
      },
      runInference: async (opts: {
        messages: import("@/schema/inference-engine-schema").InferenceMessage[];
        modelSpecs: { id: string; model_type: "chat" | "completion"; config: any; max_concurrent_requests: number; engine: string };
        systemPrompt?: string;
        parameters?: Record<string, any>;
        stream?: boolean;
        toolset?: WorkflowToolDefinition[];
      }): Promise<string | null> => {
        const executableTools: ExecutableToolDefinition[] = (opts.toolset ?? []).map(toExecutableTool);

        const requestId = await runInference({
          messages: opts.messages,
          modelSpecs: opts.modelSpecs,
          systemPrompt: opts.systemPrompt,
          parameters: opts.parameters,
          stream: false,
          tools: executableTools.length > 0 ? executableTools : undefined,
        });

        if (!requestId) {
          return null;
        }

        const response = await waitForResponse(requestId);
        if (response.status === "cancelled") {
          return null;
        }

        const completion = response as InferenceCompletedResponse;
        const result = completion.result || {};
        return result?.full_response || result?.text || null;
      },
    } as const;
  }, [runInference, waitForResponse, modelManifests, toExecutableTool]);

  /**
   * Execute an agent workflow.
   * State changes are written to both the local hook state (backward compat) and
   * the global agentWorkflowStore so other components (e.g. WidgetParticipants)
   * can subscribe to the same execution, regardless of which component initiated it.
   */
  const executeWorkflow = useCallback(
    async (agent: AgentType, triggerContext?: TriggerContext | string, onProgress?: (nodeId: string, result: NodeExecutionResult) => void): Promise<string | null> => {
      const startState = { isRunning: true, executedNodes: [] as string[], currentNodeId: undefined, error: undefined };
      setWorkflowState(startState);
      setAgentState(agent.id, startState);

      try {
        const result = await executeWf(agent, triggerContext, deps, (nodeId: string, nodeResult: NodeExecutionResult) => {
          setWorkflowState((prev) => {
            const next = { ...prev, currentNodeId: nodeId, executedNodes: [...prev.executedNodes, nodeId] };
            setAgentState(agent.id, next);
            return next;
          });
          onProgress?.(nodeId, nodeResult);
        });

        setWorkflowState((prev) => {
          const next = { ...prev, isRunning: false, currentNodeId: undefined };
          setAgentState(agent.id, next);
          return next;
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setWorkflowState((prev) => {
          const next = { ...prev, isRunning: false, currentNodeId: undefined, error: errorMessage };
          setAgentState(agent.id, next);
          return next;
        });
        throw error;
      } finally {
        // Ensure the store is cleaned up after a short delay so the UI can
        // display the final state before the card reverts to idle.
        setTimeout(() => clearAgentState(agent.id), 500);
      }
    },
    [deps, setAgentState, clearAgentState],
  );

  /**
   * Cancel workflow execution.
   * Sets the runner flag to prevent future nodes from executing, and immediately
   * cancels any in-flight inference request so the backend stops generating and
   * waitForResponse returns right away instead of waiting for LLM completion.
   */
  const cancelWorkflow = useCallback(
    (agentId: string) => {
      cancelWf(agentId);

      // Resolve all pending inference resolvers as "cancelled" so waitForResponse
      // returns immediately, then send the backend cancellation signal.
      const pendingIds = Object.keys(pendingResolvers.current);
      for (const requestId of pendingIds) {
        cancelRequest(requestId).catch(() => {});
        const resolver = pendingResolvers.current[requestId];
        if (resolver) {
          if (resolver.timeout) {
            window.clearTimeout(resolver.timeout);
          }
          resolver.resolve({ status: "cancelled" } as import("@/schema/inference-engine-schema").InferenceCancelledResponse);
          delete pendingResolvers.current[requestId];
        }
      }

      setWorkflowState((prev) => {
        const next = { ...prev, isRunning: false, currentNodeId: undefined };
        setAgentState(agentId, next);
        return next;
      });
    },
    [cancelRequest, setAgentState],
  );

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

import { useCallback, useMemo, useRef, useState } from "react";
import type { ConsoleLogEntry, NodeExecutionEntry } from "@/hooks/consoleStore";
import { useConsoleStore } from "@/hooks/consoleStore";
import { useModelManifests } from "@/hooks/manifestStore";
import { type ExecutableToolDefinition, useInference } from "@/hooks/useInference";
import { useUserChoiceStore } from "@/hooks/userChoiceStore";
import type { AgentType, TriggerContext } from "@/schema/agent-schema";
import type { InferenceCancelledResponse, InferenceCompletedResponse } from "@/schema/inference-engine-schema";
import { cancelWorkflow as cancelWf, executeWorkflow as executeWf, isWorkflowRunning as isWfRunning } from "@/services/agent-workflow/runner";
import type { NodeExecutionResult, WorkflowToolDefinition } from "@/services/agent-workflow/types";

export type { TriggerContext };

import { INFERENCE_TIMEOUT_MS } from "@/services/ai-providers/constants";
import { getCharacterById } from "@/services/character-service";
import { getChatChapterById } from "@/services/chat-chapter-service";
import { getChatById } from "@/services/chat-service";
import { formatPrompt as formatPromptCore, type PromptFormatterConfig } from "@/services/inference/formatter";
import { removeNestedFields } from "@/services/inference/formatter/remove-nested-fields";
import { playBeepSound } from "@/services/inference/utils";
import { getModelById } from "@/services/model-service";
import { getChatTemplateById } from "@/services/template-chat-service";
import { getFormatTemplateById } from "@/services/template-format-service";
import { getInferenceTemplateById } from "@/services/template-inference-service";
import { makeRunKey, useAgentWorkflowStore } from "./agentWorkflowStore";
import { useProfileStore } from "./ProfileStore";

// Re-export from the store so consumers can import from one place
export type { AgentWorkflowState } from "./agentWorkflowStore";

/**
 * Hook for executing agent workflows with proper integration to inference service
 */
interface PendingResolver {
  runKey: string;
  resolve: (response: InferenceCompletedResponse | InferenceCancelledResponse) => void;
  reject: (error: Error) => void;
  timeout?: number;
}

export function useAgentWorkflow() {
  const [workflowState, setWorkflowState] = useState<import("./agentWorkflowStore").AgentWorkflowState>({
    agentId: "",
    isRunning: false,
    executedNodes: [],
  });
  const pendingResolvers = useRef<Record<string, PendingResolver>>({});
  const currentAgentRunLogIdRef = useRef<string | undefined>(undefined);
  const currentNodeExecIdRef = useRef<string | undefined>(undefined);
  const cancelWorkflowRef = useRef<(runKey: string) => void>(() => {});
  const { setAgentState, clearAgentState, registerCancelFn, unregisterCancelFn } = useAgentWorkflowStore();

  /**
   * Wraps a WorkflowToolDefinition's invoke function with console logging and
   * converts it to an ExecutableToolDefinition ready for the AI SDK.
   *
   * When both an agent-run log and a node execution are active, tool calls are
   * nested inside the node execution entry. Otherwise falls back to standalone log entries.
   */
  const toExecutableTool = useCallback((tool: WorkflowToolDefinition): ExecutableToolDefinition => {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
      execute: async (args: Record<string, any>): Promise<unknown> => {
        const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const toolStartTime = Date.now();
        const agentRunLogId = currentAgentRunLogIdRef.current;
        const nodeExecId = currentNodeExecIdRef.current;
        const { actions } = useConsoleStore.getState();

        if (agentRunLogId && nodeExecId) {
          actions.addToolCallToNodeExec(agentRunLogId, nodeExecId, {
            id: toolCallId,
            toolName: tool.name,
            input: JSON.stringify(args, null, 2),
            timestamp: Date.now(),
          });
        } else {
          actions.addLog({
            id: toolCallId,
            type: "tool-call",
            title: `Tool: ${tool.name}`,
            nodeLabel: tool.name,
            input: JSON.stringify(args, null, 2),
          });
        }

        try {
          const result = await tool.invoke(args);
          const updates = {
            output: typeof result === "string" ? result : JSON.stringify(result),
            durationMs: Date.now() - toolStartTime,
          };
          if (agentRunLogId && nodeExecId) {
            actions.updateToolCallInNodeExec(agentRunLogId, nodeExecId, toolCallId, updates);
          } else {
            actions.updateLog(toolCallId, updates);
          }
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const updates = { error: message, durationMs: Date.now() - toolStartTime };
          if (agentRunLogId && nodeExecId) {
            actions.updateToolCallInNodeExec(agentRunLogId, nodeExecId, toolCallId, updates);
          } else {
            actions.updateLog(toolCallId, updates);
          }
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
    (requestId: string, runKey: string): Promise<InferenceCompletedResponse | InferenceCancelledResponse> => {
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          delete pendingResolvers.current[requestId];
          cancelRequest(requestId).catch(() => {});
          reject(new Error("Agent inference timed out"));
        }, INFERENCE_TIMEOUT_MS);
        pendingResolvers.current[requestId] = { runKey, resolve, reject, timeout };
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
      getChatChapterById,
      getManifestById: (id: string) => modelManifests.find((m) => m.id === id) || null,
      onLog: (entry: Omit<ConsoleLogEntry, "id" | "timestamp"> & { id?: string }): string | undefined => {
        useConsoleStore.getState().actions.addLog(entry);
        if (entry.type === "agent-run" && entry.id) {
          currentAgentRunLogIdRef.current = entry.id;
        }
        return entry.id;
      },
      onUpdateLog: (id: string, updates: Partial<ConsoleLogEntry>) => {
        useConsoleStore.getState().actions.updateLog(id, updates);
      },
      onAddNodeExecution: (agentRunLogId: string, entry: NodeExecutionEntry) => {
        useConsoleStore.getState().actions.addNodeExecutionToLog(agentRunLogId, entry);
        currentNodeExecIdRef.current = entry.id;
      },
      onUpdateNodeExecution: (agentRunLogId: string, nodeExecId: string, updates: Partial<NodeExecutionEntry>) => {
        useConsoleStore.getState().actions.updateNodeExecutionInLog(agentRunLogId, nodeExecId, updates);
        if (currentNodeExecIdRef.current === nodeExecId) {
          currentNodeExecIdRef.current = undefined;
        }
      },
      runInference: async (opts: {
        messages: import("@/schema/inference-engine-schema").InferenceMessage[];
        modelSpecs: { id: string; model_type: "chat" | "completion"; config: any; max_concurrent_requests: number; engine: string };
        systemPrompt?: string;
        parameters?: Record<string, any>;
        stream?: boolean;
        toolset?: WorkflowToolDefinition[];
        runKey?: string;
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

        const response = await waitForResponse(requestId, opts.runKey ?? "global");
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
   * State is scoped to a runKey = "${chatId ?? "global"}::${agentId}" so the same
   * agent running in different chats gets independent state entries in the store.
   */
  const executeWorkflow = useCallback(
    async (agent: AgentType, triggerContext?: TriggerContext | string, onProgress?: (nodeId: string, result: NodeExecutionResult) => void): Promise<string | null> => {
      const chatId = typeof triggerContext === "object" && triggerContext !== null ? triggerContext.chatId : undefined;
      const runKey = makeRunKey(agent.id, chatId);

      const startState = { agentId: agent.id, chatId, isRunning: true, executedNodes: [] as string[], currentNodeId: undefined, error: undefined };
      setWorkflowState(startState);
      setAgentState(runKey, startState);
      registerCancelFn(runKey, () => cancelWorkflowRef.current(runKey));

      try {
        const result = await executeWf(agent, triggerContext, deps, (nodeId: string, nodeResult: NodeExecutionResult) => {
          setWorkflowState((prev) => {
            const next = { ...prev, currentNodeId: nodeId, executedNodes: [...prev.executedNodes, nodeId] };
            setAgentState(runKey, next);
            return next;
          });
          onProgress?.(nodeId, nodeResult);
        });

        setWorkflowState((prev) => {
          const next = { ...prev, isRunning: false, currentNodeId: undefined };
          setAgentState(runKey, next);
          return next;
        });

        const agentBeepSound = useProfileStore.getState().currentProfile?.settings?.chat?.agentBeepSound;
        if (agentBeepSound) {
          playBeepSound(agentBeepSound);
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setWorkflowState((prev) => {
          const next = { ...prev, isRunning: false, currentNodeId: undefined, error: errorMessage };
          setAgentState(runKey, next);
          return next;
        });
        throw error;
      } finally {
        currentAgentRunLogIdRef.current = undefined;
        currentNodeExecIdRef.current = undefined;
        unregisterCancelFn(runKey);
        // Ensure the store is cleaned up after a short delay so the UI can
        // display the final state before the card reverts to idle.
        setTimeout(() => clearAgentState(runKey), 500);
      }
    },
    [deps, setAgentState, clearAgentState, registerCancelFn, unregisterCancelFn],
  );

  /**
   * Cancel workflow execution identified by runKey.
   * Sets the runner flag to prevent future nodes from executing, and immediately
   * cancels any in-flight inference request so the backend stops generating and
   * waitForResponse returns right away instead of waiting for LLM completion.
   */
  const cancelWorkflow = useCallback(
    (runKey: string) => {
      cancelWf(runKey);

      useUserChoiceStore.getState().actions.cancelChoicesForRun(runKey);

      // Resolve all pending inference resolvers as "cancelled" so waitForResponse
      // returns immediately, then send the backend cancellation signal.
      const pendingIds = Object.entries(pendingResolvers.current)
        .filter(([, resolver]) => resolver.runKey === runKey)
        .map(([requestId]) => requestId);
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
        setAgentState(runKey, next);
        return next;
      });
    },
    [cancelRequest, setAgentState],
  );

  cancelWorkflowRef.current = cancelWorkflow;

  const isWorkflowRunning = useCallback((runKey: string) => {
    return isWfRunning(runKey);
  }, []);

  return {
    workflowState,
    executeWorkflow,
    cancelWorkflow,
    isWorkflowRunning,
  };
}

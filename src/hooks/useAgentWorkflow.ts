import { useCallback, useMemo, useRef, useState } from "react";
import { useModelManifests } from "@/hooks/manifestStore";
import { useInference } from "@/hooks/useInference";
import { AgentType } from "@/schema/agent-schema";
import type { InferenceCancelledResponse, InferenceCompletedResponse } from "@/schema/inference-engine-schema";
import { cancelWorkflow as cancelWf, executeWorkflow as executeWf, isWorkflowRunning as isWfRunning } from "@/services/agent-workflow/runner";
import type { NodeExecutionResult } from "@/services/agent-workflow/types";
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
export function useAgentWorkflow() {
  const [workflowState, setWorkflowState] = useState<AgentWorkflowState>({
    isRunning: false,
    executedNodes: [],
  });
  const pendingResolvers = useRef<Record<string, { resolve: (text: string | null) => void; reject: (error: Error) => void; timeout?: number }>>({});

  const { runInference, cancelRequest } = useInference({
    onComplete: (response: InferenceCompletedResponse | InferenceCancelledResponse, requestId: string) => {
      const resolver = pendingResolvers.current[requestId];
      if (!resolver) {
        return;
      }
      const text = (response as InferenceCompletedResponse).result?.full_response || (response as InferenceCompletedResponse).result?.text || null;
      if (resolver.timeout) {
        window.clearTimeout(resolver.timeout);
      }
      resolver.resolve(text);
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

  const deps = useMemo(() => {
    return {
      formatPrompt: (config: PromptFormatterConfig) => formatPromptCore(config),
      removeNestedFields,
      getChatTemplateById,
      getModelById,
      getInferenceTemplateById,
      getFormatTemplateById,
      getManifestById: (id: string) => modelManifests.find((m) => m.id === id) || null,
      runInference: async (opts: { messages: any[]; modelSpecs: any; systemPrompt?: string; parameters?: Record<string, any>; stream?: boolean }): Promise<string | null> => {
        // Force non-streaming and resolve to final text
        const requestId = await runInference({
          messages: opts.messages,
          modelSpecs: opts.modelSpecs,
          systemPrompt: opts.systemPrompt,
          parameters: opts.parameters,
          stream: false,
        });
        if (!requestId) {
          return null;
        }
        return new Promise<string | null>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            delete pendingResolvers.current[requestId];
            cancelRequest(requestId).catch(() => {});
            reject(new Error("Agent inference timed out"));
          }, 60000);
          pendingResolvers.current[requestId] = { resolve, reject, timeout };
        });
      },
    } as const;
  }, [runInference, cancelRequest, modelManifests]);

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

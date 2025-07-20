import { AgentType } from "@/schema/agent-schema";
import { NodeExecutionResult, agentWorkflowService } from "@/services/agent-workflow-service";
import { useInferenceService } from "@/services/inference-service";
import { useCallback, useState } from "react";

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

  const inferenceService = useInferenceService();

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
        const result = await agentWorkflowService.executeWorkflow(agent, initialInput, (nodeId, result) => {
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
    [inferenceService],
  );

  /**
   * Cancel workflow execution
   */
  const cancelWorkflow = useCallback((agentId: string) => {
    agentWorkflowService.cancelWorkflow(agentId);
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
    return agentWorkflowService.isWorkflowRunning(agentId);
  }, []);

  return {
    workflowState,
    executeWorkflow,
    cancelWorkflow,
    isWorkflowRunning,
  };
}

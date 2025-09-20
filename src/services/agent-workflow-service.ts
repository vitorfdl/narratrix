import type { AgentType } from "@/schema/agent-schema";
import { cancelWorkflow, executeWorkflow, isWorkflowRunning } from "@/services/agent-workflow/runner";
import type { NodeExecutionResult, WorkflowExecutionContext } from "@/services/agent-workflow/types";

// Backwards-compatible adapter over the new functional workflow engine
// Kept to avoid refactors in existing imports.

export type { NodeExecutionResult, WorkflowExecutionContext };

export const agentWorkflowService = {
  async executeWorkflow(agent: AgentType, initialInput?: string, onNodeExecuted?: (nodeId: string, result: NodeExecutionResult) => void): Promise<string | null> {
    return executeWorkflow(agent, initialInput, undefined, onNodeExecuted);
  },

  cancelWorkflow(agentId: string) {
    return cancelWorkflow(agentId);
  },

  isWorkflowRunning(agentId: string): boolean {
    return isWorkflowRunning(agentId);
  },
};

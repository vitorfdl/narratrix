import type { AgentType } from "@/schema/agent-schema";
import { cancelWorkflow, executeWorkflow, isWorkflowRunning } from "@/services/agent-workflow/runner";
import type { NodeExecutionResult, WorkflowExecutionContext } from "@/services/agent-workflow/types";

// Backwards-compatible adapter over the new functional workflow engine.
// Legacy callers pass no chatId, so runKey defaults to "global::<agentId>".

export type { NodeExecutionResult, WorkflowExecutionContext };

export const agentWorkflowService = {
  async executeWorkflow(agent: AgentType, initialInput?: string, onNodeExecuted?: (nodeId: string, result: NodeExecutionResult) => void): Promise<string | null> {
    return executeWorkflow(agent, initialInput, undefined, onNodeExecuted);
  },

  cancelWorkflow(agentId: string) {
    return cancelWorkflow(`global::${agentId}`);
  },

  isWorkflowRunning(agentId: string): boolean {
    return isWorkflowRunning(`global::${agentId}`);
  },
};

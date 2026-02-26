import "@/pages/agents/components/tool-nodes";
import { NodeRegistry } from "@/pages/agents/components/tool-components/node-registry";
import type { AgentEdgeType, AgentNodeType, AgentType, TriggerContext } from "@/schema/agent-schema";
import { getNodeInputs } from "./handles";
import type { NodeExecutionResult, WorkflowDeps, WorkflowExecutionContext } from "./types";

const contexts = new Map<string, WorkflowExecutionContext>();

function getTopologicalOrder(nodes: AgentNodeType[], edges: AgentEdgeType[]): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];

  function visit(nodeId: string): void {
    if (visiting.has(nodeId)) {
      throw new Error(`Circular dependency detected involving node ${nodeId}`);
    }
    if (visited.has(nodeId)) {
      return;
    }
    visiting.add(nodeId);
    const deps = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    for (const dep of deps) {
      visit(dep);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    result.push(nodeId);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      visit(n.id);
    }
  }
  return result;
}

async function executeNode(node: AgentNodeType, edges: AgentEdgeType[], context: WorkflowExecutionContext, agent: AgentType, deps: WorkflowDeps): Promise<NodeExecutionResult> {
  const baseInputs = getNodeInputs(node, edges, context.nodeValues);
  const executor = NodeRegistry.getExecutor(node.type);
  if (!executor) {
    return { success: false, error: `No executor registered for node type: ${node.type}` };
  }

  const res = await executor(node, baseInputs, context, agent, deps);
  // Preserve multi-output behavior for javascript nodes by reflecting onto handle-scoped keys
  if (node.type === "javascript" && res.success) {
    if (typeof res.value === "string") {
      // Execution mode returned text
      context.nodeValues.set(`${node.id}::out-string`, res.value);
      context.nodeValues.set(`${node.id}::out-toolset`, []);
    } else if (Array.isArray(res.value)) {
      // Toolset mode returned an array of tools
      context.nodeValues.set(`${node.id}::out-toolset`, res.value);
      context.nodeValues.set(`${node.id}::out-string`, undefined);
    } else if (res.value && typeof res.value === "object") {
      // Backward compatibility: support { toolset, text }
      const v: any = res.value;
      const toolset = Array.isArray(v.toolset) ? v.toolset : [];
      const text = typeof v.text === "string" ? v.text : undefined;
      context.nodeValues.set(`${node.id}::out-toolset`, toolset);
      context.nodeValues.set(`${node.id}::out-string`, text);
    }
  }
  return res;
}

export async function executeWorkflow(
  agent: AgentType,
  triggerContext?: TriggerContext | string,
  deps?: WorkflowDeps,
  onNodeExecuted?: (nodeId: string, result: NodeExecutionResult) => void,
): Promise<string | null> {
  const context: WorkflowExecutionContext = {
    agentId: agent.id,
    nodeValues: new Map(),
    executedNodes: new Set(),
    isRunning: true,
  };
  contexts.set(agent.id, context);

  try {
    // Normalize triggerContext: accept legacy string (backward compat) or typed TriggerContext
    if (typeof triggerContext === "string") {
      if (triggerContext.length > 0) {
        context.nodeValues.set("workflow-input", triggerContext);
      }
      context.nodeValues.set("workflow-trigger-context", { type: "manual", message: triggerContext } satisfies TriggerContext);
    } else if (triggerContext) {
      context.nodeValues.set("workflow-trigger-context", triggerContext);
      if (triggerContext.message) {
        context.nodeValues.set("workflow-input", triggerContext.message);
      }
    }

    const order = getTopologicalOrder(agent.nodes, agent.edges);
    for (const nodeId of order) {
      if (!context.isRunning) {
        break;
      }
      const node = agent.nodes.find((n) => n.id === nodeId);
      if (!node) {
        continue;
      }
      context.currentNodeId = nodeId;
      const result = await executeNode(node, agent.edges, context, agent, deps!);
      if (onNodeExecuted) {
        onNodeExecuted(nodeId, result);
      }
      if (!result.success) {
        throw new Error(result.error || `Node ${nodeId} failed`);
      }
      if (result.value !== undefined) {
        context.nodeValues.set(nodeId, result.value);
      }
    }

    const outputs = agent.nodes.filter((n) => n.type === "chatOutput");
    if (outputs.length > 0) {
      const outId = outputs[0].id;
      const val = context.nodeValues.get(outId) || null;
      return val;
    }
    return null;
  } finally {
    context.isRunning = false;
    contexts.delete(agent.id);
  }
}

export function cancelWorkflow(agentId: string): void {
  const ctx = contexts.get(agentId);
  if (ctx) {
    ctx.isRunning = false;
  }
}

export function isWorkflowRunning(agentId: string): boolean {
  const ctx = contexts.get(agentId);
  return ctx ? ctx.isRunning : false;
}

import "@/pages/agents/components/tool-nodes";
import { NodeRegistry } from "@/pages/agents/components/tool-components/node-registry";
import type { AgentEdgeType, AgentNodeType, AgentType, TriggerContext } from "@/schema/agent-schema";
import { getNodeInputs } from "./handles";
import type { NodeExecutionResult, WorkflowDeps, WorkflowExecutionContext } from "./types";

const contexts = new Map<string, WorkflowExecutionContext>();

function makeRunKey(agentId: string, chatId?: string | null): string {
  return `${chatId ?? "global"}::${agentId}`;
}

const MAX_OUTPUT_LEN = 200;

function formatNodeOutput(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value.slice(0, MAX_OUTPUT_LEN);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return undefined;
    }
    const hasNames = value.every((v) => v && typeof v === "object" && "name" in v);
    if (hasNames) {
      return `[${value.map((v) => v.name).join(", ")}]`;
    }
    return `Array(${value.length})`;
  }
  try {
    return JSON.stringify(value).slice(0, MAX_OUTPUT_LEN);
  } catch {
    return String(value).slice(0, MAX_OUTPUT_LEN);
  }
}

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
  // Preserve multi-output behavior for nodes with dynamic outputs by reflecting onto handle-scoped keys
  if ((node.type === "javascript" || node.type === "userChoice" || node.type === "searchLorebook" || node.type === "addLorebookEntry") && res.success) {
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
  const chatId = typeof triggerContext === "object" && triggerContext !== null ? triggerContext.chatId : undefined;
  const runKey = makeRunKey(agent.id, chatId);

  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const context: WorkflowExecutionContext = {
    agentId: agent.id,
    runKey,
    chatId,
    executionId,
    nodeValues: new Map(),
    executedNodes: new Set(),
    isRunning: true,
  };
  context.nodeValues.set("workflow-execution-id", executionId);
  contexts.set(runKey, context);

  const agentRunLogId = `agentrun_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const agentRunStartTime = Date.now();
  context.agentRunLogId = agentRunLogId;

  deps?.onLog?.({
    id: agentRunLogId,
    type: "agent-run",
    title: agent.name,
    agentId: agent.id,
  });

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
      const nodeStartTime = Date.now();

      const nodeExecId = `nodeexec_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      context.currentNodeExecId = nodeExecId;
      deps?.onAddNodeExecution?.(agentRunLogId, {
        id: nodeExecId,
        nodeId,
        nodeType: node.type,
        nodeLabel: node.label || node.type,
        timestamp: Date.now(),
      });

      const result = await executeNode(node, agent.edges, context, agent, deps!);
      context.currentNodeExecId = undefined;

      deps?.onUpdateNodeExecution?.(agentRunLogId, nodeExecId, {
        output: result.success ? formatNodeOutput(result.value) : undefined,
        error: result.error,
        durationMs: Date.now() - nodeStartTime,
      });

      if (onNodeExecuted) {
        onNodeExecuted(nodeId, result);
      }
      if (!result.success) {
        deps?.onUpdateLog?.(agentRunLogId, { error: result.error, durationMs: Date.now() - agentRunStartTime });
        throw new Error(result.error || `Node ${nodeId} failed`);
      }
      if (result.value !== undefined) {
        context.nodeValues.set(nodeId, result.value);
      }
    }

    deps?.onUpdateLog?.(agentRunLogId, { durationMs: Date.now() - agentRunStartTime });

    const outputs = agent.nodes.filter((n) => n.type === "chatOutput");
    if (outputs.length > 0) {
      const outId = outputs[0].id;
      const val = context.nodeValues.get(outId) || null;
      return val;
    }
    return null;
  } finally {
    context.isRunning = false;
    contexts.delete(runKey);
  }
}

export function cancelWorkflow(runKey: string): void {
  const ctx = contexts.get(runKey);
  if (ctx) {
    ctx.isRunning = false;
  }
}

export function isWorkflowRunning(runKey: string): boolean {
  const ctx = contexts.get(runKey);
  return ctx ? ctx.isRunning : false;
}

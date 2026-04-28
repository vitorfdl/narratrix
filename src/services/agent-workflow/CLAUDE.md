# Agent Workflow Runtime

Execution engine for agent node graphs authored in `src/pages/agents`. Persistence lives in `services/agent-service.ts`; `services/agent-workflow-service.ts` is a thin legacy adapter. This folder is the runtime.

## Execution

`runner.ts#executeWorkflow(agent, triggerContext?, deps, onNodeExecuted?)` topologically sorts the DAG of `AgentNodeType` + `AgentEdgeType` (`@/schema/agent-schema`), then walks nodes sequentially. For each it builds an `inputs` record from incoming edges via `handles.ts#getNodeInputs`, looks up the executor in `NodeRegistry`, and awaits it. Successful values are stored in `context.nodeValues` keyed by node id; multi-output nodes (`javascript`, `userChoice`, `searchLorebook`, `addLorebookEntry`) also write handle-scoped keys (`${nodeId}::out-string`). The first `chatOutput` node's value is the workflow's return.

Live runs are tracked in a module-level `Map<runKey, WorkflowExecutionContext>` where `runKey = "${chatId ?? "global"}::${agentId}"` — the same agent in two chats runs independently.

## Node executors

Node kinds register themselves with `NodeRegistry.register` from `pages/agents/components/tool-nodes/*` (side-effect imported at the top of `runner.ts`). A `NodeExecutor` is `(node, inputs, context, agent, deps) => Promise<NodeExecutionResult>` (`types.ts`). The runner discovers nodes through the registry — there is no list here.

## Inference boundary

The runner does not call `inference-service` directly. It receives a `WorkflowDeps` bag carrying `runInference`, prompt formatters, lookups, and console-log callbacks. `@/hooks/useAgentWorkflow` is the production binding: it builds `deps.runInference` on top of `useInference` (always non-streaming) and resolves per-request promises via `pendingResolvers` keyed by `requestId`. `WorkflowToolDefinition`s declared by nodes are wrapped into `ExecutableToolDefinition`s for the AI SDK there, not here.

`javascript-runner.ts` is separate: executes user JS from `nodeJavascript` inside an `AsyncFunction` with bound stores (`chat`, `characters`, `lorebook`, `models`), `utils`, and a captured `console`.

## Cancellation

`cancelWorkflow(runKey)` flips `context.isRunning = false`; the loop checks it before each node. Cancelling mid-inference is the hook's job — it resolves outstanding `pendingResolvers` as `cancelled` and forwards to `cancelRequest`. Errors throw out of `executeWorkflow`; the caller logs and surfaces them (see `chat-generation-orchestrator`'s `safeExec`).

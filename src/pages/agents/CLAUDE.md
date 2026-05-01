# Agents Feature

Library of user-built workflow agents — node graphs that run inside a chat. Library view in `AgentPage.tsx`; selecting one swaps to `EditAgentPage.tsx`, which delegates the canvas to `components/AgentEditor.tsx`.

## Editor

The graph is React Flow (`@xyflow/react`). `AgentEditor` is wrapped in `ReactFlowProvider` and `UndoRedoProvider`; `takeSnapshot` runs before any structural mutation. Edge validity, edge typing/styling, and core ↔ React Flow conversion live in `tool-components/edge-utils.ts` and `node-utils.ts`. Exactly one `trigger` node is required.

Node kinds register themselves via side-effect imports in `tool-nodes/index.ts`, calling `NodeRegistry.register` (`tool-components/node-registry.ts`). A definition bundles metadata, the React component, an optional `getDynamicOutputs` (handles derived from config so they survive serialization), and an `executor` typed by `services/agent-workflow/types`. `components/json-schema/` is a standalone JSON-Schema builder used only by `nodeJavascript`.

## Persistence

`@/hooks/agentStore` (Zustand) — agent CRUD via `services/agent-service`. `EditAgentPage` calls `updateAgent` directly on every name/description/tags/graph change; there is no separate save action. `@/hooks/agentWorkflowStore` holds per-run state keyed by `makeRunKey(agentId, chatId)` plus cancel callbacks. `AgentType` (`@/schema/agent-schema`) carries `nodes`, `edges`, and `settings.run_on` (the trigger config).

## Execution

`services/agent-workflow/runner.ts` topologically sorts nodes, resolves inputs via `handles.ts`, and dispatches each node's registered `executor`. `@/hooks/useAgentWorkflow` wraps the runner with the deps executors need — inference (`useInference`), prompt formatting, user-choice prompts, console logging, and chat/character/template/model lookups.

Two entry points fire workflows: `useAgentTriggerManager(chatId)` mounts in the chat tree and maps `services/chat-event-bus` events to `AgentTriggerType`s (skipping `source: "system"` to avoid cascades); the chat generation orchestrator invokes agent participants directly during a turn.

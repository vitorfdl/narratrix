# Chat Feature

Grid workspace where widgets share one chat. Layout in `GridLayout.tsx`, tabs in `ChatTabs.tsx`, entry `ChatPage.tsx` → `ChatBox.tsx`.

## Shared State

- `@/hooks/chatStore` — current chat, messages, participants, chapters, settings. Widgets read via `useCurrentChat*` selectors and mutate via `useChatActions`. No prop-drilling between widgets.
- `@/hooks/chatTemplateStore` — format/inference templates.

## Inference

The chat tree is wrapped by `InferenceServiceProvider` (`src/providers/inferenceChatProvider.tsx`). Widgets pull the service with `useInferenceServiceFromContext` (`@/hooks/useChatInference`). The service is backed by `@/services/inference-service` and exposes, keyed by `chatId`:

`generateMessage`, `regenerateMessage`, `cancelGeneration`, `getStreamingState`, `subscribeToStateChanges`, `isStreaming`.

A single `streamingManager` per chat is the synchronization point — every widget subscribes to it, so a Stop in one widget cancels the same `requestId` that another widget is rendering tokens from.

### Who calls what

- **WidgetGenerate** — user input box. On submit hands off to `orchestrateGeneration` (`@/services/chat-generation-orchestrator`), which loops `generateMessage` across enabled participants for one turn and waits between calls via `subscribeToStateChanges`. Owns Stop (`cancelGeneration`) and a "quiet response" mode that streams tokens back into the input field instead of the chat.
- **WidgetMessages** — renders the live stream; per-message Regenerate calls `regenerateMessage`; also dispatches `generateMessage` for system summaries (existing message id).
- **WidgetParticipants** — single-character generation via `generateCharacterWithAgents` (wraps `generateMessage`); has its own Stop.
- **NoMessagePlaceholder** — kicks off the first message of an empty chat.
- **WidgetExpressions** — read-only; uses `useChatInferenceState` + `services/background-inference-service` to swap sprites mid-stream without blocking the foreground.

## Conventions

- Prompt assembly lives in `services/inference/formatter/` — never inline in widgets. Token estimates: `estimateTokens` from `formatter/apply-context-limit`.
- New widgets register in `hooks/registry.tsx`; config fields in `manifests/configFields.ts`.

# Inference Pipeline

Provider-agnostic prompt assembly and streaming-state plumbing. `services/chat-generation-orchestrator.ts` calls `inference-service.ts` (one level up), which composes the hooks here. Actual LLM calls live in the sibling `services/ai-providers/` (Vercel AI SDK adapter) — nothing in this folder talks to a model.

## Pipeline

`formatter.ts` exports `formatPrompt(config): FormattedPromptResult`. Stages run in order in one pass:

1. `resolveScriptedPrompts` — merges in-chat agent injections (`extra.promptConfig`) with `chatTemplate.custom_prompts`.
2. `getChatHistory` — flattens messages, skipping disabled rows, rewriting `summary` system messages.
3. `processCustomPrompts` — inserts prompts at `top` / `bottom` / `depth` / `before_user_input` / `after_user_input`.
4. `apply-lorebook` — selects entries within `lorebook_token_budget` (Character → User → Template).
5. `createSystemPrompt` — assembles enabled sections, drops unused slots, applies `systemOverridePrompt`.
6. Optional message merging / line collapsing from `format-template-utils`.
7. `replace-text-placeholders` — substitutes `{{character.*}}`, `{{user.*}}`, `{{chapter.*}}`, `{{lorebook.top|bottom}}`.
8. `apply-context-limit` — head-trims using `estimateTokens`; tokenizer pass on the last 3 messages when within 10% of the budget.
9. If a text-completion `inferenceTemplate` is set, `apply-inference-template` collapses everything into a single string and emits `customStopStrings`.

`prompt-formatter.ts` (`usePromptFormatter`) is the React-side entry that resolves chat / model / templates / characters from stores and feeds `formatPrompt`.

## Streaming state

`streaming-state-manager.ts` (`useStreamingStateManager`) holds one `StreamingState` per `chatId` plus a `requestId → chatId` map, so an in-flight stream is addressable by `requestId` alone. `subscribeToStateChanges(cb, chatId?)` notifies on shallow-diff changes. One stream per chat, concurrent across chats.

`stream-processor.ts` splits chunks into text vs reasoning using `formatTemplate.config.reasoning` (default `<think>`/`</think>`), buffering partial tags via `chunkBuffer` / `isThinking`.

`message-manager.ts` writes streamed text to the DB. `updateMessageDirect` bypasses the Zustand store (required for non-current chats and background streams); `updateMessageById` goes through it.

Canonical types in `types.ts`; consumers import from `@/services/inference`.

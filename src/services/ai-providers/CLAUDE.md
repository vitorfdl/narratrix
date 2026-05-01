# AI Providers

Adapter layer between the inference pipeline and concrete LLM APIs. Everything runs in the renderer over Vercel AI SDK — there is no Rust counterpart for chat (`src-tauri/src/inference/` only holds the tokenizer).

## Entry point

`start-inference.ts` exposes `callProviderConverseEndpoint(event, params)`. It builds a model handle via `aisdk/provider-factory`, normalizes messages with `aisdk/convert-messages`, maps tools with `aisdk/convert-tools`, attaches engine-specific options from `aisdk/provider-options/`, then dispatches to `aisdk/streaming.ts` or `aisdk/non-streaming.ts` based on `params.stream`. Embeddings have a parallel path in `aisdk/embedding-provider-factory.ts`, used by `services/embedding-service.ts`.

The sole caller is `hooks/useInference.ts`, which sits under `services/inference/streaming-state-manager.ts`.

## Provider seam

Providers are not classes — the factory returns a Vercel AI SDK `LanguageModel` and the SDK handles the wire format. Engines wired in `provider-factory.ts`: `openai`, `anthropic`, `google`, `aws_bedrock`, `openrouter`, `ollama`, `openai_compatible` (default fallback). Engine names come from `Engine` in `@/schema/model-manifest-schema`.

To add one: install its `@ai-sdk/*` package, branch in `provider-factory.ts` (and `embedding-provider-factory.ts` if applicable), add an `Engine` variant, drop a file in `provider-options/` and register it. Use `tauriFetch` from `@tauri-apps/plugin-http` as the `fetch` override — browser `fetch` hits CORS.

## Streaming contract

Both paths take an `AIEvent` (`types/ai-event.type.ts`): `sendStream`, `sendError`, `finish`, `registerAborter`, optional `reportResolvedParams`. `streaming.ts` iterates `streamText().textStream` and forwards text deltas plus `reasoning-delta` chunks; `registerAborter` wires an `AbortController` so upstream cancellation flows down. `non-streaming.ts` returns the full string and the caller invokes `event.finish`.

## Secrets

API keys arrive encrypted on `ModelSpecs.config.api_key` (per-profile) and are decrypted inline via `decryptApiKey` from `@/commands/security`. Never log `authParams`, the decrypted key, or `providerOptions` that may embed credentials. Always read from the `ModelSpecs` passed in — never a cached or global value.

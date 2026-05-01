# Models Feature

Per-profile catalog of LLM, embedding, image, audio, and database providers. Entry `ModelsPage.tsx` renders an `auto-fill` grid of `ModelCard`s grouped by `ModelType`. `ModelDialog` hosts `ModelForm` on a Connection tab and concurrency + Chat/Text completion mode on an Inference tab (Inference disabled in add mode).

## State

- `@/hooks/modelsStore` — Zustand. `useModelsActions` (`createModel`, `updateModel`, `deleteModel`); page reads via `getModelsByProfileGroupedByType` and re-fetches after mutations.
- `@/hooks/manifestStore` — manifests describe the engine and its config field schema (`string` / `secret` / `url` / `number` / `boolean` / `hidden`); split into `useModelManifests` and `useEmbeddingManifests`.
- `@/hooks/ProfileStore` — models are scoped per profile; never reuse across profiles.

## Form ↔ Dialog seam

`ModelDialog` owns concurrency and inference-template state and drives the form via a `ModelFormRef.submit` imperative handle (footer Save → `formRef.current.submit()` → form `onSubmit` → `onSuccess` closes + refreshes). Selected manifest is lifted out of the form via `onManifestChange` so the dialog can hide Inference-mode controls when the manifest's `inference_type` lacks `completion`.

## Secrets

API keys are encrypted in two places, asymmetrically: `ModelForm` encrypts via `encryptApiKey` (`@/commands/security`) on update and on Test Connection; `@/services/model-service` encrypts secret fields itself on create unless `disableEncryption` is set (the duplicate path passes `true` because the source config is already encrypted). Form schema is built dynamically from `selectedManifest.fields` with Zod; secrets in edit mode are optional (empty = keep existing).

Test Connection uses `useInference` with a synthesized `ModelSpecsSchema` and tracks its own `testRequestId` so unrelated stream events are ignored. Embeddings can't be tested.

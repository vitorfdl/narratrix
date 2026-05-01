# Lorebooks Feature

Library page that flips between a card grid (with filter sidebar) and a single-lorebook entry editor. Entry `LorebooksPage.tsx`; `selectedLorebookId` in the store decides which view renders.

## State

`@/hooks/lorebookStore` (Zustand) is the single source of truth. Components read via selectors (`useLorebooks`, `useSelectedLorebookId`, `useSelectedLorebookEntries`, `useIndexingStatus`, `useIsIndexing`) and mutate via `useLorebookStoreActions()`. `loadLorebookEntries` and `loadIndexingStatus` early-return if `selectedLorebookId` no longer matches, so race-y reselects don't bleed stale entries into the new view.

## Services

- `services/lorebook-service` — CRUD for lorebooks and entries (Tauri/SQLite).
- `services/lorebook-indexing-service` — RAG layer over `embedding-service`. `indexLorebookEntry` / `indexAllLorebookEntries` (batched 50) write JSON-encoded vectors into `LorebookEntry.vector_content`; `parseStoredVector` decodes them. Only runs when the lorebook has `rag_enabled` and an `embedding_model_id`.

## RAG flow

`LorebookFormDialog` toggles `rag_enabled` and picks the embedding model (filtered from `useModels()` by `type === "embedding"`). When enabled:

- `LorebookEntries` swaps the Keywords column for an Indexed dot — keyword and vector matching are alternative activation strategies, not stacked. Toolbar exposes Index All, Clear Index, Test Search.
- `LorebookEntryDialog` calls `indexEntry(lorebookId, entryId)` after create/update so a single entry's vector stays fresh.
- `RagTestDialog` embeds a query, runs `cosineSimilarity` (from `ai`) against every entry's parsed vector, and bins results by `lorebook.similarity_threshold`.

Entry order is a `priority` integer; drag-and-drop in `LorebookEntries` (dnd-kit) rewrites priorities as `1000 - index*10` and persists per-row. Page UI prefs persist via `useLocalLorebookPageSettings`.

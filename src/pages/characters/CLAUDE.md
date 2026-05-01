# Characters Library

Single-page library: tag sidebar + sticky toolbar + responsive `auto-fill` card grid. Entry `CharactersPage.tsx` wires `CharacterSidebar`, the grid of `CharacterCard`, and the create/edit `CharacterForm` dialog. Search, sort, tag, and card size are memoized in the page and persisted via `useLocalCharactersPagesSettings`.

## State

`@/hooks/characterStore` (Zustand) holds the characters list and a separate `avatarUrls` map. Read via `useCharacters`, `useCharactersLoading`, `useCharacterTagList`, `useCharacterById`; mutate via `useCharacterActions`. Avatar URLs load lazily through `useCharacterAvatars` — call `reloadAll(id)` after any write that changes an image so the card refreshes.

`@/services/character-service` is the only path to character rows; the store wraps it. Don't call Tauri commands directly from components. New characters of type `character` get default expressions seeded from `EXPRESSION_LIST` (`@/schema/characters-schema`); expression image paths live on the character row.

## Import / Export

Drag-and-drop is page-wide via `getCurrentWebviewWindow().onDragDropEvent`, disabled while a dialog is open. The hidden `CharacterImport` exposes a `handleImport(paths)` imperative handle used by both the toolbar button and drop events.

Accepts JSON and PNG. PNG ingestion reads `tEXt` chunks (`ccv3`/`chara` keywords) via `services/imports/formats/character_spec_png.ts` — supports `chara_card_v2`, `chara_card_v3`, and the internal `export_type: "character"` payload. Validation/transform happens in `services/imports/import-character.ts`; embedded lorebooks are imported alongside.

Export goes through `ExportOptionsDialog` (reused from chat). JSON via `exportSingleToJsonFile`; PNG via `services/exports/character-png-export` which embeds cleaned character JSON into the avatar PNG. Always strip `profile_id`, blank `expressions`, and null `avatar_path` before serializing — the original avatar path is passed separately to the PNG exporter.

# Exports

Narrow folder: PNG-with-embedded-JSON export for characters. That is currently the only thing here.

All other export paths (character JSON, chat/format/instruction templates, standalone lorebooks) go through `@/utils/export-utils.ts` (`exportToJsonFile` / `exportSingleToJsonFile`), which wraps the payload with `export_type` and the running `app_version` from Tauri. This folder does not.

## character-png-export.ts

`exportCharacterToPng(characterData, avatarPath, defaultFileName)` is invoked from `CharactersPage.tsx` after `ExportOptionsDialog` returns `exportFormat: "png"`. JPEG avatars are re-encoded to PNG via a Canvas round-trip; anything else is rejected with a toast.

`embedCharacterDataInPng` strips any existing `chara` / `ccv3` `tEXt` chunks, then injects a single `tEXt` chunk keyed `chara` whose value is base64-encoded UTF-8 JSON of `{ export_type: "character", ...characterData }`. No version field is added at this layer — the caller passes pre-cleaned data (`profile_id` stripped, `expressions: []`, `avatar_path: null`, embedded `lorebook` if requested) so whatever versioning the character row carries is what ships.

## Contract with imports/

The reader is `services/imports/formats/character_spec_png.ts`. It accepts the `chara` and `ccv3` keywords and recognizes three payload shapes: SillyTavern `chara_card_v2`, `chara_card_v3`, and the internal `export_type: "character"` written here. If you change the embedded shape, update that reader in the same change.

Lorebook embedding helpers live next door at `services/imports/shared/lorebook-export.ts` (yes, in `imports/`) — call `prepareLorebookForEmbedding` before handing the character to this exporter.

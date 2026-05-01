# Imports

Format detection, validation, and DB ingestion for user-supplied files. Five entity types, one file per type: `import-character.ts`, `import-lorebook.ts`, `import-chat-template.ts`, `import-format-template.ts`, `import-inference-template.ts`. Per-format adapters (Zod schema + transform) live under `formats/`.

## Pipeline

Each `import-*.ts` exposes the same three-step shape:

1. `parse*Content(fileContent)` — JSON parse only. Character PNGs go through `formats/character_spec_png.ts` first to pull JSON out of `tEXt` chunks (`ccv3` / `chara`; supports `chara_card_v2`, `chara_card_v3`, internal `export_type: "character"`).
2. `validateAndTransform*Data(data, profileId, …)` — tries the internal Zod schema from `@/schema/` first, then falls back to known external formats. Returns `{ valid, errors, data, format }` where `format` is a discriminated string. Never throws on validation failure — surfaces errors in the result.
3. `import*` — writes through the matching `services/*-service` (no direct Tauri command calls). Side effects: a character with `chatFields` creates a chat + greeting chapters; an embedded `lorebook` payload is imported first and its id linked onto the character.

## External formats

- Characters: `chara_card_v2` / `chara_card_v3` (`character_spec_v2.ts`, with macro substitution via `sillytavern_helper.ts`).
- Lorebooks: V2 spec only (no v3-specific spec).
- Chat / format templates: SillyTavern presets (`sillytavern_chat_template.ts`, `sillytavern_format_template.ts`).
- Inference templates: SillyTavern instruct schema, validated inline in `import-inference-template.ts`.

All external input is Zod-validated before transform; raw `any` never reaches the service layer.

## Mirror with `services/exports/`

`exports/` is currently thin (only `character-png-export.ts`); JSON serialization happens via `utils/export-utils.ts` keyed by `export_type`. Round-trip contract: anything stamped with `export_type` here must validate against the corresponding internal Zod schema. `shared/lorebook-export.ts` is the only export helper that lives in this tree.

UI dispatch (e.g. `pages/characters/components/CharacterImport.tsx`) reads files via Tauri FS, then calls `parse* → validateAndTransform* → import*`.

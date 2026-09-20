import { useCharacterStore } from "@/hooks/characterStore";
import { useChatStore } from "@/hooks/chatStore";
import { useProfileStore } from "@/hooks/ProfileStore";
import { useTemplateStore } from "@/hooks/templateStore";
import type { Character } from "@/schema/characters-schema";
import type { SheetSection, SheetValues } from "@/schema/template-character-sheet-schema";
import type { WorkflowDeps, WorkflowExecutionContext } from "@/services/agent-workflow/types";
import { type Chat, updateChat } from "@/services/chat-service";
import { applySheetUpdates, describeSheetFields, type SheetUpdate, summarizeSheetFields } from "@/utils/sheet-catalog";
import { slugifyKey } from "@/utils/sheet-expression";
import { renderSheetMarkdown } from "@/utils/sheet-markdown";

// ─── Shared runtime for the character sheet tool nodes ───────────────────────────
// Sheets differ per character, so the tool schemas are built per chat when the tool is
// assembled: the `character` argument is an enum of participants that have a sheet and the
// update tool's description carries a compact catalog of each one's writable fields. Values
// are validated against the template at call time by applySheetUpdates.

type SheetCharacter = Extract<Character, { type: "character" }>;

export type SheetWriteScope = "chat" | "character";

export interface SheetToolOptions {
  /** Lock the tool to one character (empty = the model picks by name). */
  characterId?: string;
  includeUserCharacter: boolean;
}

export interface SheetTarget {
  character: SheetCharacter;
  sections: SheetSection[];
  values: SheetValues;
  /** Values live in user_character_settings rather than a participant entry. */
  isUserCharacter: boolean;
}

const UPDATE_ITEM_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    field: { type: "string", description: "Field key, optionally prefixed with its section key (e.g. 'hp' or 'stats.hp')." },
    op: {
      type: "string",
      enum: ["set", "add", "remove"],
      description:
        "'set' replaces the value (default). 'add' increments a number or appends list/table entries. 'remove' subtracts from a number or removes list items / table rows by value or index.",
    },
    value: {
      description:
        "The value to apply. Number for numeric fields, string for text and dropdowns, array of strings for lists and multi-selects, array of rows for tables (each row an array of cells in column order, or an object keyed by column).",
    },
  },
  required: ["field"],
};

function currentProfileId(): string | undefined {
  return useProfileStore.getState().currentProfile?.id;
}

function belongsToCurrentProfile(chat: { profile_id?: string } | null | undefined): boolean {
  const profileId = currentProfileId();
  return !chat || !profileId || chat.profile_id === profileId;
}

async function readChat(context: WorkflowExecutionContext, deps: WorkflowDeps): Promise<Chat | null> {
  if (context.chatId) {
    const chat = (await deps.getChatById(context.chatId)) as Chat | null;
    return belongsToCurrentProfile(chat) ? chat : null;
  }
  return useChatStore.getState().selectedChat ?? null;
}

async function resolveCharacter(id: string, deps: WorkflowDeps): Promise<Character | null> {
  const cached = useCharacterStore.getState().characters.find((c) => c.id === id);
  if (cached) {
    return cached;
  }
  const profileId = currentProfileId();
  try {
    const character = (await deps.getCharacterById(id)) as Character | null;
    return character && (!profileId || character.profile_id === profileId) ? character : null;
  } catch (error) {
    console.error(`Failed to resolve character ${id} for sheet tools:`, error);
    return null;
  }
}

export async function listSheetTargets(context: WorkflowExecutionContext, deps: WorkflowDeps, opts: SheetToolOptions): Promise<SheetTarget[]> {
  const chat = await readChat(context, deps);
  if (!chat) {
    return [];
  }

  const participants = chat.participants ?? [];
  const userCharacterId = chat.user_character_id ?? null;
  const ids = participants.map((participant) => participant.id);
  if (opts.includeUserCharacter && userCharacterId && !ids.includes(userCharacterId)) {
    ids.push(userCharacterId);
  }
  const wanted = opts.characterId ? ids.filter((id) => id === opts.characterId) : ids;

  const targets: SheetTarget[] = [];
  for (const id of wanted) {
    const character = await resolveCharacter(id, deps);
    if (character?.type !== "character" || !character.custom?.sheet_template_id) {
      continue;
    }
    const template = await useTemplateStore.getState().actions.getCharacterSheetTemplateById(character.custom.sheet_template_id);
    if (!template) {
      continue;
    }
    const participant = participants.find((p) => p.id === id);
    const userEntry = userCharacterId === id ? chat.user_character_settings?.find((entry) => entry.id === id) : undefined;
    const overrides = (participant?.settings?.sheet_values ?? userEntry?.settings?.sheet_values) as SheetValues | undefined;
    targets.push({
      character,
      sections: template.sections,
      values: { ...(character.custom.sheet_values ?? {}), ...(overrides ?? {}) },
      isUserCharacter: !participant && userCharacterId === id,
    });
  }
  return targets;
}

export function findSheetTarget(targets: SheetTarget[], reference: string | undefined): SheetTarget | undefined {
  if (!reference?.trim()) {
    return targets.length === 1 ? targets[0] : undefined;
  }
  const raw = reference.trim().toLowerCase();
  const slug = slugifyKey(reference);
  return targets.find((target) => target.character.id === reference) ?? targets.find((target) => target.character.name.toLowerCase() === raw || slugifyKey(target.character.name) === slug);
}

function targetNames(targets: SheetTarget[]): string[] {
  return targets.map((target) => target.character.name);
}

// ─── Tool schemas ─────────────────────────────────────────────────────────────

function characterProperty(targets: SheetTarget[], purpose: string): Record<string, unknown> {
  const names = targetNames(targets);
  return { type: "string", description: `Name of the character whose sheet to ${purpose}.`, ...(names.length > 0 ? { enum: names } : {}) };
}

export function buildGetSheetToolSchema(targets: SheetTarget[], forced: boolean): Record<string, unknown> {
  if (forced) {
    return { type: "object", properties: {} };
  }
  return { type: "object", properties: { character: characterProperty(targets, "read") }, required: ["character"] };
}

export function buildUpdateSheetToolSchema(targets: SheetTarget[], forced: boolean): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  if (!forced) {
    properties.character = characterProperty(targets, "modify");
  }
  properties.updates = { type: "array", minItems: 1, description: "Changes to apply, in order.", items: UPDATE_ITEM_SCHEMA };
  return { type: "object", properties, required: forced ? ["updates"] : ["character", "updates"] };
}

const CATALOG_LIMIT = 1500;

/** Appends a per-character catalog of writable fields so the model rarely needs a read call first. */
export function buildUpdateSheetToolDescription(base: string, targets: SheetTarget[]): string {
  if (targets.length === 0) {
    return `${base}\nNo participant in this chat has a character sheet.`;
  }
  const catalog = targets.map((target) => `- ${target.character.name}: ${summarizeSheetFields(target.sections) || "(no writable fields)"}`).join("\n");
  if (catalog.length > CATALOG_LIMIT) {
    return `${base}\nCharacters with sheets: ${targetNames(targets).join(", ")}. Read a character's sheet first to learn its field keys.`;
  }
  return `${base}\nWritable fields per character:\n${catalog}`;
}

// ─── Invocations ──────────────────────────────────────────────────────────────

function notFound(reference: string | undefined, targets: SheetTarget[]): string {
  const names = targetNames(targets);
  const available = names.length > 0 ? `Characters with a sheet: ${names.join(", ")}.` : "No participant in this chat has a character sheet.";
  return JSON.stringify({ ok: false, error: reference ? `No character "${reference}" with a sheet in this chat. ${available}` : `Specify which character. ${available}` });
}

export async function readCharacterSheet(context: WorkflowExecutionContext, deps: WorkflowDeps, opts: SheetToolOptions, reference?: string): Promise<string> {
  const targets = await listSheetTargets(context, deps, opts);
  const target = opts.characterId ? targets[0] : findSheetTarget(targets, reference);
  if (!target) {
    return notFound(reference, targets);
  }
  const characterName = target.character.name;
  return JSON.stringify({
    character: characterName,
    fields: describeSheetFields(target.sections, target.values, characterName),
    markdown: renderSheetMarkdown({ sections: target.sections, values: target.values, characterName }),
  });
}

function normalizeUpdates(raw: unknown): SheetUpdate[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is SheetUpdate => !!item && typeof item === "object");
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([field, value]) => ({ field, value }));
  }
  return [];
}

async function persistSheetValues(context: WorkflowExecutionContext, deps: WorkflowDeps, target: SheetTarget, values: SheetValues, scope: SheetWriteScope): Promise<void> {
  const characterId = target.character.id;

  if (scope === "character") {
    const profileId = currentProfileId();
    if (!profileId) {
      throw new Error("No active profile.");
    }
    await useCharacterStore.getState().actions.updateCharacter(profileId, characterId, { custom: { ...target.character.custom, sheet_values: values } });
    return;
  }

  const store = useChatStore.getState();
  const selected = store.selectedChat;
  const targetIsSelected = selected?.id != null && (!context.chatId || context.chatId === selected.id);

  if (targetIsSelected && selected) {
    if (target.isUserCharacter) {
      const current = selected.user_character_settings ?? [];
      const existing = current.find((entry) => entry.id === characterId);
      const nextEntry = { id: characterId, settings: { ...(existing?.settings ?? {}), sheet_values: values } };
      await store.actions.updateSelectedChat({ user_character_settings: [...current.filter((entry) => entry.id !== characterId), nextEntry] });
    } else {
      const participant = selected.participants?.find((p) => p.id === characterId);
      await store.actions.updateParticipant(characterId, { settings: { ...(participant?.settings ?? {}), sheet_values: values } });
    }
    return;
  }

  if (!context.chatId) {
    throw new Error("No active chat to update.");
  }
  const chat = (await deps.getChatById(context.chatId)) as Chat | null;
  if (!chat || !belongsToCurrentProfile(chat)) {
    throw new Error(`No chat found with id "${context.chatId}".`);
  }
  if (target.isUserCharacter) {
    const current = chat.user_character_settings ?? [];
    const existing = current.find((entry) => entry.id === characterId);
    const nextEntry = { id: characterId, settings: { ...(existing?.settings ?? {}), sheet_values: values } };
    await updateChat(context.chatId, { user_character_settings: [...current.filter((entry) => entry.id !== characterId), nextEntry] });
  } else {
    const participants = (chat.participants ?? []).map((p) => (p.id === characterId ? { ...p, settings: { ...(p.settings ?? {}), sheet_values: values } } : p));
    await updateChat(context.chatId, { participants });
  }
}

export async function updateCharacterSheet(
  context: WorkflowExecutionContext,
  deps: WorkflowDeps,
  opts: SheetToolOptions,
  scope: SheetWriteScope,
  reference: string | undefined,
  rawUpdates: unknown,
): Promise<string> {
  const targets = await listSheetTargets(context, deps, opts);
  const target = opts.characterId ? targets[0] : findSheetTarget(targets, reference);
  if (!target) {
    return notFound(reference, targets);
  }

  const updates = normalizeUpdates(rawUpdates);
  if (updates.length === 0) {
    return JSON.stringify({ ok: false, character: target.character.name, error: "No updates given. Pass an array of { field, op, value }." });
  }

  const result = applySheetUpdates(target.sections, target.values, updates);
  if (result.changes.length > 0) {
    try {
      await persistSheetValues(context, deps, target, result.values, scope);
    } catch (error) {
      return JSON.stringify({ ok: false, character: target.character.name, error: error instanceof Error ? error.message : "Failed to save the sheet." });
    }
  }

  return JSON.stringify({ ok: result.errors.length === 0, character: target.character.name, changes: result.changes, errors: result.errors });
}

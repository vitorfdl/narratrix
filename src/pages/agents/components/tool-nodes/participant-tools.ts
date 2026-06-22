import { useCharacterStore } from "@/hooks/characterStore";
import { useChatStore } from "@/hooks/chatStore";
import { useProfileStore } from "@/hooks/ProfileStore";
import type { Character } from "@/schema/characters-schema";
import type { ChatParticipant } from "@/schema/chat-schema";
import type { WorkflowDeps, WorkflowExecutionContext } from "@/services/agent-workflow/types";
import { updateChat } from "@/services/chat-service";

// ─── Shared runtime for the participant tool nodes ───────────────────────────────
// listParticipants, setParticipantEnabled and getParticipantData all read the active
// chat's participants and resolve their character data the same way; the schemas below
// are the single source of truth shared by each node's executor and the BUILTIN_NODE_TOOLS
// registry in services/agent-tools.ts.

export type ParticipantTypeFilter = "all" | "character" | "agent";

export const PARTICIPANT_DATA_FIELDS = ["name", "type", "enabled", "personality", "tags", "avatar"] as const;
export type ParticipantDataField = (typeof PARTICIPANT_DATA_FIELDS)[number];

export interface ParticipantSummary {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  tags: string[];
}

export interface ParticipantData {
  id: string;
  name?: string;
  type?: string;
  enabled?: boolean;
  personality?: string | null;
  tags?: string[];
  avatar?: string | null;
}

export interface SetEnabledResult {
  ok: boolean;
  message: string;
}

export const LIST_PARTICIPANTS_TOOL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["all", "character", "agent"],
      description: "Filter by participant kind. 'all' (default) returns everyone, 'character' only characters, 'agent' only agents.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Only include participants whose character has at least one of these tags (case-insensitive).",
    },
  },
};

export const SET_PARTICIPANT_ENABLED_TOOL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    participantId: { type: "string", description: "The id of the participant to update, as returned by the participant listing tool." },
    enabled: { type: "boolean", description: "true to activate the participant in the chat, false to disable them." },
  },
  required: ["participantId", "enabled"],
};

export const GET_PARTICIPANT_DATA_TOOL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    participantId: { type: "string", description: "The id of the participant to inspect, as returned by the participant listing tool." },
    fields: {
      type: "array",
      items: { type: "string", enum: [...PARTICIPANT_DATA_FIELDS] },
      description: "Which fields to return. Omit to return all available fields.",
    },
  },
  required: ["participantId"],
};

function currentProfileId(): string | undefined {
  return useProfileStore.getState().currentProfile?.id;
}

/** Guards against a chat from another profile leaking through an unscoped lookup. */
function belongsToCurrentProfile(chat: { profile_id?: string } | null | undefined): boolean {
  const profileId = currentProfileId();
  return !chat || !profileId || chat.profile_id === profileId;
}

async function readParticipants(context: WorkflowExecutionContext, deps: WorkflowDeps): Promise<ChatParticipant[]> {
  if (context.chatId) {
    const chat = await deps.getChatById(context.chatId);
    if (!belongsToCurrentProfile(chat)) {
      return [];
    }
    return (chat?.participants as ChatParticipant[] | undefined) ?? [];
  }
  // selectedChat is already loaded scoped to the active profile.
  return useChatStore.getState().selectedChat?.participants ?? [];
}

async function resolveCharacters(ids: string[], deps: WorkflowDeps): Promise<Map<string, Character>> {
  const cached = useCharacterStore.getState().characters;
  const result = new Map<string, Character>();
  const missing: string[] = [];

  for (const id of ids) {
    const hit = cached.find((c) => c.id === id);
    if (hit) {
      result.set(id, hit);
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    const profileId = currentProfileId();
    const fetched = await Promise.all(
      missing.map(async (id) => {
        try {
          const character = (await deps.getCharacterById(id)) as Character | null;
          // Never surface a character belonging to another profile.
          return character && (!profileId || character.profile_id === profileId) ? character : null;
        } catch (error) {
          console.error(`Failed to resolve character ${id} for participant tools:`, error);
          return null;
        }
      }),
    );
    for (const character of fetched) {
      if (character) {
        result.set(character.id, character);
      }
    }
  }

  return result;
}

function isEnabled(participant: ChatParticipant): boolean {
  return participant.enabled !== false;
}

export async function listParticipants(context: WorkflowExecutionContext, deps: WorkflowDeps, opts: { type?: ParticipantTypeFilter; tags?: string[] } = {}): Promise<ParticipantSummary[]> {
  const participants = await readParticipants(context, deps);
  const characters = await resolveCharacters(
    participants.map((p) => p.id),
    deps,
  );

  const typeFilter = opts.type && opts.type !== "all" ? opts.type : null;
  const tagFilter = (opts.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);

  const summaries: ParticipantSummary[] = [];
  for (const participant of participants) {
    const character = characters.get(participant.id);
    const type: string = character?.type ?? "character";
    if (typeFilter && type !== typeFilter) {
      continue;
    }
    const tags = character?.tags ?? [];
    if (tagFilter.length > 0 && !tags.some((t) => tagFilter.includes(t.toLowerCase()))) {
      continue;
    }
    summaries.push({ id: participant.id, name: character?.name ?? "(unknown)", type, enabled: isEnabled(participant), tags });
  }
  return summaries;
}

export async function getParticipantData(context: WorkflowExecutionContext, deps: WorkflowDeps, participantId: string, fields?: ParticipantDataField[]): Promise<ParticipantData | null> {
  const participants = await readParticipants(context, deps);
  const participant = participants.find((p) => p.id === participantId);
  if (!participant) {
    return null;
  }

  const characters = await resolveCharacters([participantId], deps);
  const character = characters.get(participantId);
  const want = (field: ParticipantDataField) => !fields || fields.length === 0 || fields.includes(field);

  const data: ParticipantData = { id: participantId };
  if (want("name")) {
    data.name = character?.name ?? "(unknown)";
  }
  if (want("type")) {
    data.type = character?.type ?? "character";
  }
  if (want("enabled")) {
    data.enabled = isEnabled(participant);
  }
  if (want("personality")) {
    data.personality = character?.custom?.personality ?? null;
  }
  if (want("tags")) {
    data.tags = character?.tags ?? [];
  }
  if (want("avatar")) {
    data.avatar = character?.avatar_path ?? null;
  }
  return data;
}

export async function setParticipantEnabled(context: WorkflowExecutionContext, deps: WorkflowDeps, participantId: string, enabled: boolean): Promise<SetEnabledResult> {
  const selected = useChatStore.getState().selectedChat;
  // Operate through the store when the target is the active chat so the participant
  // sidebar reflects the change immediately; fall back to a direct write otherwise.
  const targetIsSelected = selected?.id != null && (!context.chatId || context.chatId === selected.id);
  const stateLabel = enabled ? "enabled" : "disabled";

  if (targetIsSelected) {
    const participant = (selected?.participants ?? []).find((p) => p.id === participantId);
    if (!participant) {
      return { ok: false, message: `No participant found with id "${participantId}".` };
    }
    if (isEnabled(participant) === enabled) {
      return { ok: true, message: `Participant "${participantId}" is already ${stateLabel}.` };
    }
    try {
      await useChatStore.getState().actions.updateParticipant(participantId, { enabled });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : `Failed to update participant "${participantId}".` };
    }
    return { ok: true, message: `Participant "${participantId}" is now ${stateLabel}.` };
  }

  if (!context.chatId) {
    return { ok: false, message: "No active chat to update." };
  }

  const chat = await deps.getChatById(context.chatId);
  if (!belongsToCurrentProfile(chat)) {
    return { ok: false, message: `No chat found with id "${context.chatId}".` };
  }
  const participants = (chat?.participants as ChatParticipant[] | undefined) ?? [];
  const index = participants.findIndex((p) => p.id === participantId);
  if (index === -1) {
    return { ok: false, message: `No participant found with id "${participantId}".` };
  }
  if (isEnabled(participants[index]) === enabled) {
    return { ok: true, message: `Participant "${participantId}" is already ${stateLabel}.` };
  }
  const updated = participants.map((p, i) => (i === index ? { ...p, enabled } : p));
  try {
    await updateChat(context.chatId, { participants: updated });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : `Failed to update participant "${participantId}".` };
  }
  return { ok: true, message: `Participant "${participantId}" is now ${stateLabel}.` };
}

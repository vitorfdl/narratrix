import { useCharacterStore } from "@/hooks/characterStore";
import { useChatStore } from "@/hooks/chatStore";
import { useLorebookStore } from "@/hooks/lorebookStore";
import { useModelsStore } from "@/hooks/modelsStore";
import { useProfileStore } from "@/hooks/ProfileStore";
import type { Character } from "@/schema/characters-schema";
import type { CharacterFilter } from "@/services/character-service";

type CharacterUpdateData = Partial<Omit<Character, "id" | "profile_id" | "created_at" | "updated_at">>;

type ChatActions = ReturnType<typeof useChatStore.getState>["actions"];
type CharacterActions = ReturnType<typeof useCharacterStore.getState>["actions"];
type LorebookActions = ReturnType<typeof useLorebookStore.getState>["actions"];
type ModelActions = ReturnType<typeof useModelsStore.getState>["actions"];

export interface JavascriptRunnerStores {
  chat: Omit<ChatActions, "fetchChatList" | "setSelectedChatById"> & {
    fetchChatList: () => ReturnType<ChatActions["fetchChatList"]>;
    setSelectedChatById: (id: string) => ReturnType<ChatActions["setSelectedChatById"]>;
  };
  characters: Omit<CharacterActions, "fetchCharacters" | "updateCharacter"> & {
    fetchCharacters: (filter?: CharacterFilter) => ReturnType<CharacterActions["fetchCharacters"]>;
    updateCharacter: (id: string, updateData: CharacterUpdateData) => ReturnType<CharacterActions["updateCharacter"]>;
  };
  lorebook: Omit<LorebookActions, "loadLorebooks" | "loadLorebookEntries" | "deleteLorebookEntry"> & {
    loadLorebooks: () => ReturnType<LorebookActions["loadLorebooks"]>;
    loadLorebookEntries: (lorebookId: string) => ReturnType<LorebookActions["loadLorebookEntries"]>;
    deleteLorebookEntry: (id: string, lorebookId: string) => ReturnType<LorebookActions["deleteLorebookEntry"]>;
  };
  models: ModelActions;
}

export interface JavascriptRunnerUtils {
  delay: (ms: number) => Promise<void>;
  jsonParse: (text: string) => unknown;
  jsonStringify: (value: unknown) => string;
}

function buildStores(): JavascriptRunnerStores {
  const profileId = useProfileStore.getState().currentProfile?.id ?? "";
  const chatActions = useChatStore.getState().actions;
  const characterActions = useCharacterStore.getState().actions;
  const lorebookActions = useLorebookStore.getState().actions;

  return {
    chat: {
      ...chatActions,
      fetchChatList: () => chatActions.fetchChatList(profileId),
      setSelectedChatById: (id: string) => chatActions.setSelectedChatById(profileId, id),
    },
    characters: {
      ...characterActions,
      fetchCharacters: (filter?: CharacterFilter) => characterActions.fetchCharacters(profileId, filter),
      updateCharacter: (id: string, updateData: CharacterUpdateData) => characterActions.updateCharacter(profileId, id, updateData),
    },
    lorebook: {
      ...lorebookActions,
      loadLorebooks: () => lorebookActions.loadLorebooks(profileId),
      loadLorebookEntries: (lorebookId: string) => lorebookActions.loadLorebookEntries(profileId, lorebookId),
      deleteLorebookEntry: (id: string, lorebookId: string) => lorebookActions.deleteLorebookEntry(profileId, id, lorebookId),
    },
    models: useModelsStore.getState().actions,
  };
}

function buildUtils(): JavascriptRunnerUtils {
  return {
    delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    jsonParse: (text: string) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    },
    jsonStringify: (value: unknown) => JSON.stringify(value),
  };
}

export interface JavascriptRunResult {
  result: unknown;
  consoleLogs: string[];
}

/**
 * Execute arbitrary javascript code in a constrained async function scope.
 * The runner exposes `input` (the data from connected nodes), `stores`, `utils`, and a sandboxed `console`.
 * `args` is kept as a deprecated alias for `input` for backward compatibility.
 * All store functions that require a profileId have it pre-bound to the current profile automatically.
 */
export async function runJavascript(code: string, input?: unknown): Promise<JavascriptRunResult> {
  const stores = buildStores();
  const utils = buildUtils();
  const consoleLogs: string[] = [];

  const formatArgs = (args: unknown[]) => args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");

  const sandboxConsole = {
    log: (...args: unknown[]) => consoleLogs.push(formatArgs(args)),
    warn: (...args: unknown[]) => consoleLogs.push(`[WARN] ${formatArgs(args)}`),
    error: (...args: unknown[]) => consoleLogs.push(`[ERROR] ${formatArgs(args)}`),
    info: (...args: unknown[]) => consoleLogs.push(`[INFO] ${formatArgs(args)}`),
  };

  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...fnArgs: unknown[]) => Promise<unknown>;

  const fn = new AsyncFunction("input", "args", "stores", "utils", "console", `"use strict";\n${code}`);

  const result = await fn(input, input, stores, utils, sandboxConsole);
  return { result, consoleLogs };
}

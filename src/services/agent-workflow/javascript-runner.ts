import { useCharacterStore } from "@/hooks/characterStore";
import { useChatStore } from "@/hooks/chatStore";
import { useLorebookStore } from "@/hooks/lorebookStore";
import { useModelsStore } from "@/hooks/modelsStore";

export interface JavascriptRunnerStores {
  chat: ReturnType<typeof useChatStore.getState>["actions"];
  characters: ReturnType<typeof useCharacterStore.getState>["actions"];
  lorebook: ReturnType<typeof useLorebookStore.getState>["actions"];
  models: ReturnType<typeof useModelsStore.getState>["actions"];
}

export interface JavascriptRunnerUtils {
  delay: (ms: number) => Promise<void>;
  jsonParse: (text: string) => unknown;
  jsonStringify: (value: unknown) => string;
}

function buildStores(): JavascriptRunnerStores {
  return {
    chat: useChatStore.getState().actions,
    characters: useCharacterStore.getState().actions,
    lorebook: useLorebookStore.getState().actions,
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

/**
 * Execute arbitrary javascript code in a constrained async function scope.
 * The runner exposes only the provided arguments: input, args, stores, utils.
 */
export async function runJavascript(code: string, args?: unknown): Promise<unknown> {
  const stores = buildStores();
  const utils = buildUtils();

  // Create an async function with a strict, explicit parameter list
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...fnArgs: unknown[]) => Promise<unknown>;

  const fn = new AsyncFunction("input", "args", "stores", "utils", `"use strict";\n${code}`);

  return await fn(args, args, stores, utils);
}

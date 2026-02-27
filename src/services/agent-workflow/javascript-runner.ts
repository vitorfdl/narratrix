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

export interface JavascriptRunResult {
  result: unknown;
  consoleLogs: string[];
}

/**
 * Execute arbitrary javascript code in a constrained async function scope.
 * The runner exposes `input` (the data from connected nodes), `stores`, `utils`, and a sandboxed `console`.
 * `args` is kept as a deprecated alias for `input` for backward compatibility.
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

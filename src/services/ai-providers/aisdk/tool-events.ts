import type { InferenceToolCall } from "@/schema/inference-engine-schema";
import type { AIEvent } from "../types/ai-event.type";

/** Defensive shapes — AI SDK part field names vary slightly across versions. */
interface SdkToolCall {
  toolCallId?: string;
  id?: string;
  toolName?: string;
  name?: string;
  input?: unknown;
  args?: unknown;
}

interface SdkToolResult {
  toolCallId?: string;
  id?: string;
  toolName?: string;
  name?: string;
  output?: unknown;
  result?: unknown;
}

function stringifyOutput(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Bridges AI SDK tool-call / tool-result parts to the AIEvent tool hooks, tracking
 * each call by id so results can carry the original arguments through to the UI/persistence.
 *
 * `getTextOffset` (when provided) records how much assistant text preceded the call, so the
 * UI can render the tool inline at the right position rather than glued at the top/bottom.
 */
export function createToolCallTracker(event: AIEvent, getTextOffset?: () => number) {
  const calls = new Map<string, InferenceToolCall>();

  return {
    onToolCall(part: SdkToolCall) {
      const id = part.toolCallId ?? part.id ?? `tc_${part.toolName ?? part.name ?? "tool"}`;
      const call: InferenceToolCall = {
        id,
        name: part.toolName ?? part.name ?? "tool",
        arguments: (part.input ?? part.args ?? {}) as Record<string, unknown>,
        textOffset: getTextOffset?.(),
      };
      calls.set(id, call);
      event.sendToolCallStart?.({ id, toolCall: call });
    },
    onToolResult(part: SdkToolResult) {
      const id = part.toolCallId ?? part.id ?? "";
      const known = calls.get(id);
      const call: InferenceToolCall = known ?? {
        id,
        name: part.toolName ?? part.name ?? "tool",
        arguments: {},
        textOffset: getTextOffset?.(),
      };
      event.sendToolCallResult?.({ id, toolCall: call, output: stringifyOutput(part.output ?? part.result) });
    },
  };
}

/** Batch variant for non-streaming results (all calls and results known up front). */
export function emitToolCalls(event: AIEvent, toolCalls?: SdkToolCall[], toolResults?: SdkToolResult[]): void {
  if (!toolCalls?.length && !toolResults?.length) {
    return;
  }
  const tracker = createToolCallTracker(event);
  for (const call of toolCalls ?? []) {
    tracker.onToolCall(call);
  }
  for (const result of toolResults ?? []) {
    tracker.onToolResult(result);
  }
}

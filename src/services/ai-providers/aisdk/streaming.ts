import { stepCountIs, streamText } from "ai";
import { FinalParams } from "../start-inference";
import type { AIEvent } from "../types/ai-event.type";
import { createToolCallTracker } from "./tool-events";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    // Handle wrapper objects like { error: ... }
    if ("error" in error) {
      const nestedError = (error as any).error;
      // Prevent infinite recursion if error points to itself
      if (nestedError !== error) {
        return getErrorMessage(nestedError);
      }
    }
    // Handle plain objects with message
    if ("message" in error) {
      return String((error as any).message);
    }
  }

  return String(error);
}

async function streamResponse(event: AIEvent, params: FinalParams): Promise<string> {
  const abortController = new AbortController();
  let isAborted = false;

  event.registerAborter(() => {
    isAborted = true;
    abortController.abort();
  });

  let fullText = "";
  // Offset = assistant text emitted so far, so tool calls render inline at their position.
  const toolTracker = createToolCallTracker(event, () => fullText.length);

  try {
    const { fullStream } = streamText({
      ...params,
      stopWhen: stepCountIs(15),
      abortSignal: abortController.signal,
      onError: (error) => {
        event.sendError({ message: getErrorMessage(error) });
      },
      onFinish({ finishReason }) {
        // "tool-calls" is a normal intermediate stop while the SDK runs a tool step.
        if (finishReason !== "stop" && finishReason !== "tool-calls") {
          event.sendError({ message: `Inference stopped: ${finishReason}` });
        }
      },
    });

    // fullStream surfaces text, reasoning, and tool-call/result parts in one ordered stream.
    for await (const part of fullStream) {
      if (isAborted) {
        break;
      }

      switch (part.type) {
        case "text-delta": {
          const text = (part as { text?: string; textDelta?: string }).text ?? (part as { textDelta?: string }).textDelta ?? "";
          if (text) {
            fullText += text;
            event.sendStream({ text });
          }
          break;
        }
        case "reasoning-delta": {
          const reasoning = (part as { text?: string; textDelta?: string }).text ?? (part as { textDelta?: string }).textDelta ?? "";
          if (reasoning) {
            event.sendStream({ reasoning });
          }
          break;
        }
        case "tool-call":
          toolTracker.onToolCall(part as Parameters<typeof toolTracker.onToolCall>[0]);
          break;
        case "tool-result":
          toolTracker.onToolResult(part as Parameters<typeof toolTracker.onToolResult>[0]);
          break;
        default:
          break;
      }
    }

    // Signal completion if not aborted
    if (!isAborted) {
      event.finish({ fullResponse: fullText });
    }
  } catch (error) {
    // Check if error is due to abort or no output
    const isAbortError = isAborted || (error instanceof Error && (error.name === "AbortError" || error.message.includes("abort")));

    if (!isAbortError) {
      console.error("Stream Error:", error);
      if (!isAborted) {
        event.sendError({ message: getErrorMessage(error) });
      }
    }
  }

  return fullText;
}

export { streamResponse };

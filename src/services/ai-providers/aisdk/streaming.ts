import { stepCountIs, streamText } from "ai";
import { FinalParams } from "../start-inference";
import type { AIEvent } from "../types/ai-event.type";

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

  try {
    const { textStream } = streamText({
      ...params,
      stopWhen: stepCountIs(15),
      abortSignal: abortController.signal,
      onError: (error) => {
        event.sendError({ message: getErrorMessage(error) });
      },
      onFinish({ finishReason }) {
        if (finishReason !== "stop") {
          event.sendError({ message: `Inference stopped: ${finishReason}` });
        }
      },
      onChunk: ({ chunk }) => {
        // TODO: Decide if use onChunk or fullTream
        // if (chunk.type === "text-delta") {
        //   fullText += chunk.text;

        //   event.sendStream({
        //     text: chunk.text,
        //   });
        // }

        if (chunk.type === "reasoning-delta") {
          event.sendStream({
            reasoning: chunk.text,
          });
        }
      },
    });

    for await (const textPart of textStream) {
      if (isAborted) {
        break;
      }
      fullText += textPart;

      // Direct streaming
      event.sendStream({
        text: textPart,
      });
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

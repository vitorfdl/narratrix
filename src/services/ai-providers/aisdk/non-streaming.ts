import { generateText, stepCountIs } from "ai";
import type { FinalParams } from "../start-inference";
import type { AIEvent } from "../types/ai-event.type";

async function generateResponse(params: FinalParams, event?: AIEvent): Promise<string> {
  const abortController = new AbortController();

  if (event) {
    event.registerAborter(() => {
      abortController.abort();
    });
  }

  try {
    const result = await generateText({
      ...params,
      stopWhen: stepCountIs(15),
      abortSignal: abortController.signal,
    });

    return result.text;
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.message.includes("abort"))) {
      return "";
    }
    console.error("Generate Text Error:", error);
    throw error;
  }
}

export { generateResponse };

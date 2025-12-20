import { generateText, stepCountIs } from "ai";
import { FinalParams } from "../start-inference";

async function generateResponse(params: FinalParams): Promise<string> {
  try {
    const result = await generateText({
      ...params,
      stopWhen: stepCountIs(15),
    });

    return result.text;
  } catch (error) {
    console.error("Generate Text Error:", error);
    throw error;
  }
}

export { generateResponse };

import { jsonSchema, tool } from "ai";
import type { ToolsList } from "../types/request.type";

/**
 * Converts internal tool list to Vercel AI SDK tools object.
 * Wraps execution to provide SSE feedback.
 */
function convertToolsToAISDK(tools: ToolsList[] | undefined): Record<string, any> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  const aiTools: Record<string, any> = {};

  for (const t of tools) {
    const name = t.function.name;
    const description = t.function.description;
    const parameters = t.function.parameters;
    // @ts-expect-error - The internal type might be slightly different or loose
    const executeOriginal = t.function.function;

    if (!name) {
      continue;
    }

    aiTools[name] = tool({
      description,
      parameters: parameters ? jsonSchema(parameters) : jsonSchema({}),
      execute: executeOriginal
        ? async (args: any) => {
            return executeOriginal(args);
          }
        : undefined,
    });
  }

  return aiTools;
}

export { convertToolsToAISDK };

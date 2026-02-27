import { jsonSchema, type ToolSet, tool } from "ai";
import type { ExecutableToolDefinition } from "@/hooks/useInference";

/**
 * Strips non-standard fields from a JSON Schema object so it is accepted by
 * all providers (e.g. AWS Bedrock rejects `$schema`, `title`, and any type
 * other than "object" on the top-level tool input schema).
 *
 * Always returns a schema with `type: "object"` and a `properties` map.
 */
function sanitizeToolSchema(raw: Record<string, unknown>): Record<string, unknown> {
  // Destructure away fields that confuse strict providers; keep the rest.
  const { $schema: _s, title: _t, type: _ty, ...rest } = raw as Record<string, unknown>;
  return {
    type: "object",
    properties: (rest.properties as Record<string, unknown>) ?? {},
    ...(rest.required ? { required: rest.required } : {}),
    ...(rest.description ? { description: rest.description } : {}),
  };
}

/**
 * Converts an array of ExecutableToolDefinition (from the workflow layer) into
 * an AI SDK ToolSet that can be passed directly to generateText / streamText.
 *
 * Each tool is wrapped with its `execute` function so the AI SDK can handle
 * multi-step tool calling internally via `stopWhen: stepCountIs(N)`.
 */
function convertToolsToAISDK(tools: ExecutableToolDefinition[]): ToolSet {
  const toolset: ToolSet = {};

  for (const t of tools) {
    if (!t.name) {
      continue;
    }

    const rawSchema = t.parameters && typeof t.parameters === "object" ? (t.parameters as Record<string, unknown>) : {};
    const safeSchema = sanitizeToolSchema(rawSchema);

    if (t.execute) {
      const execFn = t.execute;
      toolset[t.name] = tool({
        description: t.description,
        inputSchema: jsonSchema(safeSchema),
        execute: async (args: Record<string, unknown>) => execFn(args as Record<string, any>),
      });
    } else {
      toolset[t.name] = tool({
        description: t.description,
        inputSchema: jsonSchema(safeSchema),
      });
    }
  }

  return toolset;
}

export { convertToolsToAISDK };

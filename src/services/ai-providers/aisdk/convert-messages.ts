import { ModelMessage, SystemModelMessage } from "ai";

// Define strict types for CoreMessage content parts to match Vercel AI SDK requirements
type TextPart = {
  type: "text";
  text: string;
};

type ImagePart = {
  type: "image";
  image: string | URL;
};

function toCoreMessages(systemMessage: string | undefined, messages: any[]): ModelMessage[] {
  const core: ModelMessage[] = [];

  if (systemMessage) {
    core.push({ role: "system", content: systemMessage } as SystemModelMessage);
  }

  for (const msg of messages || []) {
    if (msg.role === "user") {
      // Internal message might not have 'files', checking 'files' property existence or structure
      // The InferenceMessage type defined in schema/inference-engine-schema.ts has:
      // role, text, tool_calls, tool_call_id.
      // It does NOT seem to have 'files' directly on InferenceMessage based on previous read.
      // However, the user snippet used 'msg.files'.
      // I will check if I need to handle images differently or if the type definition was incomplete in my head.
      // The read of src/schema/inference-engine-schema.ts showed:
      /*
      const InferenceMessageSchema = z.object({
        role: z.enum(["assistant", "user", "tool"]),
        text: z.string(),
        tool_calls: z.array(InferenceToolCallSchema).optional(),
        tool_call_id: z.string().optional(),
      });
      */
      // It seems 'files' is missing in the schema I saw.
      // But maybe it's passed in 'text' as some markdown or extended type?
      // Or maybe the 'InferenceMessage' type has extra properties in runtime?
      // I will treat it as having 'files' property via 'any' cast if necessary, or check if 'files' logic is needed.
      // The user snippet had:
      /*
      const files = msg.files || [];
      if (files.length > 0) { ... }
      */

      // I will interpret 'text' as the message content.
      // If there are images, they might be separate.
      // I'll stick to 'text' for now as per schema.
      // If the user wants image support, they might need to update the schema or pass it differently.
      // BUT, to be safe and support the user's intent, I'll check if 'msg' has 'files' property (duck typing).

      const msgAny = msg as any;
      const files = msgAny.files || [];

      if (files.length > 0) {
        const contentParts: Array<TextPart | ImagePart> = [
          {
            type: "text",
            text: msg.text,
          },
          ...files.map(
            (imageUrl: string): ImagePart => ({
              type: "image",
              image: imageUrl,
            }),
          ),
        ];
        core.push({ role: "user", content: contentParts });
      } else {
        core.push({ role: "user", content: msg.text });
      }
    } else if (msg.role === "assistant") {
      // Assistant messages can have tool calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const toolCalls = msg.tool_calls.map((tc: any) => ({
          toolCallId: tc.id || "unknown",
          toolName: tc.name,
          args: typeof tc.arguments === "string" ? JSON.parse(tc.arguments) : tc.arguments,
        }));
        core.push({
          role: "assistant",
          content: [{ type: "text", text: msg.text || "" }, ...toolCalls.map((tc: any) => ({ type: "tool-call" as const, input: tc.args, toolCallId: tc.toolCallId, toolName: tc.toolName }))],
        });
      } else {
        core.push({ role: "assistant", content: msg.text });
      }
    } else if (msg.role === "tool") {
      // Tool results
      core.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: msg.tool_call_id || "unknown",
            output: { type: "text", value: msg.text || "", providerOptions: undefined },
            toolName: "unknown",
          },
        ],
      });
    }
  }

  return core;
}

export { toCoreMessages };

import { AgentEdgeType, AgentNodeType } from "@/schema/agent-schema";

export function mapHandleToInputName(handle: string): string {
  const mapping: Record<string, string> = {
    "in-input": "input",
    "in-history": "history",
    "in-system-prompt": "systemPrompt",
    response: "response",
    "in-character": "characterId",
    "in-toolset": "toolset",
    // Trigger node outputs
    "out-participant": "participantId",
  };
  return mapping[handle] || handle;
}

/**
 * Maps a source handle ID to a human-readable camelCase key for use in the
 * JavaScript node's `input` object. This is intentionally separate from
 * `mapHandleToInputName` (which maps target handles) so other nodes are unaffected.
 */
export function mapSourceHandleToReadableName(sourceHandle: string): string {
  const mapping: Record<string, string> = {
    "out-messages": "chatHistory",
    "out-chat-id": "chatId",
    "out-participant": "participantId",
    "out-string": "text",
    "out-toolset": "toolset",
    "out-text": "text",
  };
  if (mapping[sourceHandle]) {
    return mapping[sourceHandle];
  }
  // Fallback: strip "out-" prefix and camelCase the rest
  const stripped = sourceHandle.replace(/^out-/, "");
  return stripped.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function getNodeInputs(node: AgentNodeType, edges: AgentEdgeType[], contextValues: Map<string, any>): Record<string, any> {
  const inputs: Record<string, any> = {};
  const incoming = edges.filter((e) => e.target === node.id);
  for (const edge of incoming) {
    const handleScopedKey = `${edge.source}::${edge.sourceHandle}`;
    const value = contextValues.has(handleScopedKey) ? contextValues.get(handleScopedKey) : contextValues.get(edge.source);
    if (value !== undefined) {
      const key = mapHandleToInputName(edge.targetHandle);
      if (key === "toolset") {
        if (!Array.isArray(inputs.toolset)) {
          inputs.toolset = [];
        }
        const arr = Array.isArray(value) ? value : [value];
        inputs.toolset = [...inputs.toolset, ...arr];
      } else {
        inputs[key] = value;
      }
    }
  }
  return inputs;
}

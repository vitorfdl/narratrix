import { AgentEdgeType, AgentNodeType } from "@/schema/agent-schema";

export function mapHandleToInputName(handle: string): string {
  const mapping: Record<string, string> = {
    "in-input": "input",
    "in-history": "history",
    "in-system-prompt": "systemPrompt",
    response: "response",
    "in-character": "characterId",
    "in-toolset": "toolset",
  };
  return mapping[handle] || handle;
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

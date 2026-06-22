import { CornerDownLeft } from "lucide-react";
import { memo } from "react";
import type { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

/**
 * Tool Response node — terminal node for a tool-trigger agent. Its connected value
 * is returned to the calling LLM as the tool result. Unlike Chat Message, it has no
 * side effects (it never posts to the chat).
 */
const executeToolResponseNode: NodeExecutor = async (_node, inputs): Promise<NodeExecutionResult> => {
  const response = typeof inputs.response === "string" ? inputs.response : inputs.response == null ? "" : JSON.stringify(inputs.response);
  return { success: true, value: response };
};

const TOOL_RESPONSE_NODE_METADATA = {
  type: "toolResponse",
  label: "Tool Response",
  category: "Tool",
  description: "Return a result to the LLM that called this agent as a tool. No chat message is posted.",
  icon: CornerDownLeft,
  theme: createNodeTheme("yellow"),
  deletable: true,
  inputs: [{ id: "in-response", label: "Result", edgeType: "string" as const, targetRef: "response-section" }] as NodeInput[],
  outputs: [] as NodeOutput[],
  defaultConfig: {},
};

namespace ToolResponseNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: TOOL_RESPONSE_NODE_METADATA.label,
      config: TOOL_RESPONSE_NODE_METADATA.defaultConfig,
    };
  }
}

const ToolResponseContent = memo(() => {
  return (
    <div className="space-y-3 w-full">
      <NodeField label="Result" icon={CornerDownLeft} refId="response-section" helpText="The value returned to the LLM that invoked this agent. Connect the text the model should receive." />
    </div>
  );
});

ToolResponseContent.displayName = "ToolResponseContent";

export const ToolResponseNode = memo(({ data, selected, id }: NodeProps) => {
  return (
    <NodeBase nodeId={id} data={data} selected={!!selected}>
      <ToolResponseContent />
    </NodeBase>
  );
});

ToolResponseNode.displayName = "ToolResponseNode";

NodeRegistry.register({
  metadata: TOOL_RESPONSE_NODE_METADATA,
  component: ToolResponseNode,
  configProvider: ToolResponseNodeConfigProvider,
  executor: executeToolResponseNode,
});

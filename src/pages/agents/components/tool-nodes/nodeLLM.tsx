import { useUpdateNodeInternals } from "@xyflow/react";
import { useEffect } from "react";
import { NodeBase, NodeInput, NodeOutput } from "./NodeBase";
import { NodeProps } from "./nodeTypes";

/**
 * LLMNode: Node for language model operations with labeled input/output handles.
 */
export const LLMNode = ({ id, data, selected }: NodeProps) => {
  const { config } = data;

  // Define inputs
  const inputs: NodeInput[] = [
    { id: "in-string", label: "String", edgeType: "string" },
    { id: "in-stream", label: "Stream", edgeType: "stream" },
  ];

  // Define outputs
  const outputs: NodeOutput[] = [
    { id: "out-string", label: "String", edgeType: "string" },
    { id: "out-stream", label: "Stream", edgeType: "stream" },
  ];

  // Ensure React Flow updates handle positions when handles change
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputs.length, outputs.length, updateNodeInternals]);

  return (
    <NodeBase title="LLM Node" nodeType="llm" data={data} selected={!!selected} inputs={inputs} outputs={outputs}>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-1.5 text-xs">
          <div className="flex flex-col">
            <span className="font-medium text-purple-600">System Prompt</span>
            <span className="text-muted-foreground nodrag truncate">
              {config?.systemPrompt ? config.systemPrompt.substring(0, 60) + (config.systemPrompt.length > 60 ? "..." : "") : "None"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-medium text-purple-600">User Prompt</span>
            <span className="text-muted-foreground nodrag truncate">
              {config?.userPrompt ? config.userPrompt.substring(0, 60) + (config.userPrompt.length > 60 ? "..." : "") : "None"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-medium text-purple-600">Assistant Prefill</span>
            <span className="text-muted-foreground nodrag truncate">
              {config?.assistantPrefill ? config.assistantPrefill.substring(0, 60) + (config.assistantPrefill.length > 60 ? "..." : "") : "None"}
            </span>
          </div>
        </div>
      </div>
    </NodeBase>
  );
};

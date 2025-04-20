import { useEffect, useState } from "react";
import { NodeBase, NodeInput } from "./NodeBase";
import { NodeProps } from "./nodeTypes";

/**
 * EndNode: Terminal node for receiving and displaying the final string output of the pipeline.
 * Accepts only a single string input and displays its value.
 */
export const EndNode = ({ data, selected, id }: NodeProps) => {
  // The input handle definition
  const inputs: NodeInput[] = [{ id: "in-string", label: "String", edgeType: "string" }];

  // State to display the received value (if available)
  const [receivedValue, setReceivedValue] = useState<string>("");

  // Listen for updates to the data (if your system provides runtime values)
  useEffect(() => {
    // If your system provides the value via data.value or similar, update here
    if (typeof data.value === "string") {
      setReceivedValue(data.value);
    }
  }, [data.value]);

  return (
    <NodeBase title="End Node" nodeType="end" data={data} selected={!!selected} inputs={inputs} outputs={[]}>
      <div className="flex flex-col gap-2 w-full items-center">
        <span className="text-xs text-muted-foreground mb-1">Final Output:</span>
        <div className="w-full min-h-[32px] max-h-32 overflow-y-auto bg-muted/50 rounded p-2 font-mono text-xs text-foreground text-center">
          {receivedValue ? receivedValue : <span className="text-muted-foreground">No value received</span>}
        </div>
      </div>
    </NodeBase>
  );
};

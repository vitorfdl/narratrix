import { NodeBase, NodeOutput } from "./NodeBase";
import { NodeProps } from "./nodeTypes";

/**
 * StartNode: The entry node for the tool pipeline. Cannot be deleted.
 * Shows output fields as labeled handles on the right.
 */
export const StartNode = ({ data, selected }: NodeProps) => {
  const { config } = data;
  const fields: string[] = config?.fields || [];

  // Convert fields to NodeOutput format
  const outputs: NodeOutput[] = [
    {
      id: "JSON",
      label: "JSON",
      edgeType: "json",
    },
  ];
  return (
    <NodeBase title="Start Node" nodeType="start" data={data} selected={!!selected} outputs={outputs}>
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium">
          {fields.length > 0 ? (
            <>
              <div className="text-sm text-foreground mb-2">
                Providing {fields.length} output field{fields.length !== 1 ? "s" : ""}:
              </div>
              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                {fields.map((field, idx) => (
                  <li key={idx}>{field}</li>
                ))}
              </ul>
            </>
          ) : (
            <span className="text-muted-foreground">No output fields configured</span>
          )}
        </div>
      </div>
    </NodeBase>
  );
};

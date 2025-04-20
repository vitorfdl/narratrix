import { Connection, Handle, Position } from "@xyflow/react";
import React from "react";
import { ToolNodeData } from "../ToolEditor";

export type EdgeType = "default" | "success" | "error" | "string" | "json" | "stream";

export interface NodeInput {
  id: string;
  label: string;
  edgeType?: EdgeType;
}

export interface NodeOutput {
  id: string;
  label: string;
  edgeType?: EdgeType;
}

export interface NodeBaseProps {
  title: string;
  nodeType: string;
  data: ToolNodeData;
  selected: boolean;
  inputs?: NodeInput[];
  outputs?: NodeOutput[];
  children?: React.ReactNode;
  nodeColor?: string;
}

/**
 * NodeBase component that provides consistent styling and structure for all nodes
 * following the design in the provided image.
 */
export const NodeBase: React.FC<NodeBaseProps> = ({
  title,
  nodeType,
  data,
  selected,
  inputs = [],
  outputs = [],
  children,
  nodeColor = "primary",
}) => {
  // Get background color based on nodeType or use the provided nodeColor
  const getBackgroundClass = () => {
    switch (nodeType) {
      default:
        return "bg-accent";
    }
  };

  // Get border and handle color based on nodeType or use the provided nodeColor
  const getBorderAndHandleColor = () => {
    switch (nodeType) {
      case "llm":
        return "primary";
      case "javascript":
        return "yellow-500";
      case "start":
        return "primary";
      default:
        return nodeColor;
    }
  };

  const borderColor = getBorderAndHandleColor();
  const backgroundClass = getBackgroundClass();

  // Restrict connections to matching edgeType
  const isValidConnection = (handleEdgeType?: EdgeType) => (connection: Connection) => {
    // If the target handle has an edgeType, only allow if it matches the source handle's edgeType
    if (connection.sourceHandle && connection.targetHandle) {
      // The source handle's edgeType is passed via data-edge-type attribute
      const sourceHandle = document.querySelector(`[data-handleid='${connection.sourceHandle}']`);
      const sourceEdgeType = sourceHandle?.getAttribute("data-edge-type");
      return !handleEdgeType || !sourceEdgeType || sourceEdgeType === handleEdgeType;
    }
    return true;
  };

  const edgeTypeToBgClass: Record<EdgeType, string> = {
    success: "!bg-green-500",
    error: "!bg-red-500",
    string: "!bg-blue-500",
    json: "!bg-yellow-500",
    stream: "!bg-purple-500",
    default: "!bg-primary",
  };

  const getNodeColor = () => {
    switch (nodeType) {
      case "javascript":
        return "yellow-500";
      default:
        return nodeColor;
    }
  };

  return (
    <div
      className={`max-w-[200px] rounded-md border-2 ${selected ? `border-${borderColor}` : "border-border"} ${backgroundClass} shadow-md shadow-black/50 min-w-[280px] flex flex-col p-0 relative`}
    >
      {/* Header */}
      <div className={`flex items-center px-2 py-0.5 border-b border-border/60 !bg-${getNodeColor()} rounded-t-md`}>
        <div className="font-medium text-xs text-background">{title}</div>
      </div>

      {/* Body */}
      <div className="flex flex-1 relative cursor-pointer">
        {/* Inputs section */}
        {inputs.length > 0 && (
          <div className="flex flex-col justify-evenly gap-1 py-2">
            {inputs.map((input) => (
              <div key={input.id} className="relative flex flex-row items-center min-h-[24px] justify-en">
                <Handle
                  type="target"
                  position={Position.Left}
                  key={input.id}
                  id={input.id}
                  className={`${edgeTypeToBgClass[input.edgeType ?? "default"]} !border-2 !border-background dark:!border-black !w-3 !h-3`}
                  data-edge-type={input.edgeType || "default"}
                  data-handleid={input.id}
                  isValidConnection={isValidConnection(input.edgeType) as any}
                />
                <span className="text-xs text-muted-foreground ml-2">{input.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 p-2 mx-2 flex items-center justify-center">{children}</div>

        {/* Outputs section */}
        {outputs.length > 0 && (
          <div className="flex flex-col justify-evenly gap-1 py-2">
            {outputs.map((output) => {
              return (
                <div key={output.id} className="relative flex flex-row items-center min-h-[24px] justify-end">
                  <span className="text-xs text-muted-foreground mr-2">{output.label}</span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={output.id}
                    key={output.id}
                    className={`${edgeTypeToBgClass[output.edgeType ?? "default"]} !border-2 !border-background dark:!border-black !w-3 !h-3`}
                    data-edge-type={output.edgeType || "default"}
                    data-handleid={output.id}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

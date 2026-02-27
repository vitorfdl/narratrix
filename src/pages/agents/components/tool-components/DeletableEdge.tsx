import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath, useReactFlow } from "@xyflow/react";
import { Minus } from "lucide-react";
import React, { useCallback } from "react";

export const DeletableEdge: React.FC<EdgeProps> = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, selected, markerEnd }) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setEdges((edges) => edges.filter((edge) => edge.id !== id));
    },
    [id, setEdges],
  );

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="absolute flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 shadow-sm transition-colors duration-150 cursor-pointer pointer-events-auto nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onClick={handleDelete}
          >
            <Minus className="h-3 w-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

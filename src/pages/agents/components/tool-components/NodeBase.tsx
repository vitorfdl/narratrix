import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { EdgeRegistry, EdgeType } from "./edge-registry";
import { areEdgeTypesCompatible, isValidEdgeConnection } from "./edge-utils";
import { NodeRegistry, NodeTheme } from "./node-registry";
import { ToolNodeData } from "./types";

export type { EdgeType } from "./edge-registry";

// Connection state for tracking edge dragging
interface ConnectionState {
  isConnecting: boolean;
  sourceNodeId?: string;
  sourceHandleId?: string;
  sourceEdgeType?: EdgeType;
}

// Context for connection state
const ConnectionStateContext = createContext<ConnectionState>({
  isConnecting: false,
});

// Provider for connection state
export const ConnectionStateProvider: React.FC<{
  connectionState: ConnectionState;
  children: React.ReactNode;
}> = ({ connectionState, children }) => {
  return <ConnectionStateContext.Provider value={connectionState}>{children}</ConnectionStateContext.Provider>;
};

// Hook to access connection state
export const useConnectionState = () => {
  return useContext(ConnectionStateContext);
};

export interface NodeInput {
  id: string;
  label: string;
  edgeType?: EdgeType;
  targetRef?: string; // Reference to a specific element ID for precise positioning
  offsetY?: number; // Additional Y offset for fine-tuning
}

export interface NodeOutput {
  id: string;
  label: string;
  edgeType?: EdgeType;
  targetRef?: string; // Reference to a specific element ID for precise positioning
  offsetY?: number; // Additional Y offset for fine-tuning
}

export interface NodeBaseProps {
  nodeId: string;
  data: ToolNodeData;
  selected: boolean;
  children?: React.ReactNode;
  onRegisterRef?: (id: string, element: HTMLElement) => void; // Callback to register element refs
}

// Context for registering element refs within the node
const NodeRefContext = createContext<((id: string, element: HTMLElement | null) => void) | null>(null);

// Context for node deletion
const NodeDeleteContext = createContext<((nodeId: string) => void) | null>(null);

// Hook to register element refs
export const useNodeRef = () => {
  return useContext(NodeRefContext);
};

// Hook to delete nodes
export const useNodeDelete = () => {
  return useContext(NodeDeleteContext);
};

// Provider for node deletion
export const NodeDeleteProvider: React.FC<{
  onDelete: (nodeId: string) => void;
  children: React.ReactNode;
}> = ({ onDelete, children }) => {
  return <NodeDeleteContext.Provider value={onDelete}>{children}</NodeDeleteContext.Provider>;
};

export const NodeBase: React.FC<NodeBaseProps> = ({ nodeId, data, selected, children, onRegisterRef }) => {
  const { getNode, getEdges, getNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [isHovered, setIsHovered] = useState(false);
  const elementRefs = useRef<Map<string, HTMLElement>>(new Map());
  const nodeRef = useRef<HTMLDivElement>(null);
  const deleteNode = useNodeDelete();
  const [refsRegistered, setRefsRegistered] = useState(0);
  const connectionState = useConnectionState();

  // Get node metadata from registry
  const nodeType = getNode(nodeId)?.type || "";
  const nodeMetadata = NodeRegistry.getNodeMetadata(nodeType);

  if (!nodeMetadata) {
    console.warn(`Node type "${nodeType}" not found in registry`);
    return null;
  }

  const { label: title, icon, deletable = true, inputs = [], outputs = [] } = nodeMetadata;

  // Register element refs
  const registerElementRef = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) {
        elementRefs.current.set(id, element);
        onRegisterRef?.(id, element);
        setRefsRegistered((prev) => prev + 1);
      } else {
        elementRefs.current.delete(id);
        setRefsRegistered((prev) => prev - 1);
      }
    },
    [onRegisterRef],
  );

  // Calculate handle positions based on registered elements (for input handles only)
  const calculateHandlePosition = (handleId: string, targetRef?: string, offsetY = 0, isOutput = false) => {
    if (!targetRef || !nodeRef.current) {
      // Fallback positioning
      if (isOutput) {
        // For outputs without refs, use bottom-based positioning
        const outputIndex = outputs.findIndex((output) => output.id === handleId);
        const fallbackBottom = outputs.length === 1 ? "20px" : `${20 + outputIndex * 30}px`;
        return { bottom: fallbackBottom };
      }
      return { top: `${50 + offsetY}%` };
    }

    const targetElement = elementRefs.current.get(targetRef);
    if (!targetElement) {
      // Fallback positioning when ref not found
      if (isOutput) {
        const outputIndex = outputs.findIndex((output) => output.id === handleId);
        const fallbackBottom = outputs.length === 1 ? "20px" : `${20 + outputIndex * 30}px`;
        return { bottom: fallbackBottom };
      }
      return { top: `${50 + offsetY}%` };
    }

    const nodeRect = nodeRef.current.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    // Calculate the center of the target element relative to the node
    const relativeTop = targetRect.top - nodeRect.top + targetRect.height / 2;
    const percentage = (relativeTop / nodeRect.height) * 100;

    return { top: `${Math.max(10, Math.min(90, percentage + offsetY))}%` };
  };

  // Update handle positions when elements change
  const [handlePositions, setHandlePositions] = useState<Record<string, { top?: string; bottom?: string }>>({});

  // Update positions when refs are registered or layout changes
  const updatePositions = useCallback(() => {
    const newPositions: Record<string, { top?: string; bottom?: string }> = {};

    // Input handles use dynamic positioning based on registered elements
    inputs.forEach((input) => {
      newPositions[`input-${input.id}`] = calculateHandlePosition(input.id, input.targetRef, input.offsetY, false);
    });

    // Output handles now also use ref-based positioning when available
    outputs.forEach((output) => {
      newPositions[`output-${output.id}`] = calculateHandlePosition(output.id, output.targetRef, output.offsetY, true);
    });

    setHandlePositions(newPositions);

    // Update React Flow internals to refresh handle positions
    updateNodeInternals(nodeId);
  }, [inputs, outputs, nodeId, updateNodeInternals]);

  // Update positions when refs change or on mount
  useEffect(() => {
    // Multiple timeouts to ensure DOM is ready
    const timers = [setTimeout(updatePositions, 0), setTimeout(updatePositions, 100), setTimeout(updatePositions, 300)];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [updatePositions]);

  // Also update on resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver(updatePositions);
    if (nodeRef.current) {
      resizeObserver.observe(nodeRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updatePositions]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (deleteNode && deletable) {
        deleteNode(nodeId);
      }
    },
    [deleteNode, nodeId, deletable],
  );

  const getNodeTheme = (): NodeTheme => {
    // First try to get custom theme from node metadata
    if (nodeMetadata.theme) {
      return nodeMetadata.theme;
    }

    // Fallback to legacy color-based themes for backward compatibility
    const legacyThemes = {
      primary: {
        border: "border-primary/60",
        bg: "bg-primary/20",
        header: "bg-primary/30",
        hover: "hover:border-primary",
        selected: "ring-2 ring-primary ring-offset-2 ring-offset-background",
        icon: "text-primary",
      },
      secondary: {
        border: "border-secondary/60",
        bg: "bg-secondary/20",
        header: "bg-secondary/30",
        hover: "hover:border-secondary",
        selected: "ring-2 ring-secondary ring-offset-2 ring-offset-background",
        icon: "text-secondary",
      },
      accent: {
        border: "border-accent/60",
        bg: "bg-accent/20",
        header: "bg-accent/30",
        hover: "hover:border-accent",
        selected: "ring-2 ring-accent ring-offset-2 ring-offset-background",
        icon: "text-accent",
      },
      destructive: {
        border: "border-destructive/60",
        bg: "bg-destructive/20",
        header: "bg-destructive/30",
        hover: "hover:border-destructive",
        selected: "ring-2 ring-destructive ring-offset-2 ring-offset-background",
        icon: "text-destructive",
      },
      muted: {
        border: "border-muted-foreground/60",
        bg: "bg-muted/20",
        header: "bg-muted/30",
        hover: "hover:border-muted-foreground",
        selected: "ring-2 ring-muted-foreground ring-offset-2 ring-offset-background",
        icon: "text-muted-foreground",
      },
    };

    const legacyColor = nodeMetadata.color || "primary";
    return legacyThemes[legacyColor as keyof typeof legacyThemes] || legacyThemes.primary;
  };

  const theme = getNodeTheme();

  const isValidConnection = (handleEdgeType?: EdgeType) => (connection: any) => {
    // Get fresh data on each validation call
    const currentEdges = getEdges();
    const currentNodes = getNodes();

    // Use centralized validation with fresh data
    const validation = isValidEdgeConnection(
      connection.source,
      connection.sourceHandle || "",
      connection.target,
      connection.targetHandle || "",
      currentNodes as any,
      currentEdges,
    );

    if (!validation.valid && !validation.existingEdge) {
      console.warn(`Handle validation failed for ${nodeId}:${connection.targetHandle || connection.sourceHandle}: ${validation.error}`);
      return false;
    }

    return true;
  };

  const getHandleColor = (edgeType?: EdgeType) => {
    if (!edgeType) {
      return "hsl(var(--primary))";
    }
    return EdgeRegistry.getColor(edgeType);
  };

  // Check if a handle is valid for the current connection
  const isHandleValidForConnection = (handleEdgeType?: EdgeType, isInputHandle = false) => {
    if (!connectionState.isConnecting || !connectionState.sourceEdgeType) {
      return true; // No connection in progress, all handles are valid
    }

    // For input handles, check if they can accept the source edge type
    if (isInputHandle) {
      return areEdgeTypesCompatible(connectionState.sourceEdgeType, handleEdgeType || "string");
    }

    // For output handles, they're not valid targets during connection
    return false;
  };

  // Get handle opacity based on connection state
  const getHandleOpacity = (handleEdgeType?: EdgeType, isInputHandle = false) => {
    if (!connectionState.isConnecting) {
      return 1; // Full opacity when not connecting
    }

    return isHandleValidForConnection(handleEdgeType, isInputHandle) ? 1 : 0.3;
  };

  // Get handle style with visual feedback
  const getHandleStyle = (baseStyle: any, handleEdgeType?: EdgeType, isInputHandle = false) => {
    const opacity = getHandleOpacity(handleEdgeType, isInputHandle);
    const isValid = isHandleValidForConnection(handleEdgeType, isInputHandle);

    return {
      ...baseStyle,
      opacity,
      transition: "opacity 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
      // Add a subtle glow to valid input handles during connection
      boxShadow: connectionState.isConnecting && isInputHandle && isValid ? `0 0 8px ${getHandleColor(handleEdgeType)}40` : undefined,
    };
  };

  return (
    <NodeRefContext.Provider value={registerElementRef}>
      <div
        ref={nodeRef}
        data-nodetype={nodeType}
        className={cn(
          "relative min-w-[280px] max-w-[400px] rounded-lg border-2 transition-all duration-200",
          theme.border,
          "bg-background",
          theme.hover,
          selected && theme.selected,
          "shadow-sm hover:shadow-md",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className={cn("flex items-center justify-between px-4 py-3 rounded-t-md", theme.header)}>
          <div className="flex items-center gap-2">
            {icon && React.createElement(icon, { className: cn("h-4 w-4", theme.icon) })}
            <h3 className="font-medium text-sm">{title}</h3>
          </div>

          {deletable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className={cn(
                "h-6 w-6 p-0 hover:bg-destructive/10 transition-opacity duration-200",
                isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
              )}
            >
              <Trash2 className="h-2 w-2 text-destructive" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className={cn("p-2", "bg-background")}>{children}</div>

        {/* Output Section */}
        {outputs.length > 0 && (
          <div className="px-4 pb-3 bg-background border-t border-border/50">
            <div className="space-y-2 pt-2">
              {outputs.map((output, index) => (
                <div
                  key={`output-label-${output.id}`}
                  ref={(el) => registerElementRef(`output-${output.id}`, el)}
                  className="flex items-center justify-end"
                  style={{
                    marginBottom: index < outputs.length - 1 ? "16px" : "0",
                  }}
                >
                  <span className="text-xs text-muted-foreground font-medium mr-2">{output.label}</span>
                  <div className="w-3 h-3 rounded-full border-2 border-background" style={{ backgroundColor: getHandleColor(output.edgeType) }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Handles */}
        {inputs.map((input) => (
          <Handle
            key={`input-${input.id}`}
            id={input.id}
            type="target"
            position={Position.Left}
            style={getHandleStyle(
              {
                ...handlePositions[`input-${input.id}`],
                background: getHandleColor(input.edgeType),
                width: "0.9rem",
                height: "0.9rem",
                border: "2px solid hsl(var(--background))",
                left: "-1px",
              },
              input.edgeType,
              true,
            )}
            isValidConnection={isValidConnection(input.edgeType)}
            data-edge-type={input.edgeType}
            data-handleid={input.id}
          />
        ))}

        {/* Output Handles */}
        {outputs.map((output) => (
          <Handle
            key={output.id}
            id={output.id}
            type="source"
            position={Position.Right}
            style={getHandleStyle(
              {
                ...handlePositions[`output-${output.id}`],
                background: getHandleColor(output.edgeType),
                width: "0.9rem",
                height: "0.9rem",
                border: "2px solid hsl(var(--background))",
                bottom: "-1px",
              },
              output.edgeType,
              false,
            )}
            isValidConnection={isValidConnection(output.edgeType)}
            data-edge-type={output.edgeType}
            data-handleid={output.id}
          />
        ))}
      </div>
    </NodeRefContext.Provider>
  );
};

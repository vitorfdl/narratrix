import { Button } from "@/components/ui/button";
import { Connection, Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { FileOutput, Trash2 } from "lucide-react";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ToolNodeData } from "../AgentEditor";

export type EdgeType = "default" | "success" | "error" | "string" | "toolset" | "stream";

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
  title: string;
  nodeType: string;
  data: ToolNodeData;
  selected: boolean;
  inputs?: NodeInput[];
  outputs?: NodeOutput[];
  children?: React.ReactNode;
  nodeColor?: string;
  icon?: React.ReactNode;
  onRegisterRef?: (id: string, element: HTMLElement) => void; // Callback to register element refs
  nodeId?: string; // Add explicit nodeId prop
  deletable?: boolean; // Whether the node can be deleted
}

// Context for providing registerElementRef to child components
const NodeRefContext = createContext<((id: string, element: HTMLElement | null) => void) | null>(null);

// Context for providing delete handler to all nodes
const NodeDeleteContext = createContext<((nodeId: string) => void) | null>(null);

export const useNodeRef = () => {
  const registerElementRef = useContext(NodeRefContext);
  return registerElementRef;
};

export const useNodeDelete = () => {
  const deleteHandler = useContext(NodeDeleteContext);
  return deleteHandler;
};

export const NodeDeleteProvider: React.FC<{ 
  onDelete: (nodeId: string) => void; 
  children: React.ReactNode; 
}> = ({ onDelete, children }) => {
  return (
    <NodeDeleteContext.Provider value={onDelete}>
      {children}
    </NodeDeleteContext.Provider>
  );
};

/**
 * NodeBase component that provides sophisticated Langflow-style design with proper handle positioning
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
  icon,
  onRegisterRef,
  nodeId,
  deletable = true,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const elementRefsRef = useRef<Map<string, HTMLElement>>(new Map());
  const updateNodeInternals = useUpdateNodeInternals();
  const updateTimeoutRef = useRef<number | null>(null);
  const [handlePositions, setHandlePositions] = useState<Map<string, number>>(new Map());
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  
  // Get the delete handler from context
  const deleteHandler = useNodeDelete();

  // Get the actual node ID
  const actualNodeId = nodeId || (data as any).id || nodeType;

  // Handle delete button click with confirmation
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!deleteConfirmation) {
      // First click - show confirmation state
      setDeleteConfirmation(true);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setDeleteConfirmation(false), 3000);
    } else {
      // Second click - actually delete
      if (typeof actualNodeId === 'string') {
        deleteHandler?.(actualNodeId);
      }
    }
  }, [deleteHandler, actualNodeId, deleteConfirmation]);

  // Reset confirmation when node is deselected
  useEffect(() => {
    if (!selected) {
      setDeleteConfirmation(false);
    }
  }, [selected]);

  // Check if this node is deletable
  const isDeletable = deletable;

  // Calculate handle positions based on referenced elements
  const calculateHandlePositions = useCallback(() => {
    if (!nodeRef.current) return;

    const newPositions = new Map<string, number>();

    // Calculate input handle positions using offsetTop instead of getBoundingClientRect
    inputs.forEach((input) => {
      if (input.targetRef) {
        const targetElement = elementRefsRef.current.get(input.targetRef);
        if (targetElement && targetElement.offsetHeight > 0) {
          // Use offsetTop relative to the node container
          let relativeTop = targetElement.offsetTop;
          let parent = targetElement.offsetParent;
          
          // Walk up the DOM tree until we reach the node container
          while (parent && parent !== nodeRef.current) {
            relativeTop += (parent as HTMLElement).offsetTop;
            parent = (parent as HTMLElement).offsetParent;
          }
          
          // Add half the element height to center the handle
          relativeTop += targetElement.offsetHeight / 2;
          
          // Apply any additional offset
          if (input.offsetY) {
            relativeTop += input.offsetY;
          }
          
          newPositions.set(input.id, Math.max(10, relativeTop));
        }
      }
    });

    // Calculate output handle positions using offsetTop instead of getBoundingClientRect
    outputs.forEach((output) => {
      const outputElementId = `output-${output.id}`;
      const targetElement = elementRefsRef.current.get(outputElementId);
      if (targetElement && targetElement.offsetHeight > 0) {
        // Use offsetTop relative to the node container
        let relativeTop = targetElement.offsetTop;
        let parent = targetElement.offsetParent;
        
        // Walk up the DOM tree until we reach the node container
        while (parent && parent !== nodeRef.current) {
          relativeTop += (parent as HTMLElement).offsetTop;
          parent = (parent as HTMLElement).offsetParent;
        }
        
        // Add half the element height to center the handle
        relativeTop += targetElement.offsetHeight / 2;
        
        // Apply any additional offset
        if (output.offsetY) {
          relativeTop += output.offsetY;
        }
        
        newPositions.set(output.id, Math.max(10, relativeTop));
      }
    });

    // Only update if we have new positions
    if (newPositions.size > 0) {
      setHandlePositions(newPositions);
    }
  }, [inputs, outputs]);

  // Debounced update function to prevent excessive calls
  const debouncedUpdate = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = window.setTimeout(() => {
      calculateHandlePositions();
      if (typeof actualNodeId === 'string') {
        updateNodeInternals(actualNodeId);
      }
    }, 100);
  }, [calculateHandlePositions, updateNodeInternals, actualNodeId]);

  // Register element ref for precise positioning
  const registerElementRef = useCallback((id: string, element: HTMLElement | null) => {
    const currentElement = elementRefsRef.current.get(id);
    
    if (element && currentElement !== element) {
      elementRefsRef.current.set(id, element);
      onRegisterRef?.(id, element);
      
      // Only update if we have a valid node ID
      if (typeof actualNodeId === 'string') {
        debouncedUpdate();
      }
      
    } else if (!element && elementRefsRef.current.has(id)) {
      elementRefsRef.current.delete(id);
      
      // Only update if we have a valid node ID
      if (typeof actualNodeId === 'string') {
        debouncedUpdate();
      }
    }
  }, [onRegisterRef, debouncedUpdate, actualNodeId]);

  // Update handle positions when inputs or outputs change
  useEffect(() => {
    if (typeof actualNodeId === 'string') {
      debouncedUpdate();
    }
  }, [inputs.length, outputs.length, debouncedUpdate, actualNodeId]);

  // Initial update on mount
  useEffect(() => {
    if (typeof actualNodeId === 'string') {
      const timeout = setTimeout(() => {
        calculateHandlePositions();
        updateNodeInternals(actualNodeId);
      }, 300); // Longer delay for initial mount

      return () => {
        clearTimeout(timeout);
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
      };
    }
  }, []); // Empty dependency array for mount only

  // Get theme colors based on nodeType
  const getNodeTheme = () => {
    switch (nodeType) {
      case "agent":
        return {
          headerBg: "bg-primary",
          headerText: "text-primary-foreground",
          bodyBg: "bg-card",
          borderColor: "border-primary/20",
          accentColor: "primary",
        };
      case "chatInput":
        return {
          headerBg: "bg-secondary",
          headerText: "text-secondary-foreground",
          bodyBg: "bg-card",
          borderColor: "border-secondary/20",
          accentColor: "secondary",
        };
      case "chatOutput":
        return {
          headerBg: "bg-accent",
          headerText: "text-accent-foreground",
          bodyBg: "bg-card",
          borderColor: "border-accent/20",
          accentColor: "accent",
        };
      case "message":
        return {
          headerBg: "bg-green-600",
          headerText: "text-white",
          bodyBg: "bg-card",
          borderColor: "border-green-600/20",
          accentColor: "green-600",
        };
      case "llm":
        return {
          headerBg: "bg-blue-600",
          headerText: "text-white",
          bodyBg: "bg-card",
          borderColor: "border-blue-600/20",
          accentColor: "blue-600",
        };
      case "javascript":
        return {
          headerBg: "bg-yellow-600",
          headerText: "text-white",
          bodyBg: "bg-card",
          borderColor: "border-yellow-600/20",
          accentColor: "yellow-600",
        };
      default:
        return {
          headerBg: "bg-muted",
          headerText: "text-muted-foreground",
          bodyBg: "bg-card",
          borderColor: "border-muted/20",
          accentColor: "muted",
        };
    }
  };

  const theme = getNodeTheme();

  // Restrict connections to matching edgeType
  const isValidConnection = (handleEdgeType?: EdgeType) => (connection: Connection) => {
    if (connection.sourceHandle && connection.targetHandle) {
      const sourceHandle = document.querySelector(`[data-handleid='${connection.sourceHandle}']`);
      const sourceEdgeType = sourceHandle?.getAttribute("data-edge-type");
      return !handleEdgeType || !sourceEdgeType || sourceEdgeType === handleEdgeType;
    }
    return true;
  };

  const getHandleColor = (edgeType?: EdgeType) => {
    switch (edgeType) {
      case "success":
        return "!bg-green-500 !border-green-400 !shadow-lg !shadow-green-500/30";
      case "error":
        return "!bg-red-500 !border-red-400 !shadow-lg !shadow-red-500/30";
      case "string":
        return "!bg-blue-500 !border-blue-400 !shadow-lg !shadow-blue-500/30";
      case "toolset":
        return "!bg-yellow-500 !border-yellow-400 !shadow-lg !shadow-yellow-500/30";
      case "stream":
        return "!bg-purple-500 !border-purple-400 !shadow-lg !shadow-purple-500/30";
      default:
        return "!bg-primary !border-primary/80 !shadow-lg !shadow-primary/30";
    }
  };

  return (
    <div
      ref={nodeRef}
      className={`
        relative min-w-[280px] max-w-[320px] rounded-lg border-2 
        ${selected ? `border-primary shadow-lg shadow-primary/20` : `${theme.borderColor} shadow-md`}
        ${theme.bodyBg} transition-all duration-100 
        ${selected ? 'scale-105' : 'hover:shadow-lg'}
        mr-3
      `}
      style={{ marginRight: '12px' }}
    >
      {/* Header */}
      <div className={`${theme.headerBg} ${theme.headerText} px-4 py-2 flex rounded-t-lg items-center gap-2 border-b border-border/10`}>
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div className="font-semibold text-sm truncate">{title}</div>
        <div className="ml-auto flex items-center gap-2">
          {isDeletable && selected && (
            <Button
              onClick={handleDeleteClick}
              variant={!deleteConfirmation ? "destructive" : "destructive"}
              size="xs"
              title={deleteConfirmation ? "Click again to confirm deletion" : "Delete node"}
            >
              <div className="flex items-center gap-1">
                <Trash2 className="!h-3 !w-3" />
                {deleteConfirmation && (
                  <span className="text-xxs font-semibold animate-pulse">Confirm?</span>
                )}
              </div>
            </Button>
          )}
          {/* <div className="w-2 h-2 rounded-full bg-green-500 opacity-60" /> */}
        </div>
      </div>

      {/* Input handles - positioned based on referenced elements */}
      {inputs.map((input, index) => {
        const calculatedTop = handlePositions.get(input.id);
        const fallbackTop = inputs.length === 1 ? '50%' : `${15 + (index * (70 / Math.max(inputs.length - 1, 1)))}%`;
        
        return (
          <Handle
            key={input.id}
            type="target"
            position={Position.Left}
            id={input.id}
            className={`${getHandleColor(input.edgeType)} !w-3 !h-3 !border-2 !rounded-full transition-all !opacity-100 !cursor-crosshair hover:!border-white hover:!shadow-lg hover:!shadow-white/30`}
            style={calculatedTop !== undefined ? { 
              top: `${calculatedTop}px`,
              left: '-8px',
              transform: 'translateY(-50%)',
              zIndex: 10
            } : { 
              top: fallbackTop,
              left: '-8px',
              zIndex: 10
            }}
            data-edge-type={input.edgeType || "default"}
            data-handleid={input.id}
            isValidConnection={isValidConnection(input.edgeType) as any}
          />
        );
      })}

      {/* Body */}
      <div className="relative px-4 py-4">
        {/* Main content area */}
        <NodeRefContext.Provider value={registerElementRef}>
          <div className="w-full">
            {children}
          </div>
        </NodeRefContext.Provider>
      </div>

      {/* Response Section for Output Handles */}
      {outputs.length > 0 && (
        <div className="border-t border-foreground/30 bg-foreground/10 px-4 py-2">
          <div className="space-y-2">
            <div className="space-y-1">
              {outputs.map((output, index) => {
                const outputElementId = `output-${output.id}`;
                return (
                  <div 
                    key={output.id}
                    ref={(el) => registerElementRef(outputElementId, el)}
                    className="flex items-center gap-1 p-0 rounded-md  relative justify-end text-right"
                  >
                    <span className="text-xs font-medium">{output.label}</span>
                    <FileOutput className="h-3 w-3 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Output handles - positioned based on referenced elements */}
      {outputs.map((output, index) => {
        const calculatedTop = handlePositions.get(output.id);
        const fallbackBottom = outputs.length === 1 ? '20px' : `${20 + (index * 30)}px`;
        
        return (
          <Handle
            key={output.id}
            type="source"
            position={Position.Right}
            id={output.id}
            className={`${getHandleColor(output.edgeType)} !w-3 !h-3 !border-2 !rounded-full transition-all duration-200 !opacity-100 !cursor-crosshair hover:!border-white hover:!shadow-lg hover:!shadow-white/30`}
            style={calculatedTop !== undefined ? { 
              top: `${calculatedTop}px`,
              right: '-8px',
              transform: 'translateY(-50%)',
              zIndex: 10
            } : { 
              bottom: fallbackBottom,
              right: '-8px',
              zIndex: 10
            }}
            data-edge-type={output.edgeType || "default"}
            data-handleid={output.id}
          />
        );
      })}
    </div>
  );
};

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useThemeStore } from "@/hooks/ThemeContext";
import {
  AgentEdgeType,
  AgentNodeType,
  AgentType
} from "@/schema/agent-schema";
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  MiniMap,
  Node,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  XYPosition,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { EdgeType, NodeDeleteProvider } from "./tool-nodes/NodeBase";
import { NodeConfigRegistry } from "./tool-nodes/NodeConfigRegistry";
import {
  AgentNode,
  ChatInputNode,
  ChatOutputNode,
  JavascriptNode,
  NODE_TYPE_OPTIONS,
} from "./tool-nodes/nodeTypes";

// Node type keys - updated to match Langflow style
export type ToolNodeType = "agent" | "chatInput" | "chatOutput" | "javascript" | "message";

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  chatInput: ChatInputNode,
  chatOutput: ChatOutputNode,
  javascript: JavascriptNode,
};

// Use schema types instead of custom interfaces
// export type AgentNodeType = AgentNodeType;
// export type AgentEdgeType = AgentEdgeType;

// Node data typing for React Flow
export interface ToolNodeData {
  label: string;
  config?: Record<string, any>;
  [key: string]: unknown;
}

// Props for the ToolEditor component
export interface ToolEditorProps {
  toolConfig: AgentType;
  onSave?: (config: AgentType) => void;
  onChange?: (config: AgentType) => void;
  readOnly?: boolean;
}

// Get edge style based on edge type and selection state
const getEdgeStyle = (edgeType?: EdgeType, selected?: boolean) => {
  const baseStyle = {
    strokeWidth: selected ? 4 : 2,
    strokeDasharray: undefined as string | undefined,
  };

  // Selection styling overrides
  if (selected) {
    return {
      ...baseStyle,
      stroke: "hsl(var(--primary))",
      strokeWidth: 4,
      filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.6))",
    };
  }

  switch (edgeType) {
    case "string":
      return { 
        ...baseStyle, 
        stroke: "#3b82f6", // blue-500
        strokeWidth: 2,
      };
    case "toolset":
      return { 
        ...baseStyle, 
        stroke: "#eab308", // yellow-500
        strokeWidth: 2,
      };
    case "stream":
      return { 
        ...baseStyle, 
        stroke: "#a855f7", // purple-500
        strokeWidth: 3,
        strokeDasharray: "8,4",
      };
    default:
      return { 
        ...baseStyle, 
        stroke: "hsl(var(--primary))", // Use CSS variable for theme support
        strokeWidth: 2,
      };
  }
};

// Helper for generating IDs
let nodeId = 1;
const getNodeId = () => `node-${nodeId++}`;

// Utility functions to convert between core data and React Flow format
const convertCoreNodeToReactFlow = (coreNode: AgentNodeType): Node<ToolNodeData> => {
  return {
    id: coreNode.id,
    type: coreNode.type,
    position: coreNode.position,
    data: {
      label: coreNode.label,
      config: coreNode.config,
    },
  };
};

const convertReactFlowNodeToCore = (reactFlowNode: Node<ToolNodeData>): AgentNodeType => {
  return {
    id: reactFlowNode.id,
    type: reactFlowNode.type as ToolNodeType,
    label: reactFlowNode.data.label,
    config: reactFlowNode.data.config,
    position: reactFlowNode.position,
  };
};

const convertCoreEdgeToReactFlow = (coreEdge: AgentEdgeType): Edge => {
  return {
    id: coreEdge.id,
    source: coreEdge.source,
    target: coreEdge.target,
    sourceHandle: coreEdge.sourceHandle,
    targetHandle: coreEdge.targetHandle,
    style: getEdgeStyle(coreEdge.edgeType as EdgeType),
    data: { edgeType: coreEdge.edgeType },
  };
};

const convertReactFlowEdgeToCore = (reactFlowEdge: Edge): AgentEdgeType => {
  return {
    id: reactFlowEdge.id,
    source: reactFlowEdge.source,
    target: reactFlowEdge.target,
    sourceHandle: reactFlowEdge.sourceHandle || "",
    targetHandle: reactFlowEdge.targetHandle || "",
    edgeType: (reactFlowEdge.data?.edgeType as EdgeType) || "string",
  };
};

// Node type configuration - now using the registry
const getNodeConfig = (type: string) => {
  return NodeConfigRegistry.getConfig(type);
};

interface NodePickerProps {
  position: XYPosition;
  onSelect: (type: string) => void;
  onCancel: () => void;
}

// Node picker component
const NodePicker: React.FC<NodePickerProps> = ({ position, onSelect, onCancel }) => {
  const comboboxItems = NODE_TYPE_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value,
  }));

  return (
    <div
      className="absolute z-50"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="bg-card border border-border rounded-md shadow-lg p-3 w-[250px]">
        <div className="text-sm font-medium mb-2">Select node type:</div>
        <Combobox
          items={comboboxItems}
          onChange={(value) => onSelect(value || "")}
          placeholder="Search node types..."
          trigger={
            <Button variant="outline" className="w-full justify-between">
              <span>Select node type</span>
            </Button>
          }
        />
        <Button variant="outline" size="sm" className="w-full mt-2 text-xs text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

const ToolEditorContent: React.FC<ToolEditorProps> = ({ toolConfig, onSave, onChange, readOnly = false }) => {
  const { theme } = useThemeStore();
  
  // Initialize nodes and edges from toolConfig or default
  const initialConfig = toolConfig!;
  const initialReactFlowNodes = initialConfig.nodes.map(convertCoreNodeToReactFlow);
  const initialReactFlowEdges = initialConfig.edges.map(convertCoreEdgeToReactFlow);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ToolNodeData>>(initialReactFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialReactFlowEdges);
  const [configModal, setConfigModal] = useState<{ open: boolean; node: Node<ToolNodeData> | null }>({ open: false, node: null });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodePicker, setNodePicker] = useState<{
    show: boolean;
    position: XYPosition;
    connectionState: any;
  } | null>(null);

  // Update nodes and edges when toolConfig changes
  useEffect(() => {
    if (toolConfig) {
      const newNodes = toolConfig.nodes.map(convertCoreNodeToReactFlow);
      const newEdges = toolConfig.edges.map(convertCoreEdgeToReactFlow);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [toolConfig, setNodes, setEdges]);

  // Custom edge change handler that updates styles based on selection
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    
    // Update styles for selection changes
    const selectionChanges = changes.filter(change => change.type === 'select');
    if (selectionChanges.length > 0) {
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({
          ...edge,
          style: getEdgeStyle(edge.data?.edgeType as EdgeType, edge.selected),
        }))
      );
    }
  }, [onEdgesChange, setEdges]);

  // Convert current state to core configuration
  const getCurrentConfiguration = useCallback((): AgentType => {
    return {
      ...toolConfig,
      favorite: toolConfig?.favorite || false,
      name: toolConfig?.name || "Untitled Workflow",
      version: toolConfig?.version || "1.0.0", 
      tags: toolConfig?.tags || [],
      settings: toolConfig?.settings || { run_on: { type: "manual" } },
      nodes: nodes.map(convertReactFlowNodeToCore),
      edges: edges.map(convertReactFlowEdgeToCore),
      description: toolConfig?.description,
      category: toolConfig?.category,
    };
  }, [nodes, edges, toolConfig]);

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      const currentConfig = getCurrentConfiguration();
      onChange(currentConfig);
    }
  }, [nodes, edges, onChange, getCurrentConfiguration]);

  // Save handler
  const handleSave = useCallback(() => {
    if (onSave) {
      const currentConfig = getCurrentConfiguration();
      onSave(currentConfig);
    }
  }, [onSave, getCurrentConfiguration]);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // Get the edge type from the source handle
      const sourceNodeId = params.source;
      const sourceHandleId = params.sourceHandle;

      // Find the source node in the DOM
      const sourceNode = document.querySelector(`[data-id="${sourceNodeId}"]`);
      const sourceHandle = sourceNode?.querySelector(`[data-handleid="${sourceHandleId}"]`);
      const edgeType = (sourceHandle?.getAttribute("data-edge-type") as EdgeType) || "default";
      const edgeStyle = getEdgeStyle(edgeType);

      const newEdge: Edge = {
        ...params,
        id: ('id' in params && params.id) || `edge-${params.source}-${params.target}`,
        style: edgeStyle,
        data: { edgeType },
        animated: edgeType === "stream", // Animate stream connections
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );

  // Edge-to-node creation - with node type selection
  const onConnectEnd = useCallback(
    (event: any, connectionState: any) => {
      // Only proceed if connection is not valid (dropped on empty space) and we have a source node
      if (!connectionState.isValid && connectionState.fromNode) {
        // Extract client coordinates
        const { clientX, clientY } = "changedTouches" in event ? event.changedTouches[0] : event;

        // Get the ReactFlow wrapper bounds
        const wrapperRect = reactFlowWrapper.current?.getBoundingClientRect();
        if (!wrapperRect) return;

        // Convert screen coordinates to container-relative coordinates
        let x = clientX - wrapperRect.left;
        let y = clientY - wrapperRect.top;

        // Account for the toolbar height (approximately 60px based on the UI)
        const toolbarHeight = 60;
        y = Math.max(y - toolbarHeight, 10);

        // Ensure the picker stays within bounds (picker is 250px wide)
        const pickerWidth = 250;
        const pickerHeight = 120; // Approximate height
        const containerWidth = wrapperRect.width;
        const containerHeight = wrapperRect.height - toolbarHeight;

        // Adjust x position to keep picker in bounds
        if (x + pickerWidth > containerWidth) {
          x = containerWidth - pickerWidth - 10;
        }
        x = Math.max(x, 10);

        // Adjust y position to keep picker in bounds
        if (y + pickerHeight > containerHeight) {
          y = containerHeight - pickerHeight - 10;
        }
        y = Math.max(y, 10);

        const position = { x, y };

        // Show node picker
        setNodePicker({
          show: true,
          position,
          connectionState,
        });
      }
    },
    [reactFlowWrapper],
  );

  // Create node of selected type
  const handleNodeTypeSelect = useCallback((type: string) => {
    if (!nodePicker) {
      return;
    }

    const { position, connectionState } = nodePicker;

    // Create node ID
    const id = `${type}-${getNodeId()}`;

    // Get node configuration based on type
    const nodeData = getNodeConfig(type);

    // Convert picker position (container coordinates) back to flow coordinates
    // Get the ReactFlow wrapper bounds
    const wrapperRect = reactFlowWrapper.current?.getBoundingClientRect();
    if (!wrapperRect) return;

    // Calculate the center of where the picker was shown as the node position
    const toolbarHeight = 60;
    const pickerCenterX = position.x + 125; // Half of picker width (250px)
    const pickerCenterY = position.y + 60;  // Approximate center of picker height

    // Convert to screen coordinates
    const screenX = pickerCenterX + wrapperRect.left;
    const screenY = pickerCenterY + wrapperRect.top + toolbarHeight;

    // Convert screen coordinates to flow coordinates
    const flowPosition = screenToFlowPosition({
      x: screenX,
      y: screenY,
    });

    // Create the new node
    const newNode = {
      id,
      type,
      position: flowPosition,
      data: nodeData,
    };

    // Add the node to the flow
    setNodes((nds) => nds.concat(newNode));

    // Get the edge type from the source handle
    const sourceHandleId = connectionState.fromHandle?.id;
    const sourceNode = document.querySelector(`[data-id="${connectionState.fromNode.id}"]`);
    const sourceHandle = sourceNode?.querySelector(`[data-handleid="${sourceHandleId}"]`);
    const edgeType = (sourceHandle?.getAttribute("data-edge-type") as EdgeType) || "default";
    const edgeStyle = getEdgeStyle(edgeType);

    // Add the connection from source to new node
    const newEdge: Edge = {
      id: `edge-${connectionState.fromNode.id}-${id}`,
      source: connectionState.fromNode.id,
      sourceHandle: connectionState.fromHandle?.id,
      target: id,
      style: edgeStyle,
      data: { edgeType },
      animated: edgeType === "stream", // Animate stream connections
    };

    setEdges((eds) => eds.concat(newEdge));

    // Hide the picker
    setNodePicker(null);
  }, [nodePicker, reactFlowWrapper, screenToFlowPosition, setNodes, setEdges]);

  // Close the picker without creating a node
  const handleCancelNodePicker = useCallback(() => {
    setNodePicker(null);
  }, []);

  // Delete selected nodes and edges with keyboard
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (readOnly) return;
      
      if (event.key === 'Delete') {
        // Check if the user is currently interacting with an input, textarea, or modal
        const target = event.target as HTMLElement;
        
        // Don't delete if user is typing in an input field, textarea, or contenteditable element
        if (target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' || 
            target.contentEditable === 'true' ||
            target.isContentEditable) {
          return;
        }
        
        // Don't delete if the target is within a modal/dialog
        const isInModal = target.closest('[role="dialog"]') || 
                         target.closest('[data-radix-dialog-content]') ||
                         target.closest('.modal') ||
                         target.closest('[aria-modal="true"]');
        
        if (isInModal) {
          return;
        }
        
        // Don't delete if the target is within a dropdown, popover, or similar overlay
        const isInOverlay = target.closest('[role="menu"]') ||
                           target.closest('[role="listbox"]') ||
                           target.closest('[role="combobox"]') ||
                           target.closest('[data-radix-popper-content-wrapper]') ||
                           target.closest('[data-radix-popover-content]');
        
        if (isInOverlay) {
          return;
        }
        
        // Get selected nodes and edges
        const selectedNodes = nodes.filter(node => node.selected);
        const selectedEdges = edges.filter(edge => edge.selected);
        
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          // Delete selected nodes and their connected edges
          if (selectedNodes.length > 0) {
            const nodeIdsToDelete = selectedNodes.map(node => node.id);
            setNodes((nds) => nds.filter((n) => !nodeIdsToDelete.includes(n.id)));
            setEdges((eds) => eds.filter((e) => 
              !nodeIdsToDelete.includes(e.source) && !nodeIdsToDelete.includes(e.target)
            ));
          }
          
          // Delete selected edges
          if (selectedEdges.length > 0) {
            const edgeIdsToDelete = selectedEdges.map(edge => edge.id);
            setEdges((eds) => eds.filter((e) => !edgeIdsToDelete.includes(e.id)));
          }
        }
      }
    },
    [nodes, edges, setNodes, setEdges, readOnly]
  );

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Delete node handler for trash button
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (readOnly || nodeId === "start" || nodeId === "end") return;
      
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges, readOnly]
  );

  // Save config handler for all nodes
  const handleSaveConfig = (newConfig: any) => {
    if (configModal.node) {
      setNodes((nds) => nds.map((n) => (n.id === configModal.node!.id ? { ...n, data: { ...n.data, config: newConfig } } : n)));
    }
    setConfigModal({ open: false, node: null });
  };

  return (
    <div className="w-full h-full min-h-[400px] bg-background border-2 border-dashed border-primary/40 rounded-lg flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">
            {toolConfig?.name || "Tool Editor"}
          </h3>
          {readOnly && (
            <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">
              Read Only
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onSave && !readOnly && (
            <Button 
              onClick={handleSave} 
              size="sm" 
              variant="default"
              className="text-xs"
            >
              Save Tool
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 relative" style={{ minHeight: 350 }} ref={reactFlowWrapper}>
        <NodeDeleteProvider onDelete={handleDeleteNode}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={readOnly ? () => {} : onNodesChange}
            onEdgesChange={readOnly ? () => {} : handleEdgesChange}
            onConnect={readOnly ? () => {} : onConnect}
            nodeTypes={nodeTypes}
            proOptions={{ hideAttribution: true }}
            fitView
            fitViewOptions={{
              maxZoom: 1,
            }}
            colorMode={theme === "dark" ? "dark" : "light"}
            minZoom={0.5}
            maxZoom={1.5}
            onConnectEnd={readOnly ? () => {} : onConnectEnd}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            nodesFocusable={!readOnly}
            edgesFocusable={!readOnly}
            elementsSelectable={!readOnly}
            defaultEdgeOptions={{
              style: { strokeWidth: 2 },
            }}
            connectionLineStyle={{
              strokeWidth: 2,
              stroke: 'hsl(var(--primary))',
              strokeDasharray: '5,5',
            }}
            snapToGrid={true}
            snapGrid={[10, 10]}
            connectionRadius={20}
          >
            <MiniMap className="border border-foreground" />
            <Controls />
            <Background variant={BackgroundVariant.Cross} gap={40} size={1} />
          </ReactFlow>
        </NodeDeleteProvider>

        {!readOnly && nodePicker?.show && (
          <NodePicker 
            position={nodePicker.position} 
            onSelect={handleNodeTypeSelect} 
            onCancel={handleCancelNodePicker} 
          />
        )}
      </div>
    </div>
  );
};

// Wrap component with ReactFlowProvider
const ToolEditor: React.FC<ToolEditorProps> = ({ toolConfig, onSave, onChange, readOnly }) => {
  return (
    <ReactFlowProvider>
      <ToolEditorContent toolConfig={toolConfig} onSave={onSave} onChange={onChange} readOnly={readOnly} />
    </ReactFlowProvider>
  );
};

export default ToolEditor;

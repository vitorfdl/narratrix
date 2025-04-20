import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useThemeStore } from "@/hooks/ThemeContext";
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  XYPosition,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, { useCallback, useRef, useState } from "react";
import { EdgeType } from "./tool-nodes/NodeBase";
import { NodeStart, StartNodeConfigDialog, StartNodeConfigField } from "./tool-nodes/NodeStart";
import { EndNode } from "./tool-nodes/nodeEnd";
import { JavascriptNode, JavascriptNodeConfigDialog } from "./tool-nodes/nodeJavascript";
import { LLMNode } from "./tool-nodes/nodeLLM";

// Node type keys
export type ToolNodeType = "start" | "end" | "llm" | "chatMessage" | "memoryUpdate" | "concatenate" | "javascript";

// Node data typing
export interface ToolNodeData {
  label: string;
  config?: Record<string, any>;
  [key: string]: unknown;
}

// Get edge style based on edge type
const getEdgeStyle = (edgeType?: EdgeType) => {
  const baseStyle = {
    strokeWidth: 2,
  };

  switch (edgeType) {
    case "success":
      return { ...baseStyle, stroke: "#22c55e" }; // green-500
    case "error":
      return { ...baseStyle, stroke: "#ef4444" }; // red-500
    case "string":
      return { ...baseStyle, stroke: "#3b82f6" }; // blue-500
    case "json":
      return { ...baseStyle, stroke: "#eab308" }; // yellow-500
    case "stream":
      return { ...baseStyle, stroke: "#a855f7" }; // purple-500
    default:
      return baseStyle;
  }
};

// Initial nodes: Start node and End node only
const initialNodes: Node<ToolNodeData>[] = [
  {
    id: "start",
    type: "start",
    position: { x: 100, y: 200 },
    data: {
      label: "Start Node",
      config: {
        fields: [
          { key: "chatHistory", type: "array" },
          { key: "lastMessage", type: "string" },
          { key: "chapter", type: "number" },
          { key: "lastCharacter", type: "string" },
          { key: "userCharacter", type: "string" },
        ] as StartNodeConfigField[],
      },
    },
    deletable: false,
  },
  {
    id: "end",
    type: "end",
    position: { x: 600, y: 200 },
    data: {
      label: "End Node",
      value: "",
    },
    deletable: false,
  },
];

const initialEdges: Edge[] = [];

// Node type mapping for React Flow
const nodeTypes: NodeTypes = {
  start: NodeStart,
  end: EndNode,
  llm: LLMNode,
  javascript: JavascriptNode,
  // TODO: Add chatMessage, memoryUpdate, concatenate
};

// Node options for selection
const NODE_TYPE_OPTIONS = [
  { value: "llm", label: "LLM Node" },
  { value: "javascript", label: "Javascript Node" },
  // Add more as needed
];

// Helper for generating IDs
let nodeId = 1;
const getNodeId = () => `node-${nodeId++}`;

// Node type configuration
const getNodeConfig = (type: string) => {
  switch (type) {
    case "llm":
      return {
        label: "LLM Node",
        config: {
          systemPrompt: "",
          userPrompt: "",
          assistantPrefill: "",
          chatTemplate: "",
        },
      };
    case "javascript":
      return {
        label: "Javascript Node",
        config: {
          name: "Javascript Node",
          code: "// Write your JavaScript code here\nreturn input;",
        },
      };
    default:
      return {
        label: `${type.charAt(0).toUpperCase()}${type.slice(1)} Node`,
        config: {},
      };
  }
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
          onChange={onSelect}
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

const ToolEditorContent: React.FC = () => {
  const { theme } = useThemeStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ToolNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [configModal, setConfigModal] = useState<{ open: boolean; node: Node<ToolNodeData> | null }>({ open: false, node: null });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodePicker, setNodePicker] = useState<{
    show: boolean;
    position: XYPosition;
    connectionState: any;
  } | null>(null);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // Get the edge type from the source handle
      const sourceNodeId = params.source;
      const sourceHandleId = params.sourceHandle;

      // Find the source node in the DOM
      const sourceNode = document.querySelector(`[data-id="${sourceNodeId}"]`);
      const sourceHandle = sourceNode?.querySelector(`[data-handleid="${sourceHandleId}"]`);
      const edgeType = (sourceHandle?.getAttribute("data-edge-type") as EdgeType) || "default";

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { edgeType },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  // Double click handler for node config
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node<ToolNodeData>) => {
    setConfigModal({ open: true, node });
  }, []);

  // Save config handler for all nodes
  const handleSaveConfig = (newConfig: any) => {
    if (configModal.node) {
      setNodes((nds) => nds.map((n) => (n.id === configModal.node!.id ? { ...n, data: { ...n.data, config: newConfig } } : n)));
    }
    setConfigModal({ open: false, node: null });
  };

  // Edge-to-node creation - with node type selection
  const onConnectEnd = useCallback(
    (event: any, connectionState: any) => {
      // Only proceed if connection is not valid (dropped on empty space) and we have a source node
      if (!connectionState.isValid && connectionState.fromNode) {
        // Extract client coordinates
        const { clientX, clientY } = "changedTouches" in event ? event.changedTouches[0] : event;

        // Convert screen coordinates to flow coordinates
        const position = screenToFlowPosition({
          x: clientX,
          y: clientY,
        });

        // Show node picker
        setNodePicker({
          show: true,
          position,
          connectionState,
        });
      }
    },
    [screenToFlowPosition],
  );

  // Create node of selected type
  const handleNodeTypeSelect = (type: string) => {
    if (!nodePicker) {
      return;
    }

    const { position, connectionState } = nodePicker;

    // Create node ID
    const id = `${type}-${getNodeId()}`;

    // Get node configuration based on type
    const nodeData = getNodeConfig(type);

    // Create the new node
    const newNode = {
      id,
      type,
      position,
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
    setEdges((eds) =>
      eds.concat({
        id: `edge-${connectionState.fromNode.id}-${id}`,
        source: connectionState.fromNode.id,
        sourceHandle: connectionState.fromHandle?.id,
        target: id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: edgeStyle,
        data: { edgeType },
      }),
    );

    // Hide the picker
    setNodePicker(null);
  };

  // Close the picker without creating a node
  const handleCancelNodePicker = () => {
    setNodePicker(null);
  };

  // Right-click handler for node deletion (except start/end)
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<ToolNodeData>) => {
      event.preventDefault();
      if (node.id === "start" || node.id === "end") {
        return;
      }
      // Confirm deletion (optional: use a modal or toast for better UX)
      if (window.confirm(`Delete node '${node.data.label || node.type}'?`)) {
        setNodes((nds) => nds.filter((n) => n.id !== node.id));
        setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
      }
    },
    [setNodes, setEdges],
  );

  // Right-click handler for edge deletion
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      if (window.confirm("Delete this connection?")) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
    },
    [setEdges],
  );

  return (
    <div className="w-full h-full min-h-[400px] bg-background border-2 border-dashed border-primary/40 rounded-lg flex flex-col">
      <div className="flex-1 relative" style={{ minHeight: 350 }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitView
          colorMode={theme === "dark" ? "dark" : "light"}
          minZoom={0.2}
          maxZoom={2}
          onNodeDoubleClick={onNodeDoubleClick}
          onConnectEnd={onConnectEnd}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
        >
          <MiniMap className="border border-foreground" />
          <Controls />
          <Background variant={BackgroundVariant.Cross} gap={40} size={1} />
        </ReactFlow>

        {/* Node picker */}
        {nodePicker?.show && <NodePicker position={nodePicker.position} onSelect={handleNodeTypeSelect} onCancel={handleCancelNodePicker} />}

        {/* Config modals for different node types */}
        {configModal.open && configModal.node && configModal.node.type === "start" && (
          <StartNodeConfigDialog
            open={configModal.open}
            initialFields={configModal.node.data.config?.fields || []}
            onSave={(fields) => handleSaveConfig({ ...configModal.node!.data.config, fields })}
            onCancel={() => setConfigModal({ open: false, node: null })}
          />
        )}
        {configModal.open && configModal.node && configModal.node.type === "javascript" && (
          <JavascriptNodeConfigDialog
            open={configModal.open}
            initialConfig={{
              name: configModal.node.data.config?.name || "",
              code: configModal.node.data.config?.code || "",
            }}
            onSave={(updatedConfig) => handleSaveConfig(updatedConfig)}
            onCancel={() => setConfigModal({ open: false, node: null })}
          />
        )}
        {/* Fallback for other node types */}
        {configModal.open && configModal.node && configModal.node.type !== "start" && configModal.node.type !== "javascript" && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 min-w-[320px] shadow-xl">
              <div className="font-semibold mb-2">Configure Node: {configModal.node.data.label}</div>
              <div className="mb-4 text-xs text-muted-foreground">(Config UI goes here)</div>
              <button
                className="px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                onClick={() => handleSaveConfig(configModal.node?.data.config)}
              >
                Save
              </button>
              <button
                className="ml-2 px-3 py-1 rounded bg-muted text-foreground hover:bg-muted/80 text-sm"
                onClick={() => setConfigModal({ open: false, node: null })}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Wrap component with ReactFlowProvider
const ToolEditor: React.FC = () => {
  return (
    <ReactFlowProvider>
      <ToolEditorContent />
    </ReactFlowProvider>
  );
};

export default ToolEditor;

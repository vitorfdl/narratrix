import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  type EdgeTypes,
  MiniMap,
  Node,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { useThemeStore } from "@/hooks/ThemeContext";
import { deepEqual } from "@/lib/utils";
import { AgentType } from "@/schema/agent-schema";
import "@xyflow/react/dist/style.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeletableEdge } from "./tool-components/DeletableEdge";
import { AgentSidebar } from "./tool-components/EditorSidebar";
import { convertCoreEdgeToReactFlow, convertReactFlowEdgeToCore, getEdgeStyle, getEdgeTypeFromHandle, isValidEdgeConnection, updateEdgeStyles, validateAndFixEdge } from "./tool-components/edge-utils";
import { ConnectionStateProvider, NodeDeleteProvider } from "./tool-components/NodeBase";
import { NodeRegistry } from "./tool-components/node-registry";
import { convertCoreNodeToReactFlow, convertReactFlowNodeToCore } from "./tool-components/node-utils";
import { ToolEditorProps, ToolNodeData } from "./tool-components/types";

// Import all node types to ensure they register themselves
import "./tool-nodes";

const ToolEditorContent: React.FC<ToolEditorProps> = ({ toolConfig, onChange, readOnly = false }) => {
  const { theme } = useThemeStore();

  // Get node types from registry
  const nodeTypes = NodeRegistry.getNodeTypes();

  const edgeTypes = useMemo<EdgeTypes>(() => ({ default: DeletableEdge }), []);

  // Connection state for visual feedback during edge dragging
  const [connectionState, setConnectionState] = useState<any>({
    isConnecting: false,
    sourceNodeId: undefined,
    sourceHandleId: undefined,
    sourceEdgeType: undefined,
  });

  // Initialize nodes and edges from toolConfig with proper validation
  const initialNodes = useMemo(() => {
    if (!toolConfig?.nodes) {
      return [];
    }
    return toolConfig.nodes.map(convertCoreNodeToReactFlow);
  }, [toolConfig?.nodes]);

  const initialEdges = useMemo(() => {
    if (!toolConfig?.edges || !toolConfig?.nodes) {
      return [];
    }

    // Validate and fix edges before loading
    const validatedEdges = toolConfig.edges.map((edge) => validateAndFixEdge(edge, toolConfig.nodes || [])).filter((edge): edge is NonNullable<typeof edge> => edge !== null);

    // Log any corrections made
    if (validatedEdges.length !== toolConfig.edges.length) {
      console.warn(`Corrected ${toolConfig.edges.length - validatedEdges.length} invalid edges`);
    }

    return validatedEdges.map(convertCoreEdgeToReactFlow);
  }, [toolConfig?.edges, toolConfig?.nodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ToolNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // Keep track of the last configuration sent to parent to avoid unnecessary updates
  const lastSentConfigRef = useRef<AgentType | null>(null);

  // Update nodes and edges when toolConfig changes (but avoid double initialization)
  useEffect(() => {
    if (toolConfig && (toolConfig.id || toolConfig.version)) {
      const newNodes = toolConfig.nodes?.map(convertCoreNodeToReactFlow) || [];

      // Validate and fix edges before loading
      const validatedEdges = toolConfig.edges?.map((edge) => validateAndFixEdge(edge, toolConfig.nodes || [])).filter((edge): edge is NonNullable<typeof edge> => edge !== null) || [];
      const newEdges = validatedEdges.map(convertCoreEdgeToReactFlow);

      // Only update if the nodes/edges have actually changed
      const nodesChanged =
        JSON.stringify(nodes.map((n) => ({ id: n.id, position: n.position, type: n.type }))) !== JSON.stringify(newNodes.map((n) => ({ id: n.id, position: n.position, type: n.type })));
      const edgesChanged =
        JSON.stringify(edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))) !== JSON.stringify(newEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })));

      if (nodesChanged) {
        setNodes(newNodes);
      }
      if (edgesChanged) {
        setEdges(newEdges);
      }
    }
  }, [toolConfig?.id, toolConfig?.version, nodes.map, setEdges, setNodes, toolConfig, edges.map]); // Only trigger on config ID or version change

  // Handle edge changes with validation and style updates
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      try {
        // Apply changes first
        onEdgesChange(changes);

        // Then update styles in the next tick to avoid conflicts
        setTimeout(() => {
          setEdges((currentEdges) => updateEdgeStyles(currentEdges));
        }, 0);
      } catch (error) {
        console.error("Error handling edge changes:", error);
        // Reset edges to a valid state if there's an error
        const validEdges = edges.filter((edge) => {
          const validation = isValidEdgeConnection(edge.source, edge.sourceHandle || "", edge.target, edge.targetHandle || "", nodes, edges);
          if (!validation.valid) {
            console.warn(`Removing invalid edge ${edge.id}: ${validation.error}`);
            return false;
          }
          return true;
        });
        setEdges(updateEdgeStyles(validEdges));
      }
    },
    [onEdgesChange, edges, nodes, setEdges],
  );

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

  // Notify parent of changes only when there are actual changes
  useEffect(() => {
    if (onChange) {
      const currentConfig = getCurrentConfiguration();

      // Only call onChange if the configuration has actually changed
      if (!lastSentConfigRef.current || !deepEqual(currentConfig, lastSentConfigRef.current)) {
        lastSentConfigRef.current = currentConfig;
        onChange(currentConfig);
      }
    }
  }, [onChange, getCurrentConfiguration]);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // Validate the connection before creating the edge
      const validation = isValidEdgeConnection(params.source!, params.sourceHandle || "", params.target!, params.targetHandle || "", nodes, edges);

      if (!validation.valid && !validation.existingEdge) {
        console.error(`Cannot create edge: ${validation.error}`);
        return;
      }

      // Get the edge type from the source handle
      const sourceNodeId = params.source;
      const sourceHandleId = params.sourceHandle;
      const edgeType = getEdgeTypeFromHandle(sourceNodeId!, sourceHandleId!);
      const edgeStyle = getEdgeStyle(edgeType);

      const newEdge: Edge = {
        ...params,
        id: ("id" in params && params.id) || `edge-${params.source}-${params.sourceHandle || "default"}-${params.target}-${params.targetHandle || "default"}`,
        style: edgeStyle,
        data: { edgeType },
        animated: false,
        reconnectable: true,
      };

      setEdges((eds) => {
        let updatedEdges = eds;

        // If there's an existing edge to the same input, remove it first
        if (validation.existingEdge) {
          console.log(`Replacing existing edge ${validation.existingEdge.id} with new connection`);
          updatedEdges = eds.filter((edge) => edge.id !== validation.existingEdge!.id);
        }

        // Add the new edge and update styles
        return updateEdgeStyles(addEdge(newEdge, updatedEdges));
      });
    },
    [setEdges, nodes, edges],
  );

  // Handle edge reconnection with validation
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      // Validate the new connection before allowing reconnection
      const validation = isValidEdgeConnection(
        newConnection.source!,
        newConnection.sourceHandle || "",
        newConnection.target!,
        newConnection.targetHandle || "",
        nodes,
        edges.filter((edge) => edge.id !== oldEdge.id), // Exclude the old edge from validation
      );

      if (!validation.valid && !validation.existingEdge) {
        console.error(`Cannot reconnect edge: ${validation.error}`);
        return;
      }

      // Get the edge type from the source handle
      const edgeType = getEdgeTypeFromHandle(newConnection.source!, newConnection.sourceHandle!);

      setEdges((eds) => {
        let updatedEdges = eds;

        // If there's an existing edge to the same input, remove it first
        if (validation.existingEdge) {
          console.log(`Replacing existing edge ${validation.existingEdge.id} with reconnection`);
          updatedEdges = eds.filter((edge) => edge.id !== validation.existingEdge!.id);
        }

        // Use React Flow's reconnectEdge utility and update the edge data
        const reconnectedEdges = reconnectEdge(oldEdge, newConnection, updatedEdges);

        // Update the reconnected edge with proper edge type and style
        return updateEdgeStyles(
          reconnectedEdges.map((edge) => {
            if (edge.source === newConnection.source && edge.target === newConnection.target && edge.sourceHandle === newConnection.sourceHandle && edge.targetHandle === newConnection.targetHandle) {
              return {
                ...edge,
                data: { edgeType },
                style: getEdgeStyle(edgeType),
              };
            }
            return edge;
          }),
        );
      });
    },
    [setEdges, nodes, edges],
  );

  // Handle connection start for visual feedback
  const onConnectStart = useCallback((_event: any, { nodeId, handleId, handleType }: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
    if (nodeId && handleId && handleType) {
      // Get the actual edge type from the handle instead of hardcoding
      const sourceEdgeType = handleType === "source" ? getEdgeTypeFromHandle(nodeId, handleId) : undefined;
      setConnectionState({
        isConnecting: true,
        sourceNodeId: nodeId,
        sourceHandleId: handleId,
        sourceEdgeType,
      });
    }
  }, []);

  // Handle connection end to reset visual feedback
  const onConnectEnd = useCallback((_event: any, _connectionState: any) => {
    setConnectionState({
      isConnecting: false,
      sourceNodeId: undefined,
      sourceHandleId: undefined,
      sourceEdgeType: undefined,
    });
  }, []);

  // Delete selected nodes and edges with keyboard
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (readOnly) {
        return;
      }

      if (event.key === "Delete") {
        // Check if the user is currently interacting with an input, textarea, or modal
        const target = event.target as HTMLElement;

        // Don't delete if user is typing in an input field, textarea, or contenteditable element
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true" || target.isContentEditable) {
          return;
        }

        // Don't delete if the target is within a modal/dialog
        const isInModal = target.closest('[role="dialog"]') || target.closest("[data-radix-dialog-content]") || target.closest(".modal") || target.closest('[aria-modal="true"]');

        if (isInModal) {
          return;
        }

        // Don't delete if the target is within a dropdown, popover, or similar overlay
        const isInOverlay =
          target.closest('[role="menu"]') ||
          target.closest('[role="listbox"]') ||
          target.closest('[role="combobox"]') ||
          target.closest("[data-radix-popper-content-wrapper]") ||
          target.closest("[data-radix-popover-content]");

        if (isInOverlay) {
          return;
        }

        // Get selected nodes and edges
        const selectedNodes = nodes.filter((node) => node.selected);
        const selectedEdges = edges.filter((edge) => edge.selected);

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          // Delete selected nodes and their connected edges
          if (selectedNodes.length > 0) {
            const nodeIdsToDelete = selectedNodes.map((node) => node.id);
            setNodes((nds) => nds.filter((n) => !nodeIdsToDelete.includes(n.id)));
            setEdges((eds) => eds.filter((e) => !nodeIdsToDelete.includes(e.source) && !nodeIdsToDelete.includes(e.target)));
          }

          // Delete selected edges
          if (selectedEdges.length > 0) {
            const edgeIdsToDelete = selectedEdges.map((edge) => edge.id);
            setEdges((eds) => eds.filter((e) => !edgeIdsToDelete.includes(e.id)));
          }
        }
      }
    },
    [nodes, edges, setNodes, setEdges, readOnly],
  );

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Delete node handler for trash button
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (readOnly || nodeId === "start" || nodeId === "end") {
        return;
      }

      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges, readOnly],
  );

  // Validate that exactly one trigger node exists
  const triggerNodeCount = useMemo(() => nodes.filter((n) => n.type === "trigger").length, [nodes]);
  const hasTriggerNode = triggerNodeCount > 0;
  const hasDuplicateTriggerNode = triggerNodeCount > 1;

  // Global connection validation for ReactFlow
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const validation = isValidEdgeConnection(connection.source!, connection.sourceHandle || "", connection.target!, connection.targetHandle || "", nodes, edges);

      if (!validation.valid && !validation.existingEdge) {
        console.error(`❌ Global validation BLOCKED connection: ${validation.error}`);
        return false;
      }

      console.log("✅ Global validation ALLOWED connection");
      return true;
    },
    [nodes, edges],
  );

  return (
    <div className="w-full h-full min-h-[400px] dark:bg-background border-2 border-dashed border-primary/40 rounded-lg flex">
      {/* Sidebar */}
      {!readOnly && <AgentSidebar className="flex-shrink-0" />}

      {/* Main Editor */}
      <div className="flex-1 relative" style={{ minHeight: 350 }} ref={reactFlowWrapper}>
        <NodeDeleteProvider onDelete={handleDeleteNode}>
          <ConnectionStateProvider connectionState={connectionState}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={readOnly ? () => {} : onNodesChange}
              onEdgesChange={readOnly ? () => {} : handleEdgesChange}
              onConnect={readOnly ? () => {} : onConnect}
              onReconnect={readOnly ? () => {} : onReconnect}
              onConnectStart={readOnly ? () => {} : onConnectStart}
              onConnectEnd={readOnly ? () => {} : onConnectEnd}
              isValidConnection={readOnly ? () => false : isValidConnection}
              nodeTypes={nodeTypes as NodeTypes}
              edgeTypes={edgeTypes}
              proOptions={{ hideAttribution: true }}
              fitView
              fitViewOptions={{
                maxZoom: 1,
              }}
              colorMode={theme === "dark" ? "dark" : "light"}
              minZoom={0.5}
              maxZoom={1.5}
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
                stroke: "hsl(var(--primary))",
                strokeDasharray: "5,5",
              }}
              snapToGrid={true}
              snapGrid={[10, 10]}
              connectionRadius={20}
            >
              <MiniMap className="border border-foreground" />
              <Controls />
              <Background variant={BackgroundVariant.Dots} />
            </ReactFlow>
          </ConnectionStateProvider>
        </NodeDeleteProvider>
        {/* Trigger node validation banner */}
        {!readOnly && (!hasTriggerNode || hasDuplicateTriggerNode) && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-yellow-500/15 border border-yellow-500/40 text-yellow-600 dark:text-yellow-400 text-xs font-medium shadow-sm backdrop-blur-sm">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {hasDuplicateTriggerNode ? "Multiple Trigger nodes detected — only one is allowed." : "Add a Trigger node to define when this workflow runs."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Wrap component with ReactFlowProvider
const ToolEditor: React.FC<ToolEditorProps> = ({ toolConfig, onChange, readOnly }) => {
  return (
    <ReactFlowProvider>
      <ToolEditorContent toolConfig={toolConfig} onChange={onChange} readOnly={readOnly} />
    </ReactFlowProvider>
  );
};

export default ToolEditor;

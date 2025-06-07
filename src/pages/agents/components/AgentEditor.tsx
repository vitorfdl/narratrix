import { useThemeStore } from "@/hooks/ThemeContext";
import { deepEqual } from "@/lib/utils";
import { AgentType } from "@/schema/agent-schema";
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
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentSidebar } from "./tool-components/EditorSidebar";
import { ConnectionStateProvider, NodeDeleteProvider } from "./tool-components/NodeBase";
import { NodePicker } from "./tool-components/NodePicker";
import {
  convertCoreEdgeToReactFlow,
  convertReactFlowEdgeToCore,
  getEdgeStyle,
  getEdgeTypeFromHandle,
  isValidEdgeConnection,
  updateEdgeStyles,
  validateAndFixEdge,
} from "./tool-components/edge-utils";
import { NodeRegistry } from "./tool-components/node-registry";
import { convertCoreNodeToReactFlow, convertReactFlowNodeToCore, getNodeConfig, getNodeId } from "./tool-components/node-utils";
import { ToolEditorProps, ToolNodeData } from "./tool-components/types";

// Import all node types to ensure they register themselves
import "./tool-nodes";

const ToolEditorContent: React.FC<ToolEditorProps> = ({ toolConfig, onChange, readOnly = false }) => {
  const { theme } = useThemeStore();

  // Get node types from registry
  const nodeTypes = NodeRegistry.getNodeTypes();

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
    const validatedEdges = toolConfig.edges
      .map((edge) => validateAndFixEdge(edge, toolConfig.nodes || []))
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

    // Log any corrections made
    if (validatedEdges.length !== toolConfig.edges.length) {
      console.warn(`Corrected ${toolConfig.edges.length - validatedEdges.length} invalid edges`);
    }

    return validatedEdges.map(convertCoreEdgeToReactFlow);
  }, [toolConfig?.edges, toolConfig?.nodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ToolNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodePicker, setNodePicker] = useState<{
    show: boolean;
    position: XYPosition;
    connectionState: any;
  } | null>(null);

  // Keep track of the last configuration sent to parent to avoid unnecessary updates
  const lastSentConfigRef = useRef<AgentType | null>(null);

  // Update nodes and edges when toolConfig changes (but avoid double initialization)
  useEffect(() => {
    if (toolConfig && (toolConfig.id || toolConfig.version)) {
      const newNodes = toolConfig.nodes?.map(convertCoreNodeToReactFlow) || [];

      // Validate and fix edges before loading
      const validatedEdges =
        toolConfig.edges
          ?.map((edge) => validateAndFixEdge(edge, toolConfig.nodes || []))
          .filter((edge): edge is NonNullable<typeof edge> => edge !== null) || [];
      const newEdges = validatedEdges.map(convertCoreEdgeToReactFlow);

      // Only update if the nodes/edges have actually changed
      const nodesChanged =
        JSON.stringify(nodes.map((n) => ({ id: n.id, position: n.position, type: n.type }))) !==
        JSON.stringify(newNodes.map((n) => ({ id: n.id, position: n.position, type: n.type })));
      const edgesChanged =
        JSON.stringify(edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))) !==
        JSON.stringify(newEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })));

      if (nodesChanged) {
        setNodes(newNodes);
      }
      if (edgesChanged) {
        setEdges(newEdges);
      }
    }
  }, [toolConfig?.id, toolConfig?.version]); // Only trigger on config ID or version change

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
  }, [nodes, edges, onChange, getCurrentConfiguration]);

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
        id:
          ("id" in params && params.id) ||
          `edge-${params.source}-${params.sourceHandle || "default"}-${params.target}-${params.targetHandle || "default"}`,
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
            if (
              edge.source === newConnection.source &&
              edge.target === newConnection.target &&
              edge.sourceHandle === newConnection.sourceHandle &&
              edge.targetHandle === newConnection.targetHandle
            ) {
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
  const onConnectStart = useCallback(
    (event: any, { nodeId, handleId, handleType }: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
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
    },
    [],
  );

  // Handle connection end to reset visual feedback
  const onConnectEnd = useCallback(
    (event: any, connectionState: any) => {
      // Reset connection state
      setConnectionState({
        isConnecting: false,
        sourceNodeId: undefined,
        sourceHandleId: undefined,
        sourceEdgeType: undefined,
      });

      // Only proceed if connection is not valid (dropped on empty space) and we have a source node
      if (!connectionState.isValid && connectionState.fromNode) {
        // Extract client coordinates
        const { clientX, clientY } = "changedTouches" in event ? event.changedTouches[0] : event;

        // Get the ReactFlow wrapper bounds
        const wrapperRect = reactFlowWrapper.current?.getBoundingClientRect();
        if (!wrapperRect) {
          return;
        }

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
  const handleNodeTypeSelect = useCallback(
    (type: string) => {
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
      if (!wrapperRect) {
        return;
      }

      // Calculate the center of where the picker was shown as the node position
      const toolbarHeight = 60;
      const pickerCenterX = position.x + 125; // Half of picker width (250px)
      const pickerCenterY = position.y + 60; // Approximate center of picker height

      // Convert to screen coordinates
      const screenX = pickerCenterX + wrapperRect.left;
      const screenY = pickerCenterY + wrapperRect.top + toolbarHeight;

      // Convert screen coordinates to flow coordinates
      const flowPosition = screenToFlowPosition({
        x: screenX,
        y: screenY,
      });

      // Create the new node
      const newNode: Node<ToolNodeData> = {
        id,
        type,
        position: flowPosition,
        data: nodeData,
        // Add required properties for proper React Flow functionality
        draggable: true,
        selectable: true,
        deletable: true,
      };

      // Add the node to the flow
      setNodes((nds) => nds.concat(newNode));

      // Validate and create the connection
      const sourceHandleId = connectionState.fromHandle?.id;
      const sourceNodeId = connectionState.fromNode.id;

      // Validate the connection direction
      if (sourceHandleId?.startsWith("in-")) {
        console.log(connectionState);
        console.error(`Cannot create edge from input handle "${sourceHandleId}"`);
        setNodePicker(null);
        return;
      }

      // Get the edge type from the source handle
      const sourceNode = document.querySelector(`[data-id="${sourceNodeId}"]`);
      const sourceHandle = sourceNode?.querySelector(`[data-handleid="${sourceHandleId}"]`);
      const edgeType = getEdgeTypeFromHandle(sourceNodeId, sourceHandleId);
      const edgeStyle = getEdgeStyle(edgeType);

      // Determine the appropriate target handle based on edge type and target node type
      let targetHandle = "";
      if (edgeType === "toolset" && type === "javascript") {
        // For toolset connections to javascript nodes, there's no specific input handle
        targetHandle = "";
      } else if (edgeType === "toolset" && type === "agent") {
        targetHandle = "in-toolset";
      } else if (edgeType === "string" && type === "agent") {
        targetHandle = "in-input";
      } else if (edgeType === "string" && type === "chatOutput") {
        targetHandle = "response";
      }

      // Add the connection from source to new node
      const newEdge: Edge = {
        id: `edge-${sourceNodeId}-${sourceHandleId || "default"}-${id}-${targetHandle || "default"}`,
        source: sourceNodeId,
        sourceHandle: sourceHandleId,
        target: id,
        targetHandle,
        style: edgeStyle,
        data: { edgeType },
        animated: false,
        reconnectable: true,
      };

      setEdges((eds) => updateEdgeStyles(eds.concat(newEdge)));

      // Hide the picker
      setNodePicker(null);
    },
    [nodePicker, reactFlowWrapper, screenToFlowPosition, setNodes, setEdges],
  );

  // Close the picker without creating a node
  const handleCancelNodePicker = useCallback(() => {
    setNodePicker(null);
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
        const isInModal =
          target.closest('[role="dialog"]') ||
          target.closest("[data-radix-dialog-content]") ||
          target.closest(".modal") ||
          target.closest('[aria-modal="true"]');

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

  // Global connection validation for ReactFlow
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const validation = isValidEdgeConnection(
        connection.source!,
        connection.sourceHandle || "",
        connection.target!,
        connection.targetHandle || "",
        nodes,
        edges,
      );

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

        {!readOnly && nodePicker?.show && (
          <NodePicker position={nodePicker.position} onSelect={handleNodeTypeSelect} onCancel={handleCancelNodePicker} />
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

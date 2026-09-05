import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
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
  useReactFlow,
} from "@xyflow/react";
import { AlertTriangle, CheckCircle2, Lock, Map as MapIcon, Maximize2, Redo2, Sparkles, Undo2, Unlock, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/hooks/ThemeContext";
import { cn, deepEqual } from "@/lib/utils";
import { AgentType } from "@/schema/agent-schema";
import "@xyflow/react/dist/style.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UndoRedoProvider, useUndoRedo } from "../hooks/useUndoRedo";
import { DeletableEdge } from "./tool-components/DeletableEdge";
import { AgentSidebar } from "./tool-components/EditorSidebar";
import { convertCoreEdgeToReactFlow, convertReactFlowEdgeToCore, getEdgeStyle, getEdgeTypeFromHandle, isValidEdgeConnection, updateEdgeStyles, validateAndFixEdge } from "./tool-components/edge-utils";
import { ConnectionStateProvider, NodeDeleteProvider } from "./tool-components/NodeBase";
import { NodeRegistry } from "./tool-components/node-registry";
import { convertCoreNodeToReactFlow, convertReactFlowNodeToCore } from "./tool-components/node-utils";
import { ToolEditorProps, ToolNodeData } from "./tool-components/types";

import "./tool-nodes";

type WorkflowStatus = {
  variant: "ok" | "warn" | "error";
  message: string;
};

const STATUS_STYLES: Record<WorkflowStatus["variant"], string> = {
  ok: "bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400",
  warn: "bg-yellow-500/15 border-yellow-500/40 text-yellow-600 dark:text-yellow-400",
  error: "bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400",
};

const STATUS_ICON: Record<WorkflowStatus["variant"], React.ComponentType<{ className?: string }>> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: AlertTriangle,
};

interface CanvasControlsProps {
  interactive: boolean;
  onToggleInteractive: () => void;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
}

const CanvasControls: React.FC<CanvasControlsProps> = ({ interactive, onToggleInteractive, showMiniMap, onToggleMiniMap }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const buttonClass = "h-7 w-7 p-0 hover:bg-accent";

  return (
    <div className="absolute bottom-3 left-3 z-40 flex flex-col gap-0.5 rounded-md border border-border/60 bg-background/90 p-1 shadow-sm backdrop-blur-sm">
      <Button variant="ghost" size="sm" className={buttonClass} onClick={() => zoomIn({ duration: 200 })} title="Zoom in">
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className={buttonClass} onClick={() => zoomOut({ duration: 200 })} title="Zoom out">
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className={buttonClass} onClick={() => fitView({ duration: 250, maxZoom: 1 })} title="Fit view">
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
      <div className="my-0.5 h-px bg-border/60" />
      <Button variant="ghost" size="sm" className={buttonClass} onClick={onToggleInteractive} title={interactive ? "Lock canvas" : "Unlock canvas"}>
        {interactive ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-yellow-500" />}
      </Button>
      <Button variant="ghost" size="sm" className={cn(buttonClass, !showMiniMap && "text-muted-foreground")} onClick={onToggleMiniMap} title={showMiniMap ? "Hide minimap" : "Show minimap"}>
        <MapIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

const ToolEditorContent: React.FC<ToolEditorProps> = ({ toolConfig, onChange, readOnly = false }) => {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  const nodeTypes = NodeRegistry.getNodeTypes();

  const edgeTypes = useMemo<EdgeTypes>(() => ({ default: DeletableEdge }), []);

  const [connectionState, setConnectionState] = useState<any>({
    isConnecting: false,
    sourceNodeId: undefined,
    sourceHandleId: undefined,
    sourceEdgeType: undefined,
  });

  const [showMiniMap, setShowMiniMap] = useState(true);
  const [interactive, setInteractive] = useState(true);

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

    const validatedEdges = toolConfig.edges.map((edge) => validateAndFixEdge(edge, toolConfig.nodes || [])).filter((edge): edge is NonNullable<typeof edge> => edge !== null);

    if (validatedEdges.length !== toolConfig.edges.length) {
      console.warn(`Corrected ${toolConfig.edges.length - validatedEdges.length} invalid edges`);
    }

    return validatedEdges.map(convertCoreEdgeToReactFlow);
  }, [toolConfig?.edges, toolConfig?.nodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ToolNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastSentConfigRef = useRef<AgentType | null>(null);

  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo<Node<ToolNodeData>, Edge>(nodes, edges, setNodes, setEdges, { resetKey: toolConfig?.id });

  useEffect(() => {
    if (toolConfig && (toolConfig.id || toolConfig.version)) {
      const newNodes = toolConfig.nodes?.map(convertCoreNodeToReactFlow) || [];

      const validatedEdges = toolConfig.edges?.map((edge) => validateAndFixEdge(edge, toolConfig.nodes || [])).filter((edge): edge is NonNullable<typeof edge> => edge !== null) || [];
      const newEdges = validatedEdges.map(convertCoreEdgeToReactFlow);

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
  }, [toolConfig?.id, toolConfig?.version, nodes.map, setEdges, setNodes, toolConfig, edges.map]);

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      try {
        onEdgesChange(changes);

        setTimeout(() => {
          setEdges((currentEdges) => updateEdgeStyles(currentEdges));
        }, 0);
      } catch (error) {
        console.error("Error handling edge changes:", error);
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

  useEffect(() => {
    if (onChange) {
      const currentConfig = getCurrentConfiguration();

      if (!lastSentConfigRef.current || !deepEqual(currentConfig, lastSentConfigRef.current)) {
        lastSentConfigRef.current = currentConfig;
        onChange(currentConfig);
      }
    }
  }, [onChange, getCurrentConfiguration]);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const validation = isValidEdgeConnection(params.source!, params.sourceHandle || "", params.target!, params.targetHandle || "", nodes, edges);

      if (!validation.valid && !validation.existingEdge) {
        console.error(`Cannot create edge: ${validation.error}`);
        return;
      }

      takeSnapshot();

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

        if (validation.existingEdge) {
          console.log(`Replacing existing edge ${validation.existingEdge.id} with new connection`);
          updatedEdges = eds.filter((edge) => edge.id !== validation.existingEdge!.id);
        }

        return updateEdgeStyles(addEdge(newEdge, updatedEdges));
      });
    },
    [setEdges, nodes, edges, takeSnapshot],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      const validation = isValidEdgeConnection(
        newConnection.source!,
        newConnection.sourceHandle || "",
        newConnection.target!,
        newConnection.targetHandle || "",
        nodes,
        edges.filter((edge) => edge.id !== oldEdge.id),
      );

      if (!validation.valid && !validation.existingEdge) {
        console.error(`Cannot reconnect edge: ${validation.error}`);
        return;
      }

      takeSnapshot();

      const edgeType = getEdgeTypeFromHandle(newConnection.source!, newConnection.sourceHandle!);

      setEdges((eds) => {
        let updatedEdges = eds;

        if (validation.existingEdge) {
          console.log(`Replacing existing edge ${validation.existingEdge.id} with reconnection`);
          updatedEdges = eds.filter((edge) => edge.id !== validation.existingEdge!.id);
        }

        const reconnectedEdges = reconnectEdge(oldEdge, newConnection, updatedEdges);

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
    [setEdges, nodes, edges, takeSnapshot],
  );

  const onConnectStart = useCallback((_event: any, { nodeId, handleId, handleType }: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
    if (nodeId && handleId && handleType) {
      const sourceEdgeType = handleType === "source" ? getEdgeTypeFromHandle(nodeId, handleId) : undefined;
      setConnectionState({
        isConnecting: true,
        sourceNodeId: nodeId,
        sourceHandleId: handleId,
        sourceEdgeType,
      });
    }
  }, []);

  const onConnectEnd = useCallback((_event: any, _connectionState: any) => {
    setConnectionState({
      isConnecting: false,
      sourceNodeId: undefined,
      sourceHandleId: undefined,
      sourceEdgeType: undefined,
    });
  }, []);

  const isInteractiveTarget = useCallback((target: HTMLElement): boolean => {
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true" || target.isContentEditable) {
      return true;
    }
    if (target.closest('[role="dialog"]') || target.closest("[data-radix-dialog-content]") || target.closest(".modal") || target.closest('[aria-modal="true"]')) {
      return true;
    }
    if (
      target.closest('[role="menu"]') ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="combobox"]') ||
      target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-radix-popover-content]")
    ) {
      return true;
    }
    return false;
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (readOnly) {
        return;
      }

      const target = event.target as HTMLElement;
      const isMod = event.ctrlKey || event.metaKey;

      if (isMod && event.key.toLowerCase() === "z") {
        if (isInteractiveTarget(target)) {
          return;
        }
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (isMod && event.key.toLowerCase() === "y") {
        if (isInteractiveTarget(target)) {
          return;
        }
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === "Delete") {
        if (isInteractiveTarget(target)) {
          return;
        }

        const selectedNodes = nodes.filter((node) => node.selected);
        const selectedEdges = edges.filter((edge) => edge.selected);

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          takeSnapshot();

          if (selectedNodes.length > 0) {
            const nodeIdsToDelete = selectedNodes.map((node) => node.id);
            setNodes((nds) => nds.filter((n) => !nodeIdsToDelete.includes(n.id)));
            setEdges((eds) => eds.filter((e) => !nodeIdsToDelete.includes(e.source) && !nodeIdsToDelete.includes(e.target)));
          }

          if (selectedEdges.length > 0) {
            const edgeIdsToDelete = selectedEdges.map((edge) => edge.id);
            setEdges((eds) => eds.filter((e) => !edgeIdsToDelete.includes(e.id)));
          }
        }
      }
    },
    [nodes, edges, setNodes, setEdges, readOnly, undo, redo, takeSnapshot, isInteractiveTarget],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (readOnly || nodeId === "start" || nodeId === "end") {
        return;
      }
      takeSnapshot();
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges, readOnly, takeSnapshot],
  );

  const onNodeDragStart = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const triggerNodeCount = useMemo(() => nodes.filter((n) => n.type === "trigger").length, [nodes]);

  const workflowStatus = useMemo<WorkflowStatus>(() => {
    if (nodes.length === 0) {
      return { variant: "warn", message: "Empty workflow — drop a Trigger to start." };
    }
    if (triggerNodeCount === 0) {
      return { variant: "warn", message: "Add a Trigger node to define when this runs." };
    }
    if (triggerNodeCount > 1) {
      return { variant: "error", message: "Multiple Trigger nodes — only one is allowed." };
    }
    return { variant: "ok", message: "Workflow ready" };
  }, [nodes.length, triggerNodeCount]);

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

  const StatusIcon = STATUS_ICON[workflowStatus.variant];
  const showEmptyState = !readOnly && nodes.length === 0;

  return (
    <UndoRedoProvider value={takeSnapshot}>
      <div className="w-full h-full min-h-[400px] dark:bg-background flex">
        {!readOnly && <AgentSidebar className="flex-shrink-0" />}

        <div className="flex-1 relative" style={{ minHeight: 350 }} ref={reactFlowWrapper}>
          <NodeDeleteProvider onDelete={handleDeleteNode}>
            <ConnectionStateProvider connectionState={connectionState}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={readOnly || !interactive ? () => {} : onNodesChange}
                onEdgesChange={readOnly || !interactive ? () => {} : handleEdgesChange}
                onConnect={readOnly || !interactive ? () => {} : onConnect}
                onReconnect={readOnly || !interactive ? () => {} : onReconnect}
                onConnectStart={readOnly || !interactive ? () => {} : onConnectStart}
                onConnectEnd={readOnly || !interactive ? () => {} : onConnectEnd}
                onNodeDragStart={readOnly || !interactive ? undefined : onNodeDragStart}
                isValidConnection={readOnly || !interactive ? () => false : isValidConnection}
                nodeTypes={nodeTypes as NodeTypes}
                edgeTypes={edgeTypes}
                proOptions={{ hideAttribution: true }}
                fitView
                fitViewOptions={{ maxZoom: 1 }}
                colorMode={resolvedTheme()}
                minZoom={0.5}
                maxZoom={1.5}
                nodesDraggable={!readOnly && interactive}
                nodesConnectable={!readOnly && interactive}
                nodesFocusable={!readOnly && interactive}
                edgesFocusable={!readOnly && interactive}
                elementsSelectable={!readOnly && interactive}
                defaultEdgeOptions={{ style: { strokeWidth: 2 } }}
                connectionLineStyle={{ strokeWidth: 2, stroke: "var(--primary)", strokeDasharray: "5,5" }}
                snapToGrid={true}
                snapGrid={[10, 10]}
                connectionRadius={20}
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                {showMiniMap && (
                  <MiniMap
                    position="bottom-right"
                    pannable
                    zoomable
                    maskColor="rgba(0,0,0,0.35)"
                    className="!bg-background/80 !border !border-border/60 !rounded-md !shadow-sm overflow-hidden"
                    style={{ margin: 12 }}
                  />
                )}
              </ReactFlow>
            </ConnectionStateProvider>
          </NodeDeleteProvider>

          {/* Top-left: workflow status pill */}
          {!readOnly && (
            <div className="pointer-events-none absolute left-3 top-3 z-40 flex items-center gap-2">
              <div className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm", STATUS_STYLES[workflowStatus.variant])}>
                <StatusIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{workflowStatus.message}</span>
              </div>
            </div>
          )}

          {/* Top-right: undo/redo + counts */}
          {!readOnly && (
            <div className="absolute right-3 top-3 z-40 flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm tabular-nums">
                <span>
                  <span className="font-medium text-foreground">{nodes.length}</span> nodes
                </span>
                <span className="text-border">·</span>
                <span>
                  <span className="font-medium text-foreground">{edges.length}</span> edges
                </span>
              </div>
              <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-background/90 p-1 shadow-sm backdrop-blur-sm">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 disabled:opacity-40" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 disabled:opacity-40" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)">
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Bottom-left: custom controls */}
          {!readOnly && <CanvasControls interactive={interactive} onToggleInteractive={() => setInteractive((v) => !v)} showMiniMap={showMiniMap} onToggleMiniMap={() => setShowMiniMap((v) => !v)} />}

          {/* Empty state hint */}
          {showEmptyState && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/70 px-6 py-5 text-center shadow-sm backdrop-blur-sm">
                <Sparkles className="h-5 w-5 text-primary/70" />
                <div className="text-sm font-medium text-foreground">Build your first workflow</div>
                <div className="max-w-xs text-xs text-muted-foreground">
                  Click a node in the Node Library to add it to the canvas. Start with a <span className="font-medium text-foreground">Trigger</span>.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </UndoRedoProvider>
  );
};

const ToolEditor: React.FC<ToolEditorProps> = ({ toolConfig, onChange, readOnly }) => {
  return (
    <ReactFlowProvider>
      <ToolEditorContent toolConfig={toolConfig} onChange={onChange} readOnly={readOnly} />
    </ReactFlowProvider>
  );
};

export default ToolEditor;

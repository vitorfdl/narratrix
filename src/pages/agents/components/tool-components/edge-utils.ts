import { AgentEdgeType, AgentNodeType } from "@/schema/agent-schema";
import { Edge, Node } from "@xyflow/react";
import { EdgeRegistry, EdgeType } from "./edge-registry";
import { NodeRegistry } from "./node-registry";
import { ToolNodeData } from "./types";

// Get edge style based on edge type and selection state
export const getEdgeStyle = (edgeType?: EdgeType, selected?: boolean) => {
  return EdgeRegistry.getStyle(edgeType || "string", selected);
};

// Convert core edge to React Flow format
export const convertCoreEdgeToReactFlow = (coreEdge: AgentEdgeType): Edge => {
  return {
    id: coreEdge.id,
    source: coreEdge.source,
    target: coreEdge.target,
    sourceHandle: coreEdge.sourceHandle,
    targetHandle: coreEdge.targetHandle,
    style: getEdgeStyle(coreEdge.edgeType as EdgeType, false),
    data: { edgeType: coreEdge.edgeType },
    reconnectable: true,
  };
};

// Convert React Flow edge to core format
export const convertReactFlowEdgeToCore = (reactFlowEdge: Edge): AgentEdgeType => {
  return {
    id: reactFlowEdge.id,
    source: reactFlowEdge.source,
    target: reactFlowEdge.target,
    sourceHandle: reactFlowEdge.sourceHandle || "",
    targetHandle: reactFlowEdge.targetHandle || "",
    edgeType: (reactFlowEdge.data?.edgeType as EdgeType) || "string",
  };
};

// Edge validation and auto-correction
export const validateAndFixEdge = (edge: AgentEdgeType, nodes: AgentNodeType[]): AgentEdgeType | null => {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!sourceNode || !targetNode) {
    console.warn(`Edge ${edge.id}: Missing source or target node`);
    return null;
  }

  // Check if the edge is backwards (source handle is actually a target handle)
  const isBackwards = edge.sourceHandle.startsWith("in-") || (sourceNode.type === "agent" && edge.sourceHandle === "in-toolset");

  if (isBackwards) {
    console.warn(`Edge ${edge.id}: Detected backwards edge, auto-correcting`);

    // Swap source and target
    const correctedEdge: AgentEdgeType = {
      ...edge,
      source: edge.target,
      target: edge.source,
      sourceHandle: edge.targetHandle || "out-toolset", // Default to out-toolset for toolset edges
      targetHandle: edge.sourceHandle,
    };

    return correctedEdge;
  }

  return edge;
};

// Centralized edge type compatibility validation
export const areEdgeTypesCompatible = (sourceEdgeType: EdgeType, targetEdgeType: EdgeType): boolean => {
  // "any" type can accept connections from any source
  if (targetEdgeType === "any") {
    return true;
  }

  // Same types are always compatible
  if (sourceEdgeType === targetEdgeType) {
    return true;
  }

  // Toolset edges cannot connect to string edges and vice versa
  if (sourceEdgeType === "toolset" && targetEdgeType === "string") {
    return false;
  }
  if (sourceEdgeType === "string" && targetEdgeType === "toolset") {
    return false;
  }

  return false; // Default to incompatible for safety
};

// Get edge type from handle element or node metadata
export const getEdgeTypeFromHandle = (nodeId: string, handleId: string): EdgeType => {
  // First try to get from DOM element
  const nodeElement = document.querySelector(`[data-id="${nodeId}"]`);
  const handleElement = nodeElement?.querySelector(`[data-handleid="${handleId}"]`);
  const domEdgeType = handleElement?.getAttribute("data-edge-type") as EdgeType;

  console.log(`Getting edge type for node ${nodeId}, handle ${handleId}:`, {
    domEdgeType,
    hasNodeElement: !!nodeElement,
    hasHandleElement: !!handleElement,
  });

  if (domEdgeType && EdgeRegistry.isValidType(domEdgeType)) {
    console.log(`Using DOM edge type: ${domEdgeType}`);
    return domEdgeType;
  }

  // Fallback to node metadata
  const nodeType = nodeElement?.getAttribute("data-nodetype") || "";
  const nodeMetadata = NodeRegistry.getNodeMetadata(nodeType);

  console.log(`Fallback to metadata for node type ${nodeType}:`, nodeMetadata);

  if (nodeMetadata) {
    // Check inputs
    const input = nodeMetadata.inputs?.find((inp) => inp.id === handleId);
    if (input?.edgeType) {
      console.log(`Found input edge type: ${input.edgeType}`);
      return input.edgeType;
    }

    // Check outputs
    const output = nodeMetadata.outputs?.find((out) => out.id === handleId);
    if (output?.edgeType) {
      console.log(`Found output edge type: ${output.edgeType}`);
      return output.edgeType;
    }
  }

  // Final fallback
  console.log("Using fallback edge type: string");
  return "string";
};

// Check if an input handle already has a connection
export const hasExistingConnection = (targetNodeId: string, targetHandle: string, edges: Edge[]): Edge | null => {
  return edges.find((edge) => edge.target === targetNodeId && edge.targetHandle === targetHandle) || null;
};

// Comprehensive edge validation utility
export const isValidEdgeConnection = (
  sourceNodeId: string,
  sourceHandle: string,
  targetNodeId: string,
  targetHandle: string,
  nodes: Node<ToolNodeData>[],
  edges: Edge[] = [],
): { valid: boolean; error?: string; existingEdge?: Edge } => {
  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  const targetNode = nodes.find((n) => n.id === targetNodeId);

  if (!sourceNode || !targetNode) {
    return { valid: false, error: "Source or target node not found" };
  }

  // Source handle must be an output handle (not start with 'in-')
  if (sourceHandle.startsWith("in-")) {
    return { valid: false, error: `"${sourceHandle}" is an input handle, cannot be used as source` };
  }

  // Target handle must be an input handle (start with 'in-') or be 'response'
  if (targetHandle && !targetHandle.startsWith("in-") && targetHandle !== "response") {
    return { valid: false, error: `"${targetHandle}" is not a valid input handle` };
  }

  // Check for self-connections
  if (sourceNodeId === targetNodeId) {
    return { valid: false, error: "Cannot connect node to itself" };
  }

  // Check edge type compatibility
  const sourceEdgeType = getEdgeTypeFromHandle(sourceNodeId, sourceHandle);
  const targetEdgeType = getEdgeTypeFromHandle(targetNodeId, targetHandle);

  console.log("Edge compatibility check:", {
    sourceNodeId,
    sourceHandle,
    sourceEdgeType,
    targetNodeId,
    targetHandle,
    targetEdgeType,
    compatible: areEdgeTypesCompatible(sourceEdgeType, targetEdgeType),
  });

  if (!areEdgeTypesCompatible(sourceEdgeType, targetEdgeType)) {
    return {
      valid: false,
      error: `Cannot connect ${sourceEdgeType} edge to ${targetEdgeType} handle`,
    };
  }

  // Check if target input already has a connection (after type compatibility check)
  const existingEdge = hasExistingConnection(targetNodeId, targetHandle, edges);
  if (existingEdge) {
    // Return valid with existing edge info for replacement (types are already compatible)
    return { valid: true, existingEdge };
  }

  return { valid: true };
};

// Update edge styles based on selection
export const updateEdgeStyles = (edges: Edge[]): Edge[] => {
  return edges.map((edge) => ({
    ...edge,
    style: getEdgeStyle(edge.data?.edgeType as EdgeType, edge.selected),
  }));
};

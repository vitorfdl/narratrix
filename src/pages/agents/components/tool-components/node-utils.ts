import { AgentNodeType } from "@/schema/agent-schema";
import { Node } from "@xyflow/react";
import { NodeRegistry } from "./node-registry";
import { ToolNodeData } from "./types";

// Node ID counter
let nodeId = 0;

export const getNodeId = () => `node-${nodeId++}`;

// Convert core node to React Flow format
export const convertCoreNodeToReactFlow = (coreNode: AgentNodeType): Node<ToolNodeData> => {
  return {
    id: coreNode.id,
    type: coreNode.type,
    position: coreNode.position,
    data: {
      label: coreNode.label,
      config: coreNode.config,
    },
    draggable: true,
    selectable: true,
    deletable: true,
  };
};

// Convert React Flow node to core format
export const convertReactFlowNodeToCore = (reactFlowNode: Node<ToolNodeData>): AgentNodeType => {
  return {
    id: reactFlowNode.id,
    type: reactFlowNode.type || "",
    position: reactFlowNode.position,
    label: reactFlowNode.data.label,
    config: reactFlowNode.data.config,
  };
};

// Get node configuration from registry
export const getNodeConfig = (type: string) => {
  return NodeRegistry.getDefaultConfig(type);
};

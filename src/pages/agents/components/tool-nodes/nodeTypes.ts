import { ToolNodeData } from "../ToolEditor";

/**
 * Custom NodeProps interface that correctly extends ReactFlowNodeProps
 * to allow our custom ToolNodeData type
 */
export interface NodeProps {
  data: ToolNodeData;
  selected: boolean;
  id: string;
  type: string;
}

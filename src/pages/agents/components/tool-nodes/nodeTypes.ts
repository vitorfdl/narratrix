import { ToolNodeData } from "../AgentEditor";

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

// Node options for selection
export const NODE_TYPE_OPTIONS = [
  { value: "agent", label: "Agent" },
  { value: "javascript", label: "Javascript Node" },
  { value: "chatInput", label: "Chat Input" },
  { value: "chatOutput", label: "Chat Output" },
];

// Export all node components
export { AgentNode } from "./nodeAgent";
export { ChatInputNode } from "./nodeChatInput";
export { ChatOutputNode } from "./nodeChatOutput";
export { JavascriptNode } from "./nodeJavascript";


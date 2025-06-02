// Import all node types to ensure they register themselves with the NodeRegistry
import "./nodeAgent";
import "./nodeChatInput";
import "./nodeChatOutput";
import "./nodeJavascript";

// Re-export the NodeProps interface
export type { NodeProps } from "./nodeTypes";

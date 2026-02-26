// Import all node types to ensure they register themselves with the NodeRegistry
import "./nodeAgent";
import "./nodeChatHistory";
import "./nodeChatInput";
import "./nodeChatOutput";
import "./nodeJavascript";
import "./nodeText";
import "./nodeParticipantPicker";
import "./nodeTrigger";

// Re-export the NodeProps interface
export type { NodeProps } from "./nodeTypes";

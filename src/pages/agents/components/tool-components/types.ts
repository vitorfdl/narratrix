import { AgentType } from "@/schema/agent-schema";
import { XYPosition } from "@xyflow/react";

// Node type keys - updated to match Langflow style
export type ToolNodeType = "agent" | "chatInput" | "chatOutput" | "javascript" | "message";

// Node data typing for React Flow
export interface ToolNodeData {
  label: string;
  config?: Record<string, any>;
  [key: string]: unknown;
}

// Props for the ToolEditor component
export interface ToolEditorProps {
  toolConfig: AgentType;
  onChange?: (config: AgentType) => void;
  readOnly?: boolean;
}

// Node picker component props
export interface NodePickerProps {
  position: XYPosition;
  onSelect: (type: string) => void;
  onCancel: () => void;
}

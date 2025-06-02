import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, User } from "lucide-react";
import { memo, useCallback } from "react";
import { NodeBase, NodeOutput } from "../tool-components/NodeBase";
import { NodeRegistry, createNodeTheme } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

// Define the node's metadata and properties
const CHAT_INPUT_NODE_METADATA = {
  type: "chatInput",
  label: "Chat Input",
  description: "User input entry point for the conversation flow",
  icon: MessageSquare,
  theme: createNodeTheme("blue"),
  deletable: true,
  inputs: [],
  outputs: [{ id: "message", label: "Message", edgeType: "string" as const }] as NodeOutput[],
  defaultConfig: {},
};

// Configuration provider namespace
export namespace ChatInputNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: CHAT_INPUT_NODE_METADATA.label,
      config: CHAT_INPUT_NODE_METADATA.defaultConfig,
    };
  }
}

/**
 * Memoized content component to prevent unnecessary re-renders
 */
const ChatInputContent = memo(() => {
  // Prevent event propagation to React Flow
  const handleConfigButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Add configuration functionality
  }, []);

  return (
    <div className="space-y-4 w-full">
      {/* Input Type Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Input Type</label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary/10"
            onClick={handleConfigButtonClick}
            title="Configure input settings"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <User className="h-3 w-3 text-primary" />
          <span className="text-xs text-muted-foreground font-medium">User Message</span>
        </div>
      </div>
    </div>
  );
});

ChatInputContent.displayName = "ChatInputContent";

/**
 * ChatInputNode: Represents user input in the conversation flow
 * This node outputs the user's message to be processed by other nodes
 */
export const ChatInputNode = memo(({ data, selected, id }: NodeProps) => {
  return (
    <NodeBase nodeId={id} data={data} selected={!!selected}>
      <ChatInputContent />
    </NodeBase>
  );
});

ChatInputNode.displayName = "ChatInputNode";

// Register the node
NodeRegistry.register({
  metadata: CHAT_INPUT_NODE_METADATA,
  component: ChatInputNode,
  configProvider: ChatInputNodeConfigProvider,
});

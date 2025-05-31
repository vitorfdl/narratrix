import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, User } from "lucide-react";
import { memo, useCallback } from "react";
import { NodeBase, NodeOutput, useNodeRef } from "./NodeBase";
import { NodeConfigProvider, NodeConfigRegistry } from "./NodeConfigRegistry";
import { NodeProps } from "./nodeTypes";

/**
 * Configuration provider for Chat Input nodes
 */
export class ChatInputNodeConfigProvider implements NodeConfigProvider {
  getDefaultConfig() {
    return {
      label: "Chat Input",
      config: {},
    };
  }
}

// Register the configuration provider
NodeConfigRegistry.register("chatInput", new ChatInputNodeConfigProvider());

/**
 * Memoized content component to prevent unnecessary re-renders
 */
const ChatInputContent = memo(() => {
  const registerElementRef = useNodeRef();
  
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

ChatInputContent.displayName = 'ChatInputContent';

/**
 * ChatInputNode: Represents user input in the conversation flow
 * This node outputs the user's message to be processed by other nodes
 */
export const ChatInputNode = memo(({ data, selected, id }: NodeProps) => {
  const outputs: NodeOutput[] = [
    { id: "message", label: "Message", edgeType: "string" }
  ];

  return (
    <NodeBase 
      title="Chat Input" 
      nodeType="chatInput" 
      data={data} 
      selected={!!selected} 
      outputs={outputs}
      icon={<MessageSquare className="h-4 w-4" />}
      nodeId={id}
      deletable={true}
    >
      <ChatInputContent />
    </NodeBase>
  );
});

ChatInputNode.displayName = 'ChatInputNode'; 
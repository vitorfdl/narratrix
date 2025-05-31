import { Button } from "@/components/ui/button";
import { Bot, MessageCircle, Settings } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { NodeBase, NodeInput, useNodeRef } from "./NodeBase";
import { NodeConfigProvider, NodeConfigRegistry } from "./NodeConfigRegistry";
import { NodeProps } from "./nodeTypes";

/**
 * Configuration provider for Chat Output nodes
 */
export class ChatOutputNodeConfigProvider implements NodeConfigProvider {
  getDefaultConfig() {
    return {
      label: "Chat Output",
      config: {},
    };
  }
}

// Register the configuration provider
NodeConfigRegistry.register("chatOutput", new ChatOutputNodeConfigProvider());

/**
 * Memoized content component to prevent unnecessary re-renders
 */
const ChatOutputContent = memo<{ receivedValue: string }>(({ receivedValue }) => {
  const registerElementRef = useNodeRef();
  
  // Prevent event propagation to React Flow
  const handleConfigButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Add configuration functionality
  }, []);
  
  return (
    <div className="space-y-4 w-full">
      {/* Output Type Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Output Type</label>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 hover:bg-primary/10"
            onClick={handleConfigButtonClick}
            title="Configure output settings"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <Bot className="h-3 w-3 text-accent-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Assistant Response</span>
        </div>
      </div>

      {/* Response Preview Section - This aligns with the "response" input handle */}
      <div 
        ref={(el) => registerElementRef?.("response-section", el)}
        className="space-y-2"
      >
        <label className="text-xs font-medium">Message</label>
        <div className="p-3 bg-muted/50 rounded-md border-l-2 border-accent max-h-32 overflow-y-auto">
          {receivedValue ? (
            <div className="flex items-start gap-2">
              <Bot className="h-3 w-3 text-accent-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs  text-muted-foreground whitespace-pre-wrap">{receivedValue}</div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground italic">
                Receiving Input...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ChatOutputContent.displayName = 'ChatOutputContent';

/**
 * ChatOutputNode: Represents the final output in the conversation flow
 * This node receives the processed response and displays it to the user
 */
export const ChatOutputNode = memo(({ data, selected, id }: NodeProps) => {
  const [receivedValue, setReceivedValue] = useState<string>("");

  const inputs: NodeInput[] = [
    { id: "response", label: "Response", edgeType: "string", targetRef: "response-section" }
  ];

  // Listen for updates to the data (if your system provides runtime values)
  useEffect(() => {
    if (typeof data.value === "string") {
      setReceivedValue(data.value);
    }
  }, [data.value]);

  return (
    <NodeBase 
      title="Chat Output" 
      nodeType="chatOutput" 
      data={data} 
      selected={!!selected} 
      inputs={inputs}
      icon={<MessageCircle className="h-4 w-4" />}
      nodeId={id}
    >
      <ChatOutputContent receivedValue={receivedValue} />
    </NodeBase>
  );
});

ChatOutputNode.displayName = 'ChatOutputNode'; 
import { Button } from "@/components/ui/button";
import { useStore } from "@xyflow/react";
import { Bot, MessageCircle, Settings } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { NodeBase, NodeInput, useNodeRef } from "../tool-components/NodeBase";
import { NodeRegistry, createNodeTheme } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

// Define the node's metadata and properties
const CHAT_OUTPUT_NODE_METADATA = {
  type: "chatOutput",
  label: "Chat Output",
  category: "Chat",
  description: "Display the final response in the conversation flow",
  icon: MessageCircle,
  theme: createNodeTheme("green"),
  deletable: true,
  inputs: [{ id: "response", label: "Response", edgeType: "string" as const, targetRef: "response-section" }] as NodeInput[],
  outputs: [],
  defaultConfig: {},
};

// Configuration provider namespace
export namespace ChatOutputNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: CHAT_OUTPUT_NODE_METADATA.label,
      config: CHAT_OUTPUT_NODE_METADATA.defaultConfig,
    };
  }
}

/**
 * Memoized content component to prevent unnecessary re-renders
 */
const ChatOutputContent = memo<{ nodeId: string }>(({ nodeId }) => {
  const registerElementRef = useNodeRef();

  // Subscribe to edges from React Flow store to get real-time updates
  const edges = useStore((state) => state.edges);

  // Count connected tool edges
  const isResponseConnected = useMemo(() => {
    return edges.filter((edge) => edge.target === nodeId && edge.targetHandle === "response").length;
  }, [edges, nodeId]);

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
          <Bot className="h-3 w-3 text-green-600 dark:text-green-400" />
          <span className="text-xs text-muted-foreground font-medium">Assistant Response</span>
        </div>
      </div>

      {/* Response Preview Section - This aligns with the "response" input handle */}
      <div ref={(el) => registerElementRef?.("response-section", el)} className="space-y-2">
        <label className="text-xs font-medium">Message</label>
        <div className="p-3 bg-muted/50 rounded-md border-l-2 border-green-400 dark:border-green-500 max-h-32 overflow-y-auto">
          {!isResponseConnected ? (
            <div className="flex items-start gap-2">
              <div className="text-xs  text-muted-foreground whitespace-pre-wrap">Chat Output Configuration will display here</div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Bot className="h-3 w-3 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-muted-foreground italic">Receiving Input...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ChatOutputContent.displayName = "ChatOutputContent";

/**
 * ChatOutputNode: Represents the final output in the conversation flow
 * This node receives the processed response and displays it to the user
 */
export const ChatOutputNode = memo(({ data, selected, id }: NodeProps) => {
  const [receivedValue, setReceivedValue] = useState<string>("");

  // Listen for updates to the data (if your system provides runtime values)
  useEffect(() => {
    if (typeof data.value === "string") {
      setReceivedValue(data.value);
    }
  }, [data.value]);

  return (
    <NodeBase nodeId={id} data={data} selected={!!selected}>
      <ChatOutputContent nodeId={id} />
    </NodeBase>
  );
});

ChatOutputNode.displayName = "ChatOutputNode";

// Register the node
NodeRegistry.register({
  metadata: CHAT_OUTPUT_NODE_METADATA,
  component: ChatOutputNode,
  configProvider: ChatOutputNodeConfigProvider,
});

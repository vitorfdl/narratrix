import { useStore } from "@xyflow/react";
import { Bot, MessageCircle } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useChatStore } from "@/hooks/chatStore";
import { ChatMessageType } from "@/schema/chat-message-schema";
import { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { getNextMessagePosition } from "@/services/chat-message-service";
import { NodeBase, NodeInput, useNodeRef } from "../tool-components/NodeBase";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

/**
 * Node Execution
 */
const executeChatOutputNode: NodeExecutor = async (_node, inputs): Promise<NodeExecutionResult> => {
  if (inputs.characterId && typeof inputs.characterId !== "string") {
    return { success: false, error: "Character ID must be a string" };
  }

  const response: string = typeof inputs.response === "string" ? inputs.response : "";
  const participantId: string | undefined = inputs.characterId ? (inputs.characterId as string) : undefined;
  const isUser = participantId === "user";

  if (!response) {
    return { success: false, error: "Chat output node missing response text" };
  }

  try {
    const store = useChatStore.getState();
    const chatId = store.selectedChat?.id;
    const chapterId = store.selectedChat?.active_chapter_id;

    if (!chatId || !chapterId) {
      return { success: false, error: "No active chat/chapter to write output" };
    }

    const position = await getNextMessagePosition(chatId, chapterId);
    await store.actions.addChatMessage({
      character_id: isUser ? null : participantId || null,
      type: (isUser ? "user" : participantId ? "character" : "system") as ChatMessageType,
      messages: [response],
      position,
      disabled: false,
      tokens: null,
      extra: { script: "agent" },
    });

    return { success: true, value: response };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to write chat output";
    return { success: false, error: message };
  }
};

/**
 * UI and Node Configuration
 */
const CHAT_OUTPUT_NODE_METADATA = {
  type: "chatOutput",
  label: "Chat Output",
  category: "Chat",
  description: "Display the final response in the conversation flow",
  icon: MessageCircle,
  theme: createNodeTheme("green"),
  deletable: true,
  inputs: [
    { id: "response", label: "Response", edgeType: "string" as const, targetRef: "response-section" },
    { id: "in-character", label: "Participant ID", edgeType: "string" as const, targetRef: "participant-section" },
  ] as NodeInput[],
  outputs: [],
  defaultConfig: {},
};

// Configuration provider namespace
namespace ChatOutputNodeConfigProvider {
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
  // Participant handle visibility only; no preview needed here

  return (
    <div className="space-y-4 w-full">
      {/* Participant Section - This aligns with the "in-character" input handle */}
      <div ref={(el) => registerElementRef?.("participant-section", el)} className="space-y-2">
        <label className="text-xs font-medium">Participant (optional)</label>
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
  const [_receivedValue, setReceivedValue] = useState<string>("");

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
  executor: executeChatOutputNode,
});

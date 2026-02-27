import { useStore } from "@xyflow/react";
import { MessageCircle, User } from "lucide-react";
import { memo, useMemo } from "react";
import { useChatStore } from "@/hooks/chatStore";
import { ChatMessageType } from "@/schema/chat-message-schema";
import { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { getNextMessagePosition } from "@/services/chat-message-service";
import { NodeBase, NodeInput } from "../tool-components/NodeBase";
import { NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

/**
 * Node Execution
 */
const executeChatOutputNode: NodeExecutor = async (_node, inputs, _context, _agent): Promise<NodeExecutionResult> => {
  const response: string = typeof inputs.response === "string" ? inputs.response : "";
  const participantId = typeof inputs.characterId === "string" ? inputs.characterId : undefined;

  if (!response) {
    return { success: false, error: "Chat output node missing response text" };
  }

  if (!participantId) {
    return { success: false, error: "Chat output node requires a participant ID" };
  }

  const isUser = participantId === "user";

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
      type: (isUser ? "user" : "character") as ChatMessageType,
      messages: [response],
      position,
      disabled: false,
      tokens: null,
      extra: {},
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
  label: "Chat Message",
  category: "Chat",
  description: "Post a message to the chat as a character or user",
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
  const edges = useStore((state) => state.edges);
  const isResponseConnected = useMemo(() => edges.filter((edge) => edge.target === nodeId && edge.targetHandle === "response").length > 0, [edges, nodeId]);

  return (
    <div className="space-y-3 w-full">
      <NodeField label="Participant" icon={User} refId="participant-section" helpText="The character who 'says' this message. Connect a Participant Picker or Trigger output." />
      <NodeField label="Message" icon={MessageCircle} refId="response-section">
        <NodeConfigPreview variant="badge">
          {isResponseConnected ? <span className="text-xs text-muted-foreground italic">Receiving input...</span> : <span className="text-xs text-muted-foreground">Connect a response source</span>}
        </NodeConfigPreview>
      </NodeField>
    </div>
  );
});

ChatOutputContent.displayName = "ChatOutputContent";

export const ChatOutputNode = memo(({ data, selected, id }: NodeProps) => {
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

import { MessageCircle, User } from "lucide-react";
import { memo } from "react";
import { useChatStore } from "@/hooks/chatStore";
import type { TriggerContext } from "@/schema/agent-schema";
import { ChatMessageType } from "@/schema/chat-message-schema";
import { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { createChatMessage, getChatMessagesByChatId, getNextMessagePosition } from "@/services/chat-message-service";
import { NodeBase, NodeInput, NodeOutput } from "../tool-components/NodeBase";
import { NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

/**
 * Node Execution
 */
const executeChatOutputNode: NodeExecutor = async (node, inputs, context, agent, deps): Promise<NodeExecutionResult> => {
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
    const triggerCtx = context.nodeValues.get("workflow-trigger-context") as TriggerContext | undefined;
    const executionId = context.nodeValues.get("workflow-execution-id") as string | undefined;

    // Prefer the chat that triggered the workflow; fall back to the currently selected chat
    // only when no chatId is available (e.g. legacy string-based trigger contexts).
    const store = useChatStore.getState();
    let chatId: string | undefined = triggerCtx?.chatId ?? context.chatId;
    let chapterId: string | undefined;

    if (chatId) {
      const targetChat = await deps.getChatById(chatId);
      chapterId = targetChat?.active_chapter_id ?? undefined;
    } else {
      chatId = store.selectedChat?.id;
      chapterId = store.selectedChat?.active_chapter_id ?? undefined;
    }

    if (!chatId || !chapterId) {
      return { success: false, error: "No active chat/chapter to write output" };
    }

    const position = await getNextMessagePosition(chatId, chapterId);
    const newMessage = await createChatMessage({
      character_id: isUser ? null : participantId || null,
      type: (isUser ? "user" : "character") as ChatMessageType,
      messages: [response],
      message_index: 0,
      position,
      chat_id: chatId,
      chapter_id: chapterId,
      disabled: false,
      tokens: null,
      extra: {
        script: "agent",
        name: agent.name,
        agentId: agent.id,
        triggerContext: triggerCtx as Record<string, unknown> | undefined,
        executionId,
      },
    });

    if (useChatStore.getState().selectedChat?.id === chatId) {
      const updatedMessages = await getChatMessagesByChatId(chatId, chapterId);
      useChatStore.setState({ selectedChatMessages: updatedMessages });
    }

    context.nodeValues.set(`${node.id}::out-message-id`, newMessage.id);

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
  outputs: [{ id: "out-message-id", label: "Message ID", edgeType: "string" as const }] as NodeOutput[],
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
const ChatOutputContent = memo<{ nodeId: string }>(() => {
  return (
    <div className="space-y-3 w-full">
      <NodeField label="Participant" icon={User} refId="participant-section" helpText="The character who 'says' this message. Connect a Participant Picker or Trigger output." />
      <NodeField label="Message / Text" icon={MessageCircle} refId="response-section"></NodeField>
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

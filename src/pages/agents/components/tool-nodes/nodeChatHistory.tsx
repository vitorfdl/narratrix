import { useReactFlow } from "@xyflow/react";
import { Filter, Layers, MessageSquare, SlidersHorizontal, User } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useChatStore } from "@/hooks/chatStore";
import { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { NodeBase, NodeInput, NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

/**
 * Node Execution
 */
const executeChatHistoryNode: NodeExecutor = async (node, inputs): Promise<NodeExecutionResult> => {
  try {
    const { selectedChatMessages } = useChatStore.getState();
    let history = Array.isArray(selectedChatMessages) ? selectedChatMessages : [];

    const config: ChatHistoryNodeConfig = {
      name: "Chat History Node",
      depth: 10,
      messageType: "all",
      ...(node.config as Partial<ChatHistoryNodeConfig>),
    };

    // Optional participant filter: if inputs.characterId or inputs.participantId is provided
    const participantId: string | undefined = (inputs.characterId as string) || (inputs.participantId as string);
    if (participantId) {
      if (participantId === "user") {
        history = history.filter((m) => m.type === "user");
      } else {
        history = history.filter((m) => m.character_id === participantId);
      }
    }

    // Apply messageType filter from config
    if (config.messageType !== "all") {
      // ChatMessageType uses "character" for AI/assistant messages
      const targetType = config.messageType === "assistant" ? "character" : config.messageType;
      history = history.filter((m) => m.type === targetType);
    }

    // Apply depth: take the last N messages
    if (config.depth > 0) {
      history = history.slice(-config.depth);
    }

    return { success: true, value: history };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to read chat history";
    return { success: false, error: message };
  }
};

/**
 * UI and Node Configuration
 */
export interface ChatHistoryNodeConfig {
  name: string;
  depth: number;
  messageType: "all" | "assistant" | "user" | "system";
}

// Define the node's metadata and properties
const CHAT_HISTORY_NODE_METADATA = {
  type: "chatHistory",
  label: "Chat History",
  category: "Chat",
  description: "Retrieve filtered chat history with configurable depth and message type",
  icon: MessageSquare,
  theme: createNodeTheme("green"),
  deletable: true,
  inputs: [{ id: "in-character", label: "Character ID", edgeType: "string", targetRef: "character-input-section" }] as NodeInput[],
  outputs: [{ id: "out-messages", label: "Chat History", edgeType: "message-list" }] as NodeOutput[],
  defaultConfig: {
    name: "Chat History Node",
    depth: 10,
    messageType: "all" as const,
  } as ChatHistoryNodeConfig,
};

// Configuration provider namespace
namespace ChatHistoryNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: CHAT_HISTORY_NODE_METADATA.label,
      config: CHAT_HISTORY_NODE_METADATA.defaultConfig,
    };
  }
}

/**
 * ChatHistoryNodeConfigDialog: Dialog for configuring Chat History node
 */
export interface ChatHistoryNodeConfigDialogProps {
  open: boolean;
  initialConfig: ChatHistoryNodeConfig;
  onSave: (config: ChatHistoryNodeConfig) => void;
  onCancel: () => void;
}

const ChatHistoryNodeConfigDialog: React.FC<ChatHistoryNodeConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = useForm<ChatHistoryNodeConfig>({
    defaultValues: initialConfig,
    mode: "onChange",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset(initialConfig);
    }
  }, [open, reset, initialConfig]);

  // Save handler
  const onSubmit = (data: ChatHistoryNodeConfig) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Chat History</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4 py-2">
              <div>
                <Label className="text-xs font-medium text-foreground mb-1 block">Node Name</Label>
                <Controller name="name" control={control} render={({ field }) => <Input {...field} placeholder="Enter node name" className="text-xs" maxLength={64} autoFocus />} />
              </div>

              <Controller
                name="depth"
                control={control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-medium">Message Depth</Label>
                      <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-0.5 rounded-md">{field.value}</span>
                    </div>
                    <Slider min={1} max={500} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} className="py-1" />
                  </div>
                )}
              />

              <div>
                <Label className="text-xs font-medium text-foreground mb-1 block">Message Type</Label>
                <Controller
                  name="messageType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select message type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Messages</SelectItem>
                        <SelectItem value="assistant">Assistant Only</SelectItem>
                        <SelectItem value="user">User Only</SelectItem>
                        <SelectItem value="system">System Only</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} size="dialog">
              Cancel
            </Button>
            <Button type="submit" size="dialog" disabled={!isDirty || !isValid}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Memoized content component to prevent unnecessary re-renders
 */
const ChatHistoryContent = memo<{ config: ChatHistoryNodeConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case "all":
        return "All Messages";
      case "assistant":
        return "Assistant Only";
      case "user":
        return "User Only";
      case "system":
        return "System Only";
      default:
        return "All Messages";
    }
  };

  return (
    <div className="space-y-3 w-full">
      <NodeField
        label="Participant ID"
        icon={User}
        optional
        refId="character-input-section"
        helpText="Filter history to a specific participant. Leave unconnected to include messages from all participants."
      />
      <NodeField label="Configuration" icon={SlidersHorizontal} action={<NodeConfigButton onClick={onConfigure} title="Configure chat history settings" />}>
        <NodeConfigPreview
          items={[
            { label: "Depth", value: `${config.depth} messages`, icon: Layers },
            { label: "Type", value: getMessageTypeLabel(config.messageType), icon: Filter },
          ]}
        />
      </NodeField>
    </div>
  );
});

ChatHistoryContent.displayName = "ChatHistoryContent";

export const ChatHistoryNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || CHAT_HISTORY_NODE_METADATA.defaultConfig) as ChatHistoryNodeConfig;

  const handleConfigSave = useCallback(
    (newConfig: ChatHistoryNodeConfig) => {
      // Use React Flow's setNodes to properly update the node
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes],
  );

  const handleConfigCancel = useCallback(() => {
    setConfigDialogOpen(false);
  }, []);

  const handleConfigure = useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <ChatHistoryContent config={config} onConfigure={handleConfigure} />
      </NodeBase>

      <ChatHistoryNodeConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={handleConfigCancel} />
    </>
  );
});

ChatHistoryNode.displayName = "ChatHistoryNode";

// Register the node
NodeRegistry.register({
  metadata: CHAT_HISTORY_NODE_METADATA,
  component: ChatHistoryNode,
  configProvider: ChatHistoryNodeConfigProvider,
  executor: executeChatHistoryNode,
});

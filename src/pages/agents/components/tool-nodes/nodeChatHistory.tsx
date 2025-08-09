import { useReactFlow } from "@xyflow/react";
import { MessageSquare, Settings } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeBase, NodeInput, NodeOutput, useNodeRef } from "../tool-components/NodeBase";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

/**
 * ChatHistoryNode: Node for retrieving filtered chat history
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
export namespace ChatHistoryNodeConfigProvider {
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

export const ChatHistoryNodeConfigDialog: React.FC<ChatHistoryNodeConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
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
  }, [open, reset]);

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

              <div>
                <Label className="text-xs font-medium text-foreground mb-1 block">Message Depth</Label>
                <Controller
                  name="depth"
                  control={control}
                  rules={{
                    required: "Depth is required",
                    min: { value: 1, message: "Depth must be at least 1" },
                    max: { value: 1000, message: "Depth cannot exceed 1000" },
                  }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="number"
                      placeholder="Number of messages to retrieve"
                      className="text-xs"
                      min={1}
                      max={1000}
                      onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 1)}
                    />
                  )}
                />
              </div>

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
  const registerElementRef = useNodeRef();

  // Prevent event propagation to React Flow
  const handleConfigureClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onConfigure();
    },
    [onConfigure],
  );

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
    <div className="space-y-4 w-full">
      {/* Input Section */}
      <div className="space-y-2" ref={(el) => registerElementRef?.("character-input-section", el)}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Participant ID (Optional)</label>
        </div>
      </div>

      {/* Configuration Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Configuration</label>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10" onClick={handleConfigureClick} title="Configure chat history settings">
            <Settings className="h-3 w-3" />
          </Button>
        </div>

        <div className="p-2 bg-muted/50 rounded-md border-l-2 border-green-400 dark:border-green-500">
          <div className="space-y-0">
            <div className="text-xxs text-muted-foreground">
              <span className="font-medium">Depth:</span> {config.depth} messages
            </div>
            <div className="text-xxs text-muted-foreground">
              <span className="font-medium">Type:</span> {getMessageTypeLabel(config.messageType)}
            </div>
          </div>
        </div>
      </div>
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
});

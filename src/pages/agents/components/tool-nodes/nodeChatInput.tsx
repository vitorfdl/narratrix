import { useReactFlow } from "@xyflow/react";
import { MessageSquare, User } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { NodeBase, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

const executeChatInputNode: NodeExecutor = async (_node, _inputs, context): Promise<NodeExecutionResult> => {
  const workflowInput = context.nodeValues.get("workflow-input") || "";
  return { success: true, value: workflowInput };
};

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------
export interface ChatInputNodeConfig {
  name: string;
}

/**
 * UI and Node Configuration
 */
const CHAT_INPUT_NODE_METADATA = {
  type: "chatInput",
  label: "Chat Input",
  category: "Chat",
  description: "User input entry point for the conversation flow",
  icon: MessageSquare,
  theme: createNodeTheme("blue"),
  deletable: true,
  inputs: [],
  outputs: [{ id: "message", label: "Message", edgeType: "string" as const }] as NodeOutput[],
  defaultConfig: {
    name: "Chat Input",
  } as ChatInputNodeConfig,
};

// Configuration provider namespace
namespace ChatInputNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: CHAT_INPUT_NODE_METADATA.label,
      config: CHAT_INPUT_NODE_METADATA.defaultConfig,
    };
  }
}

// ---------------------------------------------------------------------------
// Config dialog
// ---------------------------------------------------------------------------
interface ChatInputNodeConfigDialogProps {
  open: boolean;
  initialConfig: ChatInputNodeConfig;
  onSave: (config: ChatInputNodeConfig) => void;
  onCancel: () => void;
}

const ChatInputNodeConfigDialog: React.FC<ChatInputNodeConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = useForm<ChatInputNodeConfig>({
    defaultValues: initialConfig,
    mode: "onChange",
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset(initialConfig);
    }
  }, [open, reset]);

  const onSubmit = (data: ChatInputNodeConfig) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Chat Input</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4 py-2">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Node Name</label>
                <Controller name="name" control={control} render={({ field }) => <Input {...field} placeholder="Enter node name" className="text-xs" maxLength={64} autoFocus />} />
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
const ChatInputContent = memo<{ onConfigure: () => void }>(({ onConfigure }) => {
  return (
    <div className="space-y-3 w-full">
      <NodeField
        label="Input Type"
        icon={MessageSquare}
        action={<NodeConfigButton onClick={onConfigure} title="Configure input settings" />}
        helpText="Receives the user's message text as input to the workflow."
      >
        <NodeConfigPreview variant="badge">
          <User className="h-3 w-3 text-primary" />
          <span className="text-xs text-muted-foreground font-medium">User Message</span>
        </NodeConfigPreview>
      </NodeField>
    </div>
  );
});

ChatInputContent.displayName = "ChatInputContent";

/**
 * ChatInputNode: Represents user input in the conversation flow
 * This node outputs the user's message to be processed by other nodes
 */
export const ChatInputNode = memo(({ data, selected, id }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || CHAT_INPUT_NODE_METADATA.defaultConfig) as ChatInputNodeConfig;

  const handleConfigSave = useCallback(
    (newConfig: ChatInputNodeConfig) => {
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes],
  );

  const handleConfigure = useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <ChatInputContent onConfigure={handleConfigure} />
      </NodeBase>

      <ChatInputNodeConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

ChatInputNode.displayName = "ChatInputNode";

// Register the node
// NodeRegistry.register({
//   metadata: CHAT_INPUT_NODE_METADATA,
//   component: ChatInputNode,
//   configProvider: ChatInputNodeConfigProvider,
//   executor: executeChatInputNode,
// });

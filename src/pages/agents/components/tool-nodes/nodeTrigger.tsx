import { useReactFlow } from "@xyflow/react";
import { Zap } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgentTriggerType, TriggerContext } from "@/schema/agent-schema";
import type { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { NodeBase, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

export interface TriggerNodeConfig {
  triggerType: AgentTriggerType;
  messageCount?: number;
}

const TRIGGER_TYPE_LABELS: Record<AgentTriggerType, string> = {
  manual: "Manual",
  after_user_message: "After User Message",
  before_user_message: "Before User Message",
  after_character_message: "After Character Message",
  before_character_message: "Before Character Message",
  after_any_message: "After Any Message",
  before_any_message: "Before Any Message",
  after_all_participants: "After All Participants",
  every_x_messages: "Every X Messages",
};

/**
 * Per-trigger output handles.
 *
 * All triggers expose `out-participant` whose value depends on trigger type:
 * - character/any triggers: the triggering character's participant ID
 * - user triggers: the user's persona character ID (may be empty if no persona set)
 * - manual / every_x_messages: the agent's own participant ID
 * - after_all_participants: no participant output (round is complete)
 *
 * Additionally all triggers expose `out-chat-id` for nodes that need the chat ID.
 */
const PARTICIPANT_OUTPUT: NodeOutput[] = [
  { id: "out-participant", label: "Participant ID", edgeType: "string" },
  { id: "out-chat-id", label: "Chat ID", edgeType: "string" },
];

const USER_OUTPUT: NodeOutput[] = [
  { id: "out-participant", label: "Character ID", edgeType: "string" },
  { id: "out-chat-id", label: "Chat ID", edgeType: "string" },
];

const TRIGGER_OUTPUT_MAP: Record<AgentTriggerType, NodeOutput[]> = {
  manual: PARTICIPANT_OUTPUT,
  after_user_message: USER_OUTPUT,
  before_user_message: USER_OUTPUT,
  after_character_message: PARTICIPANT_OUTPUT,
  before_character_message: PARTICIPANT_OUTPUT,
  after_any_message: PARTICIPANT_OUTPUT,
  before_any_message: PARTICIPANT_OUTPUT,
  // "After all participants" means the round is complete — no specific participant is relevant
  after_all_participants: [{ id: "out-chat-id", label: "Chat ID", edgeType: "string" }],
  every_x_messages: PARTICIPANT_OUTPUT,
};

/**
 * Node Execution — reads TriggerContext injected by the runner and populates
 * handle-scoped outputs for downstream nodes.
 */
const executeTriggerNode: NodeExecutor = async (node, _inputs, context): Promise<NodeExecutionResult> => {
  const triggerCtx = context.nodeValues.get("workflow-trigger-context") as TriggerContext | undefined;

  // participantId: for character/any triggers use the triggering character;
  // for user triggers use the user's persona character ID;
  // for manual/every_x fall back to the agent's own ID stored in participantId.
  const participantId = triggerCtx?.participantId ?? "";
  const chatId = triggerCtx?.chatId ?? "";

  context.nodeValues.set(`${node.id}::out-participant`, participantId);
  context.nodeValues.set(`${node.id}::out-chat-id`, chatId);

  return { success: true, value: participantId };
};

/**
 * UI and Node Configuration
 */
const TRIGGER_NODE_METADATA = {
  type: "trigger",
  label: "Trigger",
  category: "Trigger",
  description: "Defines when this workflow fires. Connect outputs to downstream nodes.",
  icon: Zap,
  theme: createNodeTheme("red"),
  deletable: true,
  inputs: [],
  // Outputs are dynamic — NodeBase reads from data.dynamicOutputs at runtime.
  outputs: [] as NodeOutput[],
  defaultConfig: {
    triggerType: "manual" as AgentTriggerType,
  } as TriggerNodeConfig,
};

namespace TriggerNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: TRIGGER_NODE_METADATA.label,
      config: TRIGGER_NODE_METADATA.defaultConfig,
    };
  }
}

// ─── Config Dialog ────────────────────────────────────────────────────────────

interface TriggerConfigDialogProps {
  open: boolean;
  initialConfig: TriggerNodeConfig;
  onSave: (config: TriggerNodeConfig) => void;
  onCancel: () => void;
}

const TriggerConfigDialog: React.FC<TriggerConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch } = useForm<TriggerNodeConfig>({
    defaultValues: { messageCount: 5, ...initialConfig },
    mode: "onChange",
  });

  useEffect(() => {
    if (open) {
      reset(initialConfig);
    }
  }, [open, reset, initialConfig]);

  const selectedType = watch("triggerType");
  const onSubmit = (data: TriggerNodeConfig) => onSave(data);

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Trigger</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-medium text-foreground mb-1 block">Trigger Type</Label>
                <Controller
                  name="triggerType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select trigger type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(TRIGGER_TYPE_LABELS) as [AgentTriggerType, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value} className="text-xs">
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {selectedType === "every_x_messages" && (
                <div>
                  <Label className="text-xs font-medium text-foreground mb-1 block">Message Count</Label>
                  <Controller
                    name="messageCount"
                    control={control}
                    rules={{ min: 1 }}
                    render={({ field }) => <Input type="number" min={1} className="text-xs h-8" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))} />}
                  />
                  <p className="text-xxs text-muted-foreground mt-1">Trigger after every N messages in the chat.</p>
                </div>
              )}

              <div className="p-2 bg-muted/40 rounded-md text-xxs text-muted-foreground">
                {selectedType === "manual" &&
                  "Workflow only runs when manually triggered via the play button in the participants panel, or at its position in the participant order when the user sends a message. Participant ID outputs the agent's own ID."}
                {selectedType === "after_user_message" &&
                  "Workflow runs after the user message is created, before any character responds. Participant ID outputs the user's persona character ID (empty if no persona is set)."}
                {selectedType === "before_user_message" &&
                  "Workflow runs before the user message is created, blocking generation until it completes. Participant ID outputs the user's persona character ID."}
                {selectedType === "after_character_message" && "Workflow runs after a character generates a message, in participant order. Participant ID outputs the triggering character's ID."}
                {selectedType === "before_character_message" &&
                  "Workflow runs before a character generates a message, blocking that character's generation until it completes. Participant ID outputs the character's ID."}
                {selectedType === "after_any_message" &&
                  "Workflow runs after any user or character message. Participant ID outputs the triggering participant's ID. Agents never trigger other agents."}
                {selectedType === "before_any_message" &&
                  "Workflow runs before any user or character message, blocking generation until it completes. Participant ID outputs the triggering participant's ID."}
                {selectedType === "after_all_participants" && "Workflow runs after all enabled participants have generated their messages for the round. Only triggered from normal user message flow."}
                {selectedType === "every_x_messages" && "Workflow fires automatically after every N messages added to the chat. Participant ID outputs the agent's own ID."}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} size="dialog">
              Cancel
            </Button>
            <Button type="submit" size="dialog">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Content ──────────────────────────────────────────────────────────────────

const TriggerContent = memo<{ config: TriggerNodeConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  const label = TRIGGER_TYPE_LABELS[config.triggerType] ?? "Manual";

  return (
    <div className="space-y-2 w-full">
      <NodeField label="Trigger When" icon={Zap} action={<NodeConfigButton onClick={onConfigure} title="Configure trigger" />}>
        <NodeConfigPreview variant="text">
          {label}
          {config.triggerType === "every_x_messages" && config.messageCount && <span className="text-xxs text-muted-foreground ml-auto flex-shrink-0">×{config.messageCount}</span>}
        </NodeConfigPreview>
      </NodeField>
    </div>
  );
});

TriggerContent.displayName = "TriggerContent";

// ─── Node Component ───────────────────────────────────────────────────────────

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const config = (data.config || TRIGGER_NODE_METADATA.defaultConfig) as TriggerNodeConfig;
  const { setNodes, setEdges } = useReactFlow();

  const handleConfigSave = useCallback(
    (newConfig: TriggerNodeConfig) => {
      const newOutputs = TRIGGER_OUTPUT_MAP[newConfig.triggerType] ?? [];
      const oldOutputs = TRIGGER_OUTPUT_MAP[config.triggerType] ?? [];

      // Remove edges connected to handles that no longer exist
      const removedHandleIds = new Set(oldOutputs.filter((o) => !newOutputs.some((n) => n.id === o.id)).map((o) => o.id));

      if (removedHandleIds.size > 0) {
        setEdges((edges) => edges.filter((edge) => !(edge.source === id && removedHandleIds.has(edge.sourceHandle ?? ""))));
      }

      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig, dynamicOutputs: newOutputs } } : node)));
      setConfigDialogOpen(false);
    },
    [id, config.triggerType, setNodes, setEdges],
  );

  const handleConfigure = useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setConfigDialogOpen(false);
  }, []);

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <TriggerContent config={config} onConfigure={handleConfigure} />
      </NodeBase>
      <TriggerConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={handleCancel} />
    </>
  );
});

TriggerNode.displayName = "TriggerNode";

// ─── Registration ─────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: TRIGGER_NODE_METADATA,
  component: TriggerNode,
  configProvider: TriggerNodeConfigProvider,
  executor: executeTriggerNode,
  getDynamicOutputs: (config) => {
    const triggerConfig = config as TriggerNodeConfig;
    return TRIGGER_OUTPUT_MAP[triggerConfig?.triggerType] ?? PARTICIPANT_OUTPUT;
  },
});

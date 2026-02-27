import { useReactFlow } from "@xyflow/react";
import { Zap } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

type TriggerTiming = "before" | "after" | "manual" | "interval" | "round";

interface TriggerTypeConfig {
  label: string;
  description: string;
  timing: TriggerTiming;
}

const TRIGGER_TYPE_CONFIG: Record<AgentTriggerType, TriggerTypeConfig> = {
  manual: {
    label: "Manual",
    description: "Runs only when triggered from the participants panel, or when reached in participant order. Participant ID outputs the agent's own ID.",
    timing: "manual",
  },
  after_user_message: {
    label: "After User Message",
    description: "Fires after the user submits a message, before any character responds. Participant ID outputs the user's persona character ID.",
    timing: "after",
  },
  before_user_message: {
    label: "Before User Message",
    description: "Fires before the user's message is created, blocking the chat until this workflow completes. Participant ID outputs the user's persona character ID.",
    timing: "before",
  },
  after_character_message: {
    label: "After Character Message",
    description: "Fires each time a character finishes generating a response, in participant order. Participant ID outputs the triggering character's ID.",
    timing: "after",
  },
  before_character_message: {
    label: "Before Character Message",
    description: "Fires before a character begins generating, blocking that character's response until complete. Participant ID outputs the character's ID.",
    timing: "before",
  },
  after_any_message: {
    label: "After Any Message",
    description: "Fires after any user or character message is created. Agent workflows never trigger other agents. Participant ID outputs the triggering participant's ID.",
    timing: "after",
  },
  before_any_message: {
    label: "Before Any Message",
    description: "Fires before any user or character message, blocking generation until complete. Participant ID outputs the triggering participant's ID.",
    timing: "before",
  },
  after_all_participants: {
    label: "After All Participants",
    description: "Fires once all enabled participants have completed their messages for the round. Only triggered from normal user message flow.",
    timing: "round",
  },
  every_x_messages: {
    label: "Every X Messages",
    description: "Fires automatically after every N messages are added to the chat, regardless of who sent them. Participant ID outputs the agent's own ID.",
    timing: "interval",
  },
};

const TRIGGER_GROUPS: { label: string; items: AgentTriggerType[] }[] = [
  { label: "User Messages", items: ["after_user_message", "before_user_message"] },
  { label: "Character Messages", items: ["after_character_message", "before_character_message"] },
  { label: "Any Message", items: ["after_any_message", "before_any_message"] },
  { label: "Flow Control", items: ["manual", "after_all_participants", "every_x_messages"] },
];

const TIMING_STYLES: Record<TriggerTiming, { label: string; className: string }> = {
  before: { label: "Before", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  after: { label: "After", className: "bg-green-500/15 text-green-600 dark:text-green-400" },
  manual: { label: "Manual", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  interval: { label: "Interval", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  round: { label: "Round End", className: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
};

const TimingBadge = ({ timing }: { timing: TriggerTiming }) => {
  const style = TIMING_STYLES[timing];
  return <span className={cn("shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold leading-none", style.className)}>{style.label}</span>;
};

interface TriggerConfigDialogProps {
  open: boolean;
  initialConfig: TriggerNodeConfig;
  onSave: (config: TriggerNodeConfig) => void;
  onCancel: () => void;
}

const TriggerConfigDialog: React.FC<TriggerConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset } = useForm<TriggerNodeConfig>({
    defaultValues: { messageCount: 5, ...initialConfig },
    mode: "onChange",
  });

  useEffect(() => {
    if (open) {
      reset({ messageCount: 5, ...initialConfig });
    }
  }, [open, reset, initialConfig]);

  const onSubmit = (data: TriggerNodeConfig) => onSave(data);

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Trigger</DialogTitle>
          </DialogHeader>
          <DialogBody className="py-4">
            <Controller
              name="triggerType"
              control={control}
              render={({ field }) => (
                <div className="space-y-3 py-1">
                  {TRIGGER_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{group.label}</p>
                      <div className="space-y-1">
                        {group.items.map((value) => {
                          const cfg = TRIGGER_TYPE_CONFIG[value];
                          const isSelected = field.value === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => field.onChange(value)}
                              className={cn(
                                "w-full rounded-md border px-3 py-2 text-left transition-colors",
                                isSelected ? "border-primary/40 bg-primary/5" : "border-border/40 hover:border-border/70 hover:bg-muted/40",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <TimingBadge timing={cfg.timing} />
                                <span className="text-xs font-medium">{cfg.label}</span>
                              </div>
                              <p className="mt-0.5 text-xxs leading-relaxed text-muted-foreground">{cfg.description}</p>
                              {value === "every_x_messages" && isSelected && (
                                <div className="mt-2 border-t border-border/30 pt-2">
                                  <div className="flex w-fit items-center gap-2">
                                    <Controller
                                      name="messageCount"
                                      control={control}
                                      rules={{ min: 1 }}
                                      render={({ field }) => (
                                        <Input
                                          type="number"
                                          min={1}
                                          className="h-7 w-16 text-xs"
                                          value={field.value}
                                          onChange={(e) => field.onChange(Number(e.target.value))}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      )}
                                    />
                                    <span className="whitespace-nowrap text-xxs text-muted-foreground">messages between each trigger</span>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            />
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

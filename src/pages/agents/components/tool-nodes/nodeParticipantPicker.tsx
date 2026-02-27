import { useReactFlow } from "@xyflow/react";
import { Settings, Users } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { useCharacterStore } from "@/hooks/characterStore";
import { useChatStore } from "@/hooks/chatStore";
import { cn } from "@/lib/utils";
import { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { NodeBase, NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

type ParticipantPickerMode = "user" | "lastMessageCharacter" | "prevCharacter" | "nextCharacter";

interface ParticipantPickerConfig {
  name: string;
  mode: ParticipantPickerMode;
}

/**
 * Node Execution
 */
function pickFromParticipants(mode: ParticipantPickerMode, agentId: string | undefined): string | null {
  const store = useChatStore.getState();
  const participants = store.selectedChat?.participants || [];
  const characters = useCharacterStore.getState().characters;
  const isCharacterId = (id: string) => characters.some((c) => c.id === id);

  if (!participants.length) {
    return null;
  }

  if (mode === "prevCharacter" || mode === "nextCharacter") {
    const agentIndex = agentId ? participants.findIndex((p) => p.id === agentId) : -1;
    if (agentIndex === -1) {
      // fall back to last/next in full list if agent not present
      if (mode === "prevCharacter") {
        for (let i = participants.length - 1; i >= 0; i--) {
          if (isCharacterId(participants[i].id)) {
            return participants[i].id;
          }
        }
      } else {
        for (let i = 0; i < participants.length; i++) {
          if (isCharacterId(participants[i].id)) {
            return participants[i].id;
          }
        }
      }
      return null;
    }

    if (mode === "prevCharacter") {
      for (let i = agentIndex - 1; i >= 0; i--) {
        if (isCharacterId(participants[i].id)) {
          return participants[i].id;
        }
      }
      return null;
    }

    for (let i = agentIndex + 1; i < participants.length; i++) {
      if (isCharacterId(participants[i].id)) {
        return participants[i].id;
      }
    }
    return null;
  }

  if (mode === "lastMessageCharacter") {
    const messages = store.selectedChatMessages || [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "character" && m.character_id) {
        return m.character_id;
      }
    }
    return null;
  }

  if (mode === "user") {
    return "user";
  }

  return null;
}

const executeParticipantPickerNode: NodeExecutor = async (node, _inputs, _ctx, agent): Promise<NodeExecutionResult> => {
  try {
    const cfg = (node.config as ParticipantPickerConfig) || {};
    const mode = (cfg.mode as ParticipantPickerMode) || "user";
    const picked = pickFromParticipants(mode, agent?.id);
    if (!picked) {
      return { success: false, error: "No participant could be selected" };
    }
    return { success: true, value: picked };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Participant picker failed";
    return { success: false, error: message };
  }
};

/**
 * UI and Node Configuration
 */

const PARTICIPANT_PICKER_NODE_METADATA = {
  type: "participantPicker",
  label: "Participant",
  category: "Chat",
  description: "Selects a participant (user/character) for downstream nodes",
  icon: Settings,
  theme: createNodeTheme("indigo"),
  deletable: true,
  inputs: [],
  outputs: [{ id: "out-participant", label: "Participant ID", edgeType: "string" as const }] as NodeOutput[],
  defaultConfig: {
    name: "Participant",
    mode: "user" as ParticipantPickerMode,
  } as ParticipantPickerConfig,
};

namespace ParticipantPickerConfigProvider {
  export function getDefaultConfig() {
    return {
      label: PARTICIPANT_PICKER_NODE_METADATA.label,
      config: PARTICIPANT_PICKER_NODE_METADATA.defaultConfig,
    };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface PickerModeConfig {
  label: string;
  description: string;
  badge: string;
  badgeClass: string;
}

const PICKER_MODE_CONFIG: Record<ParticipantPickerMode, PickerModeConfig> = {
  user: {
    label: "User",
    description: "Outputs the user participant's ID. Use when you need to address or reference the person sending messages.",
    badge: "User",
    badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  lastMessageCharacter: {
    label: "Last Character to Message",
    description: "Outputs the ID of the character who most recently sent a message in the chat history.",
    badge: "History",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  prevCharacter: {
    label: "Previous Character",
    description: "Outputs the ID of the nearest character that appears before this agent in the participant order.",
    badge: "Prev",
    badgeClass: "bg-green-500/15 text-green-600 dark:text-green-400",
  },
  nextCharacter: {
    label: "Next Character",
    description: "Outputs the ID of the nearest character that appears after this agent in the participant order.",
    badge: "Next",
    badgeClass: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  },
};

const PICKER_GROUPS: { label: string; items: ParticipantPickerMode[] }[] = [
  { label: "Fixed", items: ["user"] },
  { label: "Relative", items: ["lastMessageCharacter", "prevCharacter", "nextCharacter"] },
];

export interface ParticipantPickerConfigDialogProps {
  open: boolean;
  initialConfig: ParticipantPickerConfig;
  onSave: (config: ParticipantPickerConfig) => void;
  onCancel: () => void;
}

const ParticipantPickerConfigDialog: React.FC<ParticipantPickerConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset } = useForm<ParticipantPickerConfig>({ defaultValues: initialConfig, mode: "onChange" });

  useEffect(() => {
    if (open) {
      reset(initialConfig);
    }
  }, [open, reset, initialConfig]);

  const onSubmit = (data: ParticipantPickerConfig) => onSave(data);

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Participant Picker</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Controller
              name="mode"
              control={control}
              render={({ field }) => (
                <div className="space-y-3 py-1">
                  {PICKER_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                      <div className="space-y-1">
                        {group.items.map((value) => {
                          const cfg = PICKER_MODE_CONFIG[value];
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
                                <span className={cn("shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold leading-none", cfg.badgeClass)}>{cfg.badge}</span>
                                <span className="text-xs font-medium">{cfg.label}</span>
                              </div>
                              <p className="mt-0.5 text-xxs leading-relaxed text-muted-foreground">{cfg.description}</p>
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

const ParticipantPickerContent = memo<{ config: ParticipantPickerConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  const renderMode = (mode: ParticipantPickerMode) => {
    switch (mode) {
      case "user":
        return "Pick User";
      case "lastMessageCharacter":
        return "Last Character (from message)";
      case "prevCharacter":
        return "Previous Character (before agent)";
      case "nextCharacter":
        return "Next Character (after agent)";
      default:
        return "Pick User";
    }
  };

  return (
    <div className="space-y-3 w-full">
      <NodeField
        label="Selection Mode"
        icon={Users}
        action={<NodeConfigButton onClick={onConfigure} title="Configure picker settings" />}
        helpText="Determines which participant's ID is output from this node."
      >
        <NodeConfigPreview variant="text">{renderMode(config.mode)}</NodeConfigPreview>
      </NodeField>
    </div>
  );
});

ParticipantPickerContent.displayName = "ParticipantPickerContent";

export const ParticipantPickerNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const config = (data.config || PARTICIPANT_PICKER_NODE_METADATA.defaultConfig) as ParticipantPickerConfig;
  const { setNodes } = useReactFlow();

  const handleConfigSave = useCallback(
    (newConfig: ParticipantPickerConfig) => {
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
        <ParticipantPickerContent config={config} onConfigure={handleConfigure} />
      </NodeBase>

      <ParticipantPickerConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={handleConfigCancel} />
    </>
  );
});

ParticipantPickerNode.displayName = "ParticipantPickerNode";

NodeRegistry.register({
  metadata: PARTICIPANT_PICKER_NODE_METADATA,
  component: ParticipantPickerNode,
  configProvider: ParticipantPickerConfigProvider,
  executor: executeParticipantPickerNode,
});

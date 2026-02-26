import { useReactFlow } from "@xyflow/react";
import { Settings } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCharacterStore } from "@/hooks/characterStore";
import { useChatStore } from "@/hooks/chatStore";
import { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { NodeBase, NodeOutput, stopNodeEventPropagation, useNodeRef } from "../tool-components/NodeBase";
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

export interface ParticipantPickerConfigDialogProps {
  open: boolean;
  initialConfig: ParticipantPickerConfig;
  onSave: (config: ParticipantPickerConfig) => void;
  onCancel: () => void;
}

const ParticipantPickerConfigDialog: React.FC<ParticipantPickerConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, formState } = useForm<ParticipantPickerConfig>({ defaultValues: initialConfig, mode: "onChange" });

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
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-medium text-foreground mb-1 block">Mode</Label>
                <Controller
                  name="mode"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select participant mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Pick User</SelectItem>
                        <SelectItem value="lastMessageCharacter">Pick Last Character from message</SelectItem>
                        <SelectItem value="prevCharacter">Pick Last character (before agent)</SelectItem>
                        <SelectItem value="nextCharacter">Pick Next character (after agent)</SelectItem>
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
            <Button type="submit" size="dialog" disabled={!formState.isDirty && !formState.isValid}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ParticipantPickerContent = memo<{ config: ParticipantPickerConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  const registerElementRef = useNodeRef();

  const handleConfigureClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onConfigure();
    },
    [onConfigure],
  );

  const renderMode = (mode: ParticipantPickerMode) => {
    switch (mode) {
      case "user":
        return "Pick User";
      case "lastMessageCharacter":
        return "Pick Last Character from message";
      case "prevCharacter":
        return "Pick Last character (before agent)";
      case "nextCharacter":
        return "Pick Next character (after agent)";
      default:
        return "Pick User";
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="space-y-2" ref={(el) => registerElementRef?.("out-section", el)}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Participant Selection</label>
          <Button variant="ghost" size="sm" className="nodrag h-6 w-6 p-0 hover:bg-primary/10" onClick={handleConfigureClick} onPointerDown={stopNodeEventPropagation} title="Configure picker settings">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
        <div className="p-2 bg-muted/50 rounded-md border-l-2 border-indigo-400 dark:border-indigo-500">
          <span className="text-xxs text-muted-foreground">{renderMode(config.mode)}</span>
        </div>
      </div>
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

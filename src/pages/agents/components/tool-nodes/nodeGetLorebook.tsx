import { useReactFlow } from "@xyflow/react";
import { BookOpen, ChevronDown, User } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { useCharacterStore } from "@/hooks/characterStore";
import { useLorebooks } from "@/hooks/lorebookStore";
import type { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

type GetLorebookSource = "character" | "direct";

export interface GetLorebookNodeConfig {
  source: GetLorebookSource;
  lorebookId?: string;
}

const DEFAULT_CONFIG: GetLorebookNodeConfig = {
  source: "character",
};

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeGetLorebookNode: NodeExecutor = async (node, inputs): Promise<NodeExecutionResult> => {
  const cfg = (node.config || DEFAULT_CONFIG) as GetLorebookNodeConfig;
  const source = cfg.source ?? "character";

  if (source === "direct") {
    const lorebookId = cfg.lorebookId;
    if (!lorebookId) {
      return { success: false, error: "Get Lorebook node has no lorebook selected" };
    }
    return { success: true, value: lorebookId };
  }

  const characterId = typeof inputs.characterId === "string" ? inputs.characterId : undefined;

  if (!characterId) {
    return { success: false, error: "Get Lorebook node requires a Character ID input" };
  }

  try {
    const characters = useCharacterStore.getState().characters;
    const character = characters.find((c) => c.id === characterId);

    if (!character) {
      return { success: false, error: `Character not found: ${characterId}` };
    }

    if (!character.lorebook_id) {
      return { success: false, error: `Character "${character.name}" has no lorebook attached` };
    }

    return { success: true, value: character.lorebook_id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to resolve lorebook";
    return { success: false, error: message };
  }
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const GET_LOREBOOK_NODE_METADATA = {
  type: "getLorebook",
  label: "Get Lorebook",
  category: "Lorebook",
  description: "Resolves a lorebook by character or by direct selection",
  icon: BookOpen,
  theme: createNodeTheme("orange"),
  deletable: true,
  inputs: [{ id: "in-character", label: "Character ID", edgeType: "string" as const, targetRef: "character-section" }] as NodeInput[],
  outputs: [{ id: "out-lorebook-id", label: "Lorebook ID", edgeType: "string" as const }] as NodeOutput[],
  defaultConfig: DEFAULT_CONFIG,
};

namespace GetLorebookNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: GET_LOREBOOK_NODE_METADATA.label,
      config: GET_LOREBOOK_NODE_METADATA.defaultConfig,
    };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface GetLorebookConfigDialogProps {
  open: boolean;
  initialConfig: GetLorebookNodeConfig;
  onSave: (config: GetLorebookNodeConfig) => void;
  onCancel: () => void;
}

const GetLorebookConfigDialog: React.FC<GetLorebookConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const lorebooks = useLorebooks();
  const { control, handleSubmit, reset, watch } = useForm<GetLorebookNodeConfig>({
    defaultValues: { ...DEFAULT_CONFIG, ...initialConfig },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset]);

  const currentSource = watch("source");

  const lorebookItems: ComboboxItem[] = useMemo(
    () =>
      lorebooks
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((lb) => ({ value: lb.id, label: lb.name })),
    [lorebooks],
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Configure Get Lorebook
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Source</Label>
                <Controller
                  name="source"
                  control={control}
                  render={({ field }) => (
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => field.onChange("character")}
                        className={`px-4 py-1.5 text-xs font-medium transition-colors ${field.value === "character" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        From Character
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("direct")}
                        className={`px-4 py-1.5 text-xs font-medium border-l border-border transition-colors ${field.value === "direct" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        Pick Lorebook
                      </button>
                    </div>
                  )}
                />
                <p className="text-xxs text-muted-foreground mt-1.5">
                  {currentSource === "direct" ? "Output a fixed lorebook chosen here. The Character ID input is ignored." : "Resolve the lorebook attached to the connected character."}
                </p>
              </div>

              {currentSource === "direct" && (
                <div>
                  <Label className="text-xs font-medium mb-1 block">Lorebook</Label>
                  <Controller
                    name="lorebookId"
                    control={control}
                    render={({ field }) => {
                      const selected = lorebooks.find((lb) => lb.id === field.value);
                      return (
                        <Combobox
                          items={lorebookItems}
                          selectedValue={field.value ?? null}
                          onChange={(value) => field.onChange(value ?? undefined)}
                          placeholder="Search a lorebook..."
                          clearable
                          trigger={
                            <Button type="button" variant="outline" className="w-full justify-between text-xs px-2 h-8">
                              <span className="truncate">{selected ? selected.name : lorebookItems.length ? "Select a lorebook..." : "No lorebooks available"}</span>
                              <ChevronDown className="ml-auto !h-3 !w-3" />
                            </Button>
                          }
                        />
                      );
                    }}
                  />
                </div>
              )}
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

// ─── Content ───────────────────────────────────────────────────────────────────

const GetLorebookContent = memo<{ config: GetLorebookNodeConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  const lorebooks = useLorebooks();
  const isDirect = config.source === "direct";
  const selectedName = isDirect ? lorebooks.find((lb) => lb.id === config.lorebookId)?.name : undefined;

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase bg-orange-400/10 text-orange-600 dark:text-orange-400">
          {isDirect ? "Direct" : "From Character"}
        </span>
        <NodeConfigButton onClick={onConfigure} title="Configure lorebook source" />
      </div>

      {isDirect ? (
        <NodeField label="Lorebook" icon={BookOpen} helpText="The lorebook ID this node will output.">
          <NodeConfigPreview variant="text" empty="No lorebook selected">
            {selectedName ?? (config.lorebookId ? config.lorebookId : undefined)}
          </NodeConfigPreview>
        </NodeField>
      ) : (
        <NodeField label="Character ID" icon={User} refId="character-section" helpText="Connect a Participant Picker or Trigger output to resolve the character's lorebook." />
      )}
    </div>
  );
});

GetLorebookContent.displayName = "GetLorebookContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const GetLorebookNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes, setEdges } = useReactFlow();
  const config = (data.config || DEFAULT_CONFIG) as GetLorebookNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: GetLorebookNodeConfig) => {
      takeSnapshot();
      if (newConfig.source === "direct") {
        setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.targetHandle === "in-character")));
      }
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes, setEdges, takeSnapshot],
  );

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <GetLorebookContent config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <GetLorebookConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

GetLorebookNode.displayName = "GetLorebookNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: GET_LOREBOOK_NODE_METADATA,
  component: GetLorebookNode,
  configProvider: GetLorebookNodeConfigProvider,
  executor: executeGetLorebookNode,
});

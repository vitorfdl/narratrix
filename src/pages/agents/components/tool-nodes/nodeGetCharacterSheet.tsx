import { useReactFlow } from "@xyflow/react";
import { ChevronDown, MessageSquareMore, ScrollText, Type, UserRound } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCharacterStore } from "@/hooks/characterStore";
import type { NodeExecutionResult, NodeExecutor, WorkflowToolDefinition } from "@/services/agent-workflow/types";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { buildGetSheetToolSchema, listSheetTargets, readCharacterSheet } from "./character-sheet-tools";
import type { NodeProps } from "./nodeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GetCharacterSheetNodeConfig {
  mode: "script" | "tool";
  toolName: string;
  toolDescription: string;
  /** Lock to one character. Empty: script mode reads the only sheet-bearing participant, tool mode lets the model choose. */
  characterId: string;
  includeUserCharacter: boolean;
}

export const GET_CHARACTER_SHEET_TOOL_DESCRIPTION = "Read a chat participant's character sheet: its field keys, types, allowed values and current values, plus a markdown rendering.";

const DEFAULT_CONFIG: GetCharacterSheetNodeConfig = {
  mode: "script",
  toolName: "getCharacterSheet",
  toolDescription: GET_CHARACTER_SHEET_TOOL_DESCRIPTION,
  characterId: "",
  includeUserCharacter: true,
};

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeGetCharacterSheetNode: NodeExecutor = async (node, _inputs, context, agent, deps): Promise<NodeExecutionResult> => {
  const cfg = { ...DEFAULT_CONFIG, ...(node.config as Partial<GetCharacterSheetNodeConfig> | undefined) };
  const opts = { characterId: cfg.characterId || undefined, includeUserCharacter: cfg.includeUserCharacter };

  const outgoing = agent.edges.filter((e) => e.source === node.id);
  const wantTool = cfg.mode === "tool" || outgoing.some((e) => e.sourceHandle === "out-toolset");
  const wantText = cfg.mode === "script" || outgoing.some((e) => e.sourceHandle === "out-string");

  if (wantTool && !wantText) {
    const targets = await listSheetTargets(context, deps, opts);
    const tool: WorkflowToolDefinition = {
      name: cfg.toolName || DEFAULT_CONFIG.toolName,
      description: cfg.toolDescription || DEFAULT_CONFIG.toolDescription,
      inputSchema: buildGetSheetToolSchema(targets, !!opts.characterId),
      invoke: async (args: { character?: unknown }) => readCharacterSheet(context, deps, opts, typeof args?.character === "string" ? args.character : undefined),
    };
    context.nodeValues.set(`${node.id}::out-toolset`, [tool]);
    return { success: true, value: [tool] };
  }

  return { success: true, value: await readCharacterSheet(context, deps, opts) };
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-string", label: "Sheet (JSON)", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const GET_CHARACTER_SHEET_NODE_METADATA = {
  type: "getCharacterSheet",
  label: "Get Character Sheet",
  description: "Read a participant's character sheet (fields, allowed values, current values) — usable as a tool or in a workflow",
  icon: ScrollText,
  category: "Chat",
  theme: createNodeTheme("teal"),
  deletable: true,
  inputs: [] as NodeInput[],
  outputs: SCRIPT_OUTPUTS,
  defaultConfig: DEFAULT_CONFIG,
};

function getOutputsForMode(mode?: "script" | "tool"): NodeOutput[] {
  return mode === "tool" ? TOOL_OUTPUTS : SCRIPT_OUTPUTS;
}

namespace GetCharacterSheetNodeConfigProvider {
  export function getDefaultConfig() {
    return { label: GET_CHARACTER_SHEET_NODE_METADATA.label, config: GET_CHARACTER_SHEET_NODE_METADATA.defaultConfig };
  }
}

// ─── Shared dialog pieces ──────────────────────────────────────────────────────

export function useSheetCharacterItems(): ComboboxItem[] {
  const characters = useCharacterStore((state) => state.characters);
  return useMemo(
    () =>
      characters
        .filter((character) => character.type === "character" && !!character.custom?.sheet_template_id)
        .map((character) => ({ value: character.id, label: character.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [characters],
  );
}

export function SheetCharacterPicker({ value, onChange, items, hint }: { value: string; onChange: (value: string) => void; items: ComboboxItem[]; hint: string }) {
  const selected = items.find((item) => item.value === value);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Label className="text-xs font-medium">Character</Label>
        <HelpTooltip>{hint}</HelpTooltip>
      </div>
      <Combobox
        items={items}
        selectedValue={value || null}
        onChange={(next) => onChange(next ?? "")}
        placeholder="Search a character..."
        clearable
        trigger={
          <Button type="button" variant="outline" className="w-full justify-between text-xs px-2 h-8">
            <span className="truncate">{selected ? selected.label : items.length ? "Any character in the chat" : "No characters have a sheet yet"}</span>
            <ChevronDown className="ml-auto !h-3 !w-3" />
          </Button>
        }
      />
    </div>
  );
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface ConfigDialogProps {
  open: boolean;
  initialConfig: GetCharacterSheetNodeConfig;
  onSave: (config: GetCharacterSheetNodeConfig) => void;
  onCancel: () => void;
}

const GetCharacterSheetConfigDialog: React.FC<ConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch } = useForm<GetCharacterSheetNodeConfig>({ defaultValues: { ...DEFAULT_CONFIG, ...initialConfig } });
  const characterItems = useSheetCharacterItems();

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset]);

  const isToolMode = watch("mode") === "tool";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" />
              Configure Get Character Sheet
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">Mode</Label>
                  <HelpTooltip>
                    <p className="mb-1">
                      <span className="font-semibold">Script</span> — Outputs the sheet as JSON (field specs, values and markdown) to the next node.
                    </p>
                    <p>
                      <span className="font-semibold">Tool</span> — Exposes a callable tool. Lock a character below or let the model pick one by name.
                    </p>
                  </HelpTooltip>
                </div>
                <Controller
                  name="mode"
                  control={control}
                  render={({ field }) => (
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      {(["script", "tool"] as const).map((value, i) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                            field.value === value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {isToolMode && (
                <>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Tool Name</Label>
                    <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="getCharacterSheet" className="text-xs h-8" />} />
                    <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool. Use camelCase with no spaces.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label className="text-xs font-medium">Tool Description</Label>
                      <HelpTooltip>Sent directly to the model. Explain what the tool returns so the agent knows when to call it.</HelpTooltip>
                    </div>
                    <Controller name="toolDescription" control={control} render={({ field }) => <Textarea {...field} rows={3} className="text-xs resize-none" />} />
                  </div>
                </>
              )}

              <Controller
                name="characterId"
                control={control}
                render={({ field }) => (
                  <SheetCharacterPicker
                    value={field.value}
                    onChange={field.onChange}
                    items={characterItems}
                    hint={
                      isToolMode
                        ? "Lock the tool to this character's sheet so the model cannot read another. Leave empty to let the model pick any participant by name."
                        : "The character whose sheet is output. Leave empty to read the only participant that has a sheet."
                    }
                  />
                )}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs font-medium">Include user persona</Label>
                  <HelpTooltip>Also expose the sheet of the character the user is playing as, when it has one.</HelpTooltip>
                </div>
                <Controller name="includeUserCharacter" control={control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
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

// ─── Content ───────────────────────────────────────────────────────────────────

const GetCharacterSheetContent = memo<{ config: GetCharacterSheetNodeConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  const isToolMode = config.mode === "tool";
  const characterName = useCharacterStore((state) => state.characters.find((c) => c.id === config.characterId)?.name);

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase ${
            isToolMode ? "bg-teal-400/20 text-teal-600 dark:text-teal-300" : "bg-teal-400/10 text-teal-600 dark:text-teal-400"
          }`}
        >
          {isToolMode ? "Tool" : "Script"}
        </span>
        <NodeConfigButton onClick={onConfigure} title="Configure get character sheet" />
      </div>

      {isToolMode && (
        <>
          <NodeField label="Tool Name" icon={Type}>
            <NodeConfigPreview variant="text" empty="getCharacterSheet">
              {config.toolName || undefined}
            </NodeConfigPreview>
          </NodeField>
          <NodeField label="Description" icon={MessageSquareMore}>
            <NodeConfigPreview variant="text" empty="No description">
              {config.toolDescription || undefined}
            </NodeConfigPreview>
          </NodeField>
        </>
      )}

      <NodeField label="Character" icon={UserRound}>
        <NodeConfigPreview variant="text" empty={isToolMode ? "Model chooses" : "Only sheet in chat"}>
          {config.characterId ? (characterName ?? config.characterId) : undefined}
        </NodeConfigPreview>
      </NodeField>
    </div>
  );
});

GetCharacterSheetContent.displayName = "GetCharacterSheetContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const GetCharacterSheetNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = { ...DEFAULT_CONFIG, ...(data.config as Partial<GetCharacterSheetNodeConfig> | undefined) };
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: GetCharacterSheetNodeConfig) => {
      takeSnapshot();
      const dynamicOutputs = getOutputsForMode(newConfig.mode);
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig, dynamicOutputs } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes, takeSnapshot],
  );

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <GetCharacterSheetContent config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <GetCharacterSheetConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

GetCharacterSheetNode.displayName = "GetCharacterSheetNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: GET_CHARACTER_SHEET_NODE_METADATA,
  component: GetCharacterSheetNode,
  configProvider: GetCharacterSheetNodeConfigProvider,
  executor: executeGetCharacterSheetNode,
  getDynamicOutputs: (config) => getOutputsForMode((config as GetCharacterSheetNodeConfig)?.mode),
});

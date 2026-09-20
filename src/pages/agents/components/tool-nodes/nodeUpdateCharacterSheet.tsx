import { useReactFlow } from "@xyflow/react";
import { Database, MessageSquareMore, SquarePen, Type, UserRound } from "lucide-react";
import React, { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
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
import { buildUpdateSheetToolDescription, buildUpdateSheetToolSchema, listSheetTargets, type SheetWriteScope, updateCharacterSheet } from "./character-sheet-tools";
import { SheetCharacterPicker, useSheetCharacterItems } from "./nodeGetCharacterSheet";
import type { NodeProps } from "./nodeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UpdateCharacterSheetNodeConfig {
  mode: "tool";
  toolName: string;
  toolDescription: string;
  /** Lock to one character (empty = the model picks by name). */
  characterId: string;
  includeUserCharacter: boolean;
  /** chat: values stay in this chat. character: overwrite the character's own defaults. */
  scope: SheetWriteScope;
}

export const UPDATE_CHARACTER_SHEET_TOOL_DESCRIPTION =
  "Modify a chat participant's character sheet: set, increment or remove field values (numbers, text, dropdowns, lists, table rows). Changes are validated against the sheet template.";

const DEFAULT_CONFIG: UpdateCharacterSheetNodeConfig = {
  mode: "tool",
  toolName: "updateCharacterSheet",
  toolDescription: UPDATE_CHARACTER_SHEET_TOOL_DESCRIPTION,
  characterId: "",
  includeUserCharacter: true,
  scope: "chat",
};

const SCOPES: { value: SheetWriteScope; label: string }[] = [
  { value: "chat", label: "This chat" },
  { value: "character", label: "Character defaults" },
];

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeUpdateCharacterSheetNode: NodeExecutor = async (node, _inputs, context, _agent, deps): Promise<NodeExecutionResult> => {
  const cfg = { ...DEFAULT_CONFIG, ...(node.config as Partial<UpdateCharacterSheetNodeConfig> | undefined) };
  const opts = { characterId: cfg.characterId || undefined, includeUserCharacter: cfg.includeUserCharacter };
  const scope: SheetWriteScope = cfg.scope === "character" ? "character" : "chat";

  const targets = await listSheetTargets(context, deps, opts);
  const tool: WorkflowToolDefinition = {
    name: cfg.toolName || DEFAULT_CONFIG.toolName,
    description: buildUpdateSheetToolDescription(cfg.toolDescription || DEFAULT_CONFIG.toolDescription, targets),
    inputSchema: buildUpdateSheetToolSchema(targets, !!opts.characterId),
    invoke: async (args: { character?: unknown; updates?: unknown }) =>
      updateCharacterSheet(context, deps, opts, scope, typeof args?.character === "string" ? args.character : undefined, args?.updates),
  };
  context.nodeValues.set(`${node.id}::out-toolset`, [tool]);
  return { success: true, value: [tool] };
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const UPDATE_CHARACTER_SHEET_NODE_METADATA = {
  type: "updateCharacterSheet",
  label: "Update Character Sheet",
  description: "Tool that lets the model set, increment or remove values on a participant's character sheet",
  icon: SquarePen,
  category: "Chat",
  theme: createNodeTheme("teal"),
  deletable: true,
  inputs: [] as NodeInput[],
  outputs: TOOL_OUTPUTS,
  defaultConfig: DEFAULT_CONFIG,
};

namespace UpdateCharacterSheetNodeConfigProvider {
  export function getDefaultConfig() {
    return { label: UPDATE_CHARACTER_SHEET_NODE_METADATA.label, config: UPDATE_CHARACTER_SHEET_NODE_METADATA.defaultConfig };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface ConfigDialogProps {
  open: boolean;
  initialConfig: UpdateCharacterSheetNodeConfig;
  onSave: (config: UpdateCharacterSheetNodeConfig) => void;
  onCancel: () => void;
}

const UpdateCharacterSheetConfigDialog: React.FC<ConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset } = useForm<UpdateCharacterSheetNodeConfig>({ defaultValues: { ...DEFAULT_CONFIG, ...initialConfig } });
  const characterItems = useSheetCharacterItems();

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SquarePen className="h-4 w-4 text-primary" />
              Configure Update Character Sheet
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-medium mb-1 block">Tool Name</Label>
                <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="updateCharacterSheet" className="text-xs h-8" />} />
                <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool. Use camelCase with no spaces.</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Label className="text-xs font-medium">Tool Description</Label>
                  <HelpTooltip>Sent to the model. A catalog of each character's writable fields is appended automatically, so describe when to use the tool, not the fields.</HelpTooltip>
                </div>
                <Controller name="toolDescription" control={control} render={({ field }) => <Textarea {...field} rows={3} className="text-xs resize-none" />} />
              </div>

              <Controller
                name="characterId"
                control={control}
                render={({ field }) => (
                  <SheetCharacterPicker
                    value={field.value}
                    onChange={field.onChange}
                    items={characterItems}
                    hint="Lock the tool to this character's sheet so the model cannot modify another. Leave empty to let the model pick any participant by name."
                  />
                )}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs font-medium">Include user persona</Label>
                  <HelpTooltip>Also allow changes to the sheet of the character the user is playing as, when it has one.</HelpTooltip>
                </div>
                <Controller name="includeUserCharacter" control={control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">Write To</Label>
                  <HelpTooltip>
                    <p className="mb-1">
                      <span className="font-semibold">This chat</span> — Values are stored on the chat, like filling the sheet from the chat sidebar. The character's defaults stay untouched.
                    </p>
                    <p>
                      <span className="font-semibold">Character defaults</span> — Overwrites the values saved on the character itself, affecting every chat. Use for character-building agents.
                    </p>
                  </HelpTooltip>
                </div>
                <Controller
                  name="scope"
                  control={control}
                  render={({ field }) => (
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      {SCOPES.map((option, i) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => field.onChange(option.value)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                            field.value === option.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
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

const UpdateCharacterSheetContent = memo<{ config: UpdateCharacterSheetNodeConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  const characterName = useCharacterStore((state) => state.characters.find((c) => c.id === config.characterId)?.name);
  const scopeLabel = SCOPES.find((scope) => scope.value === config.scope)?.label ?? "This chat";

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase bg-teal-400/20 text-teal-600 dark:text-teal-300">Tool</span>
        <NodeConfigButton onClick={onConfigure} title="Configure update character sheet" />
      </div>

      <NodeField label="Tool Name" icon={Type}>
        <NodeConfigPreview variant="text" empty="updateCharacterSheet">
          {config.toolName || undefined}
        </NodeConfigPreview>
      </NodeField>
      <NodeField label="Description" icon={MessageSquareMore}>
        <NodeConfigPreview variant="text" empty="No description">
          {config.toolDescription || undefined}
        </NodeConfigPreview>
      </NodeField>
      <NodeField label="Character" icon={UserRound}>
        <NodeConfigPreview variant="text" empty="Model chooses">
          {config.characterId ? (characterName ?? config.characterId) : undefined}
        </NodeConfigPreview>
      </NodeField>
      <NodeField label="Write To" icon={Database}>
        <NodeConfigPreview variant="text">{scopeLabel}</NodeConfigPreview>
      </NodeField>
    </div>
  );
});

UpdateCharacterSheetContent.displayName = "UpdateCharacterSheetContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const UpdateCharacterSheetNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = { ...DEFAULT_CONFIG, ...(data.config as Partial<UpdateCharacterSheetNodeConfig> | undefined) };
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: UpdateCharacterSheetNodeConfig) => {
      takeSnapshot();
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig, dynamicOutputs: TOOL_OUTPUTS } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes, takeSnapshot],
  );

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <UpdateCharacterSheetContent config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <UpdateCharacterSheetConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

UpdateCharacterSheetNode.displayName = "UpdateCharacterSheetNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: UPDATE_CHARACTER_SHEET_NODE_METADATA,
  component: UpdateCharacterSheetNode,
  configProvider: UpdateCharacterSheetNodeConfigProvider,
  executor: executeUpdateCharacterSheetNode,
  getDynamicOutputs: () => TOOL_OUTPUTS,
});

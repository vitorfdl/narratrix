import { useReactFlow } from "@xyflow/react";
import { Filter, MessageSquareMore, Tags, Type, Users } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCharacterStore } from "@/hooks/characterStore";
import type { NodeExecutionResult, NodeExecutor, WorkflowToolDefinition } from "@/services/agent-workflow/types";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";
import { LIST_PARTICIPANTS_TOOL_SCHEMA, listParticipants, type ParticipantTypeFilter } from "./participant-tools";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ListParticipantsNodeConfig {
  mode: "script" | "tool";
  toolName: string;
  toolDescription: string;
  /** In script mode: the filter applied to the output. In tool mode: a forced filter the caller cannot override ("all" = caller chooses). */
  typeFilter: ParticipantTypeFilter;
  /** In script mode: the tag filter. In tool mode: forced tags the caller cannot override (empty = caller chooses). */
  tags: string[];
}

const DEFAULT_CONFIG: ListParticipantsNodeConfig = {
  mode: "script",
  toolName: "listParticipants",
  toolDescription: "List the participants in the current chat with their id, name, kind and whether they are currently enabled.",
  typeFilter: "all",
  tags: [],
};

const TYPE_FILTERS: { value: ParticipantTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "character", label: "Characters" },
  { value: "agent", label: "Agents" },
];

function normalizeTypeFilter(raw: unknown): ParticipantTypeFilter {
  return raw === "character" || raw === "agent" ? raw : "all";
}

/**
 * The tool schema, with any forced filter removed so the model cannot override it.
 * A forced `typeFilter` drops the `type` arg; forced `tags` drop the `tags` arg.
 */
function buildToolSchema(cfg: ListParticipantsNodeConfig): Record<string, unknown> {
  const baseProps = (LIST_PARTICIPANTS_TOOL_SCHEMA.properties ?? {}) as Record<string, unknown>;
  const properties: Record<string, unknown> = {};
  if (cfg.typeFilter === "all") {
    properties.type = baseProps.type;
  }
  if (!cfg.tags || cfg.tags.length === 0) {
    properties.tags = baseProps.tags;
  }
  return { type: "object", properties };
}

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeListParticipantsNode: NodeExecutor = async (node, _inputs, context, agent, deps): Promise<NodeExecutionResult> => {
  const cfg = (node.config || DEFAULT_CONFIG) as ListParticipantsNodeConfig;
  const mode = cfg.mode ?? "script";

  const outgoing = agent.edges.filter((e) => e.source === node.id);
  const wantTool = mode === "tool" || outgoing.some((e) => e.sourceHandle === "out-toolset");
  const wantText = mode === "script" || outgoing.some((e) => e.sourceHandle === "out-string");

  if (wantTool && !wantText) {
    const forcedTags = cfg.tags && cfg.tags.length > 0 ? cfg.tags : undefined;
    const tool: WorkflowToolDefinition = {
      name: cfg.toolName || DEFAULT_CONFIG.toolName,
      description: cfg.toolDescription || DEFAULT_CONFIG.toolDescription,
      inputSchema: buildToolSchema(cfg),
      invoke: async (args: { type?: unknown; tags?: unknown }) => {
        const type = cfg.typeFilter !== "all" ? cfg.typeFilter : normalizeTypeFilter(args.type);
        const tags = forcedTags ?? (Array.isArray(args.tags) ? args.tags.map(String) : undefined);
        const summaries = await listParticipants(context, deps, { type, tags });
        return JSON.stringify(summaries);
      },
    };
    context.nodeValues.set(`${node.id}::out-toolset`, [tool]);
    return { success: true, value: [tool] };
  }

  const summaries = await listParticipants(context, deps, { type: cfg.typeFilter, tags: cfg.tags });
  return { success: true, value: JSON.stringify(summaries) };
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-string", label: "Participants (JSON)", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const LIST_PARTICIPANTS_NODE_METADATA = {
  type: "listParticipants",
  label: "List Participants",
  description: "List the chat's participants with their id, kind and enabled state — usable as a tool or in a workflow",
  icon: Users,
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

namespace ListParticipantsNodeConfigProvider {
  export function getDefaultConfig() {
    return { label: LIST_PARTICIPANTS_NODE_METADATA.label, config: LIST_PARTICIPANTS_NODE_METADATA.defaultConfig };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface ConfigDialogProps {
  open: boolean;
  initialConfig: ListParticipantsNodeConfig;
  onSave: (config: ListParticipantsNodeConfig) => void;
  onCancel: () => void;
}

const ListParticipantsConfigDialog: React.FC<ConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch } = useForm<ListParticipantsNodeConfig>({ defaultValues: { ...DEFAULT_CONFIG, ...initialConfig } });
  const characters = useCharacterStore((state) => state.characters);
  const tagSuggestions = useMemo(() => Array.from(new Set(characters.flatMap((c) => c.tags ?? []))).sort(), [characters]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset]);

  const currentMode = watch("mode");
  const isToolMode = currentMode === "tool";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Configure List Participants
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">Mode</Label>
                  <HelpTooltip>
                    <p className="mb-1">
                      <span className="font-semibold">Script</span> — Outputs the filtered participant list (JSON) to the next node.
                    </p>
                    <p>
                      <span className="font-semibold">Tool</span> — Exposes a callable tool. The filters below are <em>forced</em>: leave them open to let the model choose, or lock them so it can only
                      request matching participants.
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
                    <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="listParticipants" className="text-xs h-8" />} />
                    <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool. Use camelCase with no spaces.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label className="text-xs font-medium">Tool Description</Label>
                      <HelpTooltip>Sent directly to the model. Explain what the tool returns so the agent knows when to call it.</HelpTooltip>
                    </div>
                    <Controller
                      name="toolDescription"
                      control={control}
                      render={({ field }) => <Textarea {...field} rows={3} placeholder="List the participants in the current chat" className="text-xs resize-none" />}
                    />
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">{isToolMode ? "Force Kind" : "Kind"}</Label>
                  <HelpTooltip>
                    {isToolMode
                      ? "Lock the result to characters or agents so the model cannot request the others. Choose All to let the model decide."
                      : "Restrict the output to characters, agents, or include everyone."}
                  </HelpTooltip>
                </div>
                <Controller
                  name="typeFilter"
                  control={control}
                  render={({ field }) => (
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      {TYPE_FILTERS.map((option, i) => (
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

              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">{isToolMode ? "Force Tags" : "Tags"}</Label>
                  <HelpTooltip>
                    {isToolMode
                      ? "Lock the result to participants with at least one of these tags so the model cannot request others. Leave empty to let the model decide."
                      : "Only participants whose character has at least one of these tags are returned. Leave empty for no tag filter."}
                  </HelpTooltip>
                </div>
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => <CommandTagInput value={field.value ?? []} onChange={field.onChange} suggestions={tagSuggestions} placeholder="Add tags..." />}
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

const ListParticipantsContent = memo<{ config: ListParticipantsNodeConfig; onConfigure: () => void }>(({ config, onConfigure }) => {
  const isToolMode = config.mode === "tool";
  const kindLabel = TYPE_FILTERS.find((t) => t.value === config.typeFilter)?.label ?? "All";

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
        <NodeConfigButton onClick={onConfigure} title="Configure list participants" />
      </div>

      {isToolMode && (
        <>
          <NodeField label="Tool Name" icon={Type}>
            <NodeConfigPreview variant="text" empty="listParticipants">
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

      <NodeField label={isToolMode ? "Forced Kind" : "Kind"} icon={Filter}>
        <NodeConfigPreview variant="text">{config.typeFilter === "all" && isToolMode ? "Model chooses" : kindLabel}</NodeConfigPreview>
      </NodeField>
      <NodeField label={isToolMode ? "Forced Tags" : "Tags"} icon={Tags}>
        <NodeConfigPreview variant="text" empty={isToolMode ? "Model chooses" : "No tag filter"}>
          {config.tags.length > 0 ? config.tags.join(", ") : undefined}
        </NodeConfigPreview>
      </NodeField>
    </div>
  );
});

ListParticipantsContent.displayName = "ListParticipantsContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const ListParticipantsNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DEFAULT_CONFIG) as ListParticipantsNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: ListParticipantsNodeConfig) => {
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
        <ListParticipantsContent config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <ListParticipantsConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

ListParticipantsNode.displayName = "ListParticipantsNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: LIST_PARTICIPANTS_NODE_METADATA,
  component: ListParticipantsNode,
  configProvider: ListParticipantsNodeConfigProvider,
  executor: executeListParticipantsNode,
  getDynamicOutputs: (config) => getOutputsForMode((config as ListParticipantsNodeConfig)?.mode),
});

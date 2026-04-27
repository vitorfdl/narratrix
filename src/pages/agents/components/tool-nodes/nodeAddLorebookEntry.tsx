import { useReactFlow, useStore } from "@xyflow/react";
import { BookPlus, FileText, Hash, MessageSquareMore, Tag, Type } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { NodeExecutionResult, NodeExecutor, WorkflowToolDefinition } from "@/services/agent-workflow/types";
import { indexLorebookEntry } from "@/services/lorebook-indexing-service";
import { createLorebookEntry, getLorebookById } from "@/services/lorebook-service";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AddLorebookEntryNodeConfig {
  mode: "script" | "tool";
  toolName: string;
  toolDescription: string;
  enabled: boolean;
  constant: boolean;
  insertionType: "lorebook_top" | "lorebook_bottom";
  priority: number;
  autoIndex: boolean;
}

const DEFAULT_CONFIG: AddLorebookEntryNodeConfig = {
  mode: "script",
  toolName: "addLorebookEntry",
  toolDescription: "Save information to a lorebook for future reference",
  enabled: true,
  constant: false,
  insertionType: "lorebook_top",
  priority: 100,
  autoIndex: true,
};

// ─── Shared create logic ───────────────────────────────────────────────────────

async function createEntry(lorebookId: string, content: string, comment: string, keywords: string[], cfg: AddLorebookEntryNodeConfig): Promise<string> {
  const lorebook = await getLorebookById(lorebookId);
  if (!lorebook) {
    throw new Error(`Lorebook not found: ${lorebookId}`);
  }

  const entry = await createLorebookEntry({
    lorebook_id: lorebookId,
    comment: comment || "Agent Entry",
    content,
    keywords,
    enabled: cfg.enabled,
    constant: cfg.constant,
    insertion_type: cfg.insertionType,
    priority: cfg.priority,
    extra: {},
    depth: 1,
    trigger_chance: 100,
    case_sensitive: false,
    match_partial_words: true,
    min_chat_messages: 1,
  });

  if (cfg.autoIndex && lorebook.rag_enabled && lorebook.embedding_model_id) {
    try {
      await indexLorebookEntry(lorebookId, entry.id);
    } catch (err) {
      console.warn("Auto-indexing failed for new entry:", err);
    }
  }

  return entry.id;
}

function parseKeywordsString(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeAddLorebookEntryNode: NodeExecutor = async (node, inputs, context): Promise<NodeExecutionResult> => {
  const cfg = (node.config || DEFAULT_CONFIG) as AddLorebookEntryNodeConfig;
  const mode = cfg.mode ?? "script";

  const lorebookId = typeof inputs.lorebookId === "string" ? inputs.lorebookId : undefined;

  if (mode === "tool") {
    const properties: Record<string, any> = {
      content: { type: "string", description: "The text content for the lorebook entry" },
      title: { type: "string", description: "A short title or comment for the entry" },
      keywords: { type: "string", description: "Comma-separated keywords for triggering this entry" },
    };
    const required = ["content"];

    if (!lorebookId) {
      properties.lorebookId = { type: "string", description: "The ID of the lorebook to add the entry to" };
      required.push("lorebookId");
    }

    const tool: WorkflowToolDefinition = {
      name: cfg.toolName || "addLorebookEntry",
      description: cfg.toolDescription || DEFAULT_CONFIG.toolDescription,
      inputSchema: { type: "object", properties, required },
      invoke: async (args: { content?: string; title?: string; keywords?: string; lorebookId?: string }) => {
        const resolvedId = lorebookId ?? args.lorebookId;
        if (!resolvedId) {
          throw new Error("No lorebook ID provided");
        }
        if (!args.content?.trim()) {
          throw new Error("Entry content is required");
        }
        const entryId = await createEntry(resolvedId, args.content, args.title || "", parseKeywordsString(args.keywords), cfg);
        return `Entry created: ${entryId}`;
      },
    };

    context.nodeValues.set(`${node.id}::out-toolset`, [tool]);
    return { success: true, value: [tool] };
  }

  // Script mode
  if (!lorebookId) {
    return { success: false, error: "Add Lorebook Entry node requires a Lorebook ID input" };
  }

  const content = typeof inputs.content === "string" ? inputs.content : "";
  if (!content.trim()) {
    return { success: false, error: "Add Lorebook Entry node requires non-empty content" };
  }

  try {
    const comment = typeof inputs.comment === "string" ? inputs.comment : "";
    const keywords = parseKeywordsString(typeof inputs.keywords === "string" ? inputs.keywords : undefined);
    const entryId = await createEntry(lorebookId, content, comment, keywords, cfg);
    context.nodeValues.set(`${node.id}::out-entry-id`, entryId);
    return { success: true, value: entryId };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create lorebook entry";
    return { success: false, error: message };
  }
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-entry-id", label: "Entry ID", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const ADD_LOREBOOK_ENTRY_NODE_METADATA = {
  type: "addLorebookEntry",
  label: "Add Lorebook Entry",
  category: "Lorebook",
  description: "Create a new entry in a lorebook",
  icon: BookPlus,
  theme: createNodeTheme("green"),
  deletable: true,
  inputs: [
    { id: "in-lorebook-id", label: "Lorebook ID", edgeType: "string" as const, targetRef: "lorebook-id-section" },
    { id: "in-content", label: "Entry Content", edgeType: "string" as const, targetRef: "content-section" },
    { id: "in-comment", label: "Title", edgeType: "string" as const, targetRef: "comment-section" },
    { id: "in-keywords", label: "Keywords", edgeType: "string" as const, targetRef: "keywords-section" },
  ] as NodeInput[],
  outputs: SCRIPT_OUTPUTS,
  defaultConfig: DEFAULT_CONFIG,
};

function getOutputsForMode(mode?: "script" | "tool"): NodeOutput[] {
  return mode === "tool" ? TOOL_OUTPUTS : SCRIPT_OUTPUTS;
}

namespace AddLorebookEntryNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: ADD_LOREBOOK_ENTRY_NODE_METADATA.label,
      config: ADD_LOREBOOK_ENTRY_NODE_METADATA.defaultConfig,
    };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface AddLorebookEntryConfigDialogProps {
  open: boolean;
  initialConfig: AddLorebookEntryNodeConfig;
  onSave: (config: AddLorebookEntryNodeConfig) => void;
  onCancel: () => void;
}

const INSERTION_TYPE_LABELS: Record<string, string> = {
  lorebook_top: "Lorebook Top",
  lorebook_bottom: "Lorebook Bottom",
};

const AddLorebookEntryConfigDialog: React.FC<AddLorebookEntryConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch } = useForm<AddLorebookEntryNodeConfig>({
    defaultValues: { ...DEFAULT_CONFIG, ...initialConfig },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset]);

  const currentMode = watch("mode");
  const currentPriority = watch("priority");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookPlus className="h-4 w-4 text-primary" />
              Configure Add Lorebook Entry
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              {/* Mode */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">Mode</Label>
                  <HelpTooltip>
                    <p className="mb-1">
                      <span className="font-semibold">Script</span> — Creates an entry directly from wired inputs.
                    </p>
                    <p>
                      <span className="font-semibold">Tool</span> — Exposes a callable tool for Agent nodes. The AI decides when and what to write.
                    </p>
                  </HelpTooltip>
                </div>
                <Controller
                  name="mode"
                  control={control}
                  render={({ field }) => (
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => field.onChange("script")}
                        className={`px-4 py-1.5 text-xs font-medium transition-colors ${field.value === "script" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        Script
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("tool")}
                        className={`px-4 py-1.5 text-xs font-medium border-l border-border transition-colors ${field.value === "tool" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        Tool
                      </button>
                    </div>
                  )}
                />
              </div>

              {/* Tool fields */}
              {currentMode === "tool" && (
                <>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Tool Name</Label>
                    <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="addLorebookEntry" className="text-xs h-8" />} />
                    <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label className="text-xs font-medium">Tool Description</Label>
                      <HelpTooltip>Sent to the model so it knows when to call this tool.</HelpTooltip>
                    </div>
                    <Controller
                      name="toolDescription"
                      control={control}
                      render={({ field }) => <Textarea {...field} rows={2} placeholder="Save information to a lorebook for future reference" className="text-xs resize-none" />}
                    />
                  </div>
                </>
              )}

              <div className="border-t border-border pt-3">
                <p className="text-xxs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Entry Defaults</p>

                {/* Insertion Type */}
                <div className="mb-3">
                  <Label className="text-xs font-medium mb-1 block">Insertion Type</Label>
                  <Controller
                    name="insertionType"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lorebook_top" className="text-xs">
                            Lorebook Top
                          </SelectItem>
                          <SelectItem value="lorebook_bottom" className="text-xs">
                            Lorebook Bottom
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Priority */}
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-medium">Priority</Label>
                        <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-0.5 rounded-md">{currentPriority}</span>
                      </div>
                      <Slider min={1} max={1000} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} className="py-1" />
                    </div>
                  )}
                />

                {/* Toggles row */}
                <div className="flex items-center gap-6">
                  <Controller
                    name="enabled"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Switch id="entry-enabled" checked={field.value} onCheckedChange={field.onChange} />
                        <Label htmlFor="entry-enabled" className="text-xs cursor-pointer">
                          Enabled
                        </Label>
                      </div>
                    )}
                  />
                  <Controller
                    name="constant"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Switch id="entry-constant" checked={field.value} onCheckedChange={field.onChange} />
                        <Label htmlFor="entry-constant" className="text-xs cursor-pointer">
                          Constant
                        </Label>
                        <HelpTooltip>Constant entries are always included in the prompt, regardless of keyword or similarity matches.</HelpTooltip>
                      </div>
                    )}
                  />
                  <Controller
                    name="autoIndex"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Switch id="entry-autoindex" checked={field.value} onCheckedChange={field.onChange} />
                        <Label htmlFor="entry-autoindex" className="text-xs cursor-pointer">
                          Auto-Index
                        </Label>
                        <HelpTooltip>Automatically compute the embedding vector for the new entry if the lorebook has RAG enabled.</HelpTooltip>
                      </div>
                    )}
                  />
                </div>
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

const AddLorebookEntryContent = memo<{ nodeId: string; config: AddLorebookEntryNodeConfig; onConfigure: () => void }>(({ nodeId, config, onConfigure }) => {
  const edges = useStore((state) => state.edges);
  const isLorebookConnected = useMemo(() => edges.some((edge) => edge.target === nodeId && edge.targetHandle === "in-lorebook-id"), [edges, nodeId]);
  const isToolMode = config.mode === "tool";

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase ${
            isToolMode ? "bg-green-400/20 text-green-500 dark:text-green-300" : "bg-green-400/10 text-green-600 dark:text-green-400"
          }`}
        >
          {isToolMode ? "Tool" : "Script"}
        </span>
        <NodeConfigButton onClick={onConfigure} title="Configure entry settings" />
      </div>

      <NodeField
        label="Lorebook ID"
        icon={BookPlus}
        refId="lorebook-id-section"
        helpText={isToolMode ? "Connect to fix the target lorebook, or leave unconnected to let the AI choose." : "Connect a Get Lorebook node or any string source."}
      >
        {!isLorebookConnected && !isToolMode && (
          <NodeConfigPreview variant="badge">
            <span className="text-xs text-muted-foreground italic">Not connected</span>
          </NodeConfigPreview>
        )}
      </NodeField>

      {isToolMode ? (
        <>
          <NodeField label="Tool Name" icon={Type}>
            <NodeConfigPreview variant="text" empty="addLorebookEntry">
              {config.toolName || undefined}
            </NodeConfigPreview>
          </NodeField>
          <NodeField label="Description" icon={MessageSquareMore}>
            <NodeConfigPreview variant="text" empty="No description">
              {config.toolDescription || undefined}
            </NodeConfigPreview>
          </NodeField>
        </>
      ) : (
        <>
          <NodeField label="Entry Content" icon={FileText} refId="content-section" helpText="The text content for the new entry." />
          <NodeField label="Title" icon={Tag} refId="comment-section" optional helpText="A short title or comment. Falls back to 'Agent Entry'." />
          <NodeField label="Keywords" icon={Hash} refId="keywords-section" optional helpText="Comma-separated keywords for triggering this entry." />
        </>
      )}

      <NodeField label="Entry Defaults" icon={BookPlus}>
        <NodeConfigPreview
          items={[
            { label: "Insertion", value: INSERTION_TYPE_LABELS[config.insertionType] || config.insertionType },
            { label: "Priority", value: `${config.priority}` },
            ...(config.autoIndex ? [{ label: "Auto-Index", value: "On" }] : []),
          ]}
        />
      </NodeField>
    </div>
  );
});

AddLorebookEntryContent.displayName = "AddLorebookEntryContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const AddLorebookEntryNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DEFAULT_CONFIG) as AddLorebookEntryNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: AddLorebookEntryNodeConfig) => {
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
        <AddLorebookEntryContent nodeId={id} config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <AddLorebookEntryConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

AddLorebookEntryNode.displayName = "AddLorebookEntryNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: ADD_LOREBOOK_ENTRY_NODE_METADATA,
  component: AddLorebookEntryNode,
  configProvider: AddLorebookEntryNodeConfigProvider,
  executor: executeAddLorebookEntryNode,
  getDynamicOutputs: (config) => getOutputsForMode((config as AddLorebookEntryNodeConfig)?.mode),
});

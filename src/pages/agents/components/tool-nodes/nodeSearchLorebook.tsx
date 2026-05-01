import { useReactFlow, useStore } from "@xyflow/react";
import { cosineSimilarity } from "ai";
import { BookOpenCheck, Hash, Search, Type } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { LorebookEntry } from "@/schema/lorebook-schema";
import type { NodeExecutionResult, NodeExecutor, WorkflowToolDefinition } from "@/services/agent-workflow/types";
import { embedText } from "@/services/embedding-service";
import { estimateTokens } from "@/services/inference/formatter/apply-context-limit";
import { parseStoredVector } from "@/services/lorebook-indexing-service";
import { getLorebookById } from "@/services/lorebook-service";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SearchLorebookNodeConfig {
  mode: "script" | "tool";
  toolName: string;
  toolDescription: string;
  maxTokens: number;
  separator: string;
}

const DEFAULT_CONFIG: SearchLorebookNodeConfig = {
  mode: "script",
  toolName: "searchLorebook",
  toolDescription: "Search a lorebook for relevant information",
  maxTokens: 500,
  separator: "\n---\n",
};

// ─── Shared search logic ───────────────────────────────────────────────────────

function matchKeywords(text: string, keywords: string[], caseSensitive: boolean, matchPartialWords: boolean): boolean {
  if (keywords.length === 0) {
    return false;
  }
  const flags = caseSensitive ? "g" : "gi";
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = matchPartialWords ? escaped : `\\b${escaped}\\b`;
    if (new RegExp(pattern, flags).test(text)) {
      return true;
    }
  }
  return false;
}

async function searchLorebookEntries(lorebookId: string, query: string | undefined, maxTokens: number, separator: string): Promise<string> {
  const lorebook = await getLorebookById(lorebookId, true);
  if (!lorebook) {
    throw new Error(`Lorebook not found: ${lorebookId}`);
  }

  const enabledEntries = lorebook.entries.filter((e: LorebookEntry) => e.enabled);
  const candidates: LorebookEntry[] = [];

  if (query?.trim()) {
    let queryEmbedding: number[] | null = null;
    if (lorebook.rag_enabled && lorebook.embedding_model_id) {
      try {
        const embedResult = await embedText(lorebook.embedding_model_id, query);
        queryEmbedding = embedResult.embedding as number[];
      } catch {
        // Fall back to keyword matching
      }
    }

    for (const entry of enabledEntries) {
      if (entry.constant) {
        candidates.push(entry);
        continue;
      }
      if (queryEmbedding) {
        const entryVector = parseStoredVector(entry.vector_content);
        if (entryVector) {
          const similarity = cosineSimilarity(queryEmbedding, entryVector);
          if (similarity >= lorebook.similarity_threshold) {
            candidates.push(entry);
          }
        }
      } else {
        if (matchKeywords(query, entry.keywords, entry.case_sensitive, entry.match_partial_words)) {
          candidates.push(entry);
        }
      }
    }
  } else {
    candidates.push(...enabledEntries);
  }

  candidates.sort((a, b) => b.priority - a.priority);

  const parts: string[] = [];
  let budget = maxTokens;
  for (const entry of candidates) {
    if (budget <= 0) {
      break;
    }
    const tokens = estimateTokens(entry.content);
    if (tokens <= budget) {
      parts.push(entry.content);
      budget -= tokens;
    }
  }

  return parts.join(separator);
}

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeSearchLorebookNode: NodeExecutor = async (node, inputs, context): Promise<NodeExecutionResult> => {
  const cfg = (node.config || DEFAULT_CONFIG) as SearchLorebookNodeConfig;
  const mode = cfg.mode ?? "script";

  const outgoing = (context.nodeValues.get("__edges__") as any[]) || [];
  const wantTool = mode === "tool" || outgoing.some((e: any) => e.source === node.id && e.sourceHandle === "out-toolset");

  const lorebookId = typeof inputs.lorebookId === "string" ? inputs.lorebookId : undefined;

  if (wantTool && mode === "tool") {
    const properties: Record<string, any> = {
      query: { type: "string", description: "Search query to find relevant entries" },
    };
    const required = ["query"];

    if (!lorebookId) {
      properties.lorebookId = { type: "string", description: "The ID of the lorebook to search" };
      required.push("lorebookId");
    }

    const tool: WorkflowToolDefinition = {
      name: cfg.toolName || "searchLorebook",
      description: cfg.toolDescription || DEFAULT_CONFIG.toolDescription,
      inputSchema: { type: "object", properties, required },
      invoke: async (args: { query?: string; lorebookId?: string }) => {
        const resolvedId = lorebookId ?? args.lorebookId;
        if (!resolvedId) {
          throw new Error("No lorebook ID provided");
        }
        return searchLorebookEntries(resolvedId, args.query, cfg.maxTokens, cfg.separator);
      },
    };

    context.nodeValues.set(`${node.id}::out-toolset`, [tool]);
    return { success: true, value: [tool] };
  }

  // Script mode
  if (!lorebookId) {
    return { success: false, error: "Search Lorebook node requires a Lorebook ID input" };
  }

  try {
    const query = typeof inputs.query === "string" ? inputs.query : undefined;
    const result = await searchLorebookEntries(lorebookId, query, cfg.maxTokens, cfg.separator);
    context.nodeValues.set(`${node.id}::out-string`, result);
    return { success: true, value: result };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to search lorebook";
    return { success: false, error: message };
  }
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-string", label: "Entries", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const SEARCH_LOREBOOK_NODE_METADATA = {
  type: "searchLorebook",
  label: "Search Lorebook",
  category: "Lorebook",
  description: "Search a lorebook for matching entries using keywords or semantic search",
  icon: BookOpenCheck,
  theme: createNodeTheme("teal"),
  deletable: true,
  inputs: [
    { id: "in-lorebook-id", label: "Lorebook ID", edgeType: "string" as const, targetRef: "lorebook-id-section" },
    { id: "in-query", label: "Query", edgeType: "string" as const, targetRef: "query-section" },
  ] as NodeInput[],
  outputs: SCRIPT_OUTPUTS,
  defaultConfig: DEFAULT_CONFIG,
};

function getOutputsForMode(mode?: "script" | "tool"): NodeOutput[] {
  return mode === "tool" ? TOOL_OUTPUTS : SCRIPT_OUTPUTS;
}

namespace SearchLorebookNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: SEARCH_LOREBOOK_NODE_METADATA.label,
      config: SEARCH_LOREBOOK_NODE_METADATA.defaultConfig,
    };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface SearchLorebookConfigDialogProps {
  open: boolean;
  initialConfig: SearchLorebookNodeConfig;
  onSave: (config: SearchLorebookNodeConfig) => void;
  onCancel: () => void;
}

const SearchLorebookConfigDialog: React.FC<SearchLorebookConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch } = useForm<SearchLorebookNodeConfig>({
    defaultValues: { ...DEFAULT_CONFIG, ...initialConfig },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset]);

  const currentMode = watch("mode");
  const currentMaxTokens = watch("maxTokens");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-primary" />
              Configure Search Lorebook
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
                      <span className="font-semibold">Script</span> — Runs directly using wired inputs. Returns matched entries as text.
                    </p>
                    <p>
                      <span className="font-semibold">Tool</span> — Exposes a callable tool for Agent nodes. The AI can search the lorebook on demand.
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
                    <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="searchLorebook" className="text-xs h-8" />} />
                    <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label className="text-xs font-medium">Tool Description</Label>
                      <HelpTooltip>Sent to the model so it knows when to call this tool and what to expect.</HelpTooltip>
                    </div>
                    <Controller
                      name="toolDescription"
                      control={control}
                      render={({ field }) => <Input {...field} placeholder="Search a lorebook for relevant information" className="text-xs h-8" />}
                    />
                  </div>
                </>
              )}

              {/* Max Tokens */}
              <Controller
                name="maxTokens"
                control={control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium">Max Tokens</Label>
                        <HelpTooltip>Token budget for the returned entries. Entries are added by priority until the budget is exhausted.</HelpTooltip>
                      </div>
                      <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-0.5 rounded-md">{currentMaxTokens}</span>
                    </div>
                    <Slider min={50} max={4000} step={50} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} className="py-1" />
                  </div>
                )}
              />

              {/* Separator */}
              <div>
                <Label className="text-xs font-medium mb-1 block">Entry Separator</Label>
                <Controller name="separator" control={control} render={({ field }) => <Input {...field} placeholder="\n---\n" className="text-xs h-8 font-mono" />} />
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

const SearchLorebookContent = memo<{ nodeId: string; config: SearchLorebookNodeConfig; onConfigure: () => void }>(({ nodeId, config, onConfigure }) => {
  const edges = useStore((state) => state.edges);
  const isLorebookConnected = useMemo(() => edges.some((edge) => edge.target === nodeId && edge.targetHandle === "in-lorebook-id"), [edges, nodeId]);
  const isToolMode = config.mode === "tool";

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase ${
            isToolMode ? "bg-teal-400/20 text-teal-500 dark:text-teal-300" : "bg-teal-400/10 text-teal-600 dark:text-teal-400"
          }`}
        >
          {isToolMode ? "Tool" : "Script"}
        </span>
        <NodeConfigButton onClick={onConfigure} title="Configure search settings" />
      </div>

      <NodeField
        label="Lorebook ID"
        icon={BookOpenCheck}
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
        <NodeField label="Tool Name" icon={Type}>
          <NodeConfigPreview variant="text" empty="searchLorebook">
            {config.toolName || undefined}
          </NodeConfigPreview>
        </NodeField>
      ) : (
        <NodeField label="Query" icon={Search} refId="query-section" optional helpText="Search text for keyword or semantic matching. Leave unconnected to return all entries." />
      )}

      <NodeField label="Budget" icon={Hash}>
        <NodeConfigPreview
          items={[
            { label: "Max Tokens", value: `${config.maxTokens}` },
            { label: "Separator", value: config.separator === "\n---\n" ? "---" : config.separator.replace(/\n/g, "\\n") },
          ]}
        />
      </NodeField>
    </div>
  );
});

SearchLorebookContent.displayName = "SearchLorebookContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const SearchLorebookNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DEFAULT_CONFIG) as SearchLorebookNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: SearchLorebookNodeConfig) => {
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
        <SearchLorebookContent nodeId={id} config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <SearchLorebookConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

SearchLorebookNode.displayName = "SearchLorebookNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: SEARCH_LOREBOOK_NODE_METADATA,
  component: SearchLorebookNode,
  configProvider: SearchLorebookNodeConfigProvider,
  executor: executeSearchLorebookNode,
  getDynamicOutputs: (config) => getOutputsForMode((config as SearchLorebookNodeConfig)?.mode),
});

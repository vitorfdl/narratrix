import { useReactFlow, useStore } from "@xyflow/react";
import { ListFilter, MessageSquareMore, Type, UserSearch } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { NodeExecutionResult, NodeExecutor, WorkflowToolDefinition } from "@/services/agent-workflow/types";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";
import { GET_PARTICIPANT_DATA_TOOL_SCHEMA, getParticipantData, PARTICIPANT_DATA_FIELDS, type ParticipantDataField } from "./participant-tools";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GetParticipantDataNodeConfig {
  mode: "script" | "tool";
  toolName: string;
  toolDescription: string;
  fields: ParticipantDataField[];
}

const DEFAULT_CONFIG: GetParticipantDataNodeConfig = {
  mode: "script",
  toolName: "getParticipantData",
  toolDescription: "Get a chat participant's data (name, kind, enabled state, personality, tags, avatar) by id.",
  fields: [],
};

function sanitizeFields(raw: unknown): ParticipantDataField[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const allowed = PARTICIPANT_DATA_FIELDS as readonly string[];
  const fields = raw.filter((f): f is ParticipantDataField => typeof f === "string" && allowed.includes(f));
  return fields.length > 0 ? fields : undefined;
}

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeGetParticipantDataNode: NodeExecutor = async (node, inputs, context, agent, deps): Promise<NodeExecutionResult> => {
  const cfg = (node.config || DEFAULT_CONFIG) as GetParticipantDataNodeConfig;
  const mode = cfg.mode ?? "tool";

  const outgoing = agent.edges.filter((e) => e.source === node.id);
  const wantTool = mode === "tool" || outgoing.some((e) => e.sourceHandle === "out-toolset");
  const wantText = mode === "script" || outgoing.some((e) => e.sourceHandle === "out-string");

  if (wantTool && !wantText) {
    const tool: WorkflowToolDefinition = {
      name: cfg.toolName || DEFAULT_CONFIG.toolName,
      description: cfg.toolDescription || DEFAULT_CONFIG.toolDescription,
      inputSchema: GET_PARTICIPANT_DATA_TOOL_SCHEMA,
      invoke: async (args: { participantId?: unknown; fields?: unknown }) => {
        const participantId = typeof args.participantId === "string" ? args.participantId : "";
        if (!participantId) {
          return "Provide a 'participantId' to look up.";
        }
        const data = await getParticipantData(context, deps, participantId, sanitizeFields(args.fields));
        return data ? JSON.stringify(data) : `No participant found with id "${participantId}".`;
      },
    };
    context.nodeValues.set(`${node.id}::out-toolset`, [tool]);
    return { success: true, value: [tool] };
  }

  const participantId = typeof inputs.participantId === "string" ? inputs.participantId : "";
  if (!participantId) {
    return { success: false, error: "Get Participant Data node received no participant id" };
  }
  const fields = cfg.fields && cfg.fields.length > 0 ? cfg.fields : undefined;
  const data = await getParticipantData(context, deps, participantId, fields);
  if (!data) {
    return { success: false, error: `No participant found with id "${participantId}"` };
  }
  return { success: true, value: JSON.stringify(data) };
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-string", label: "Participant Data (JSON)", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const GET_PARTICIPANT_DATA_NODE_METADATA = {
  type: "getParticipantData",
  label: "Get Participant Data",
  description: "Read a chat participant's data by id — usable as a tool or in a workflow",
  icon: UserSearch,
  category: "Chat",
  theme: createNodeTheme("purple"),
  deletable: true,
  inputs: [{ id: "in-participant", label: "Participant ID", edgeType: "string" as const, targetRef: "participant-section" }] as NodeInput[],
  outputs: SCRIPT_OUTPUTS,
  defaultConfig: DEFAULT_CONFIG,
};

function getOutputsForMode(mode?: "script" | "tool"): NodeOutput[] {
  return mode === "tool" ? TOOL_OUTPUTS : SCRIPT_OUTPUTS;
}

namespace GetParticipantDataNodeConfigProvider {
  export function getDefaultConfig() {
    return { label: GET_PARTICIPANT_DATA_NODE_METADATA.label, config: GET_PARTICIPANT_DATA_NODE_METADATA.defaultConfig };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface ConfigDialogProps {
  open: boolean;
  initialConfig: GetParticipantDataNodeConfig;
  onSave: (config: GetParticipantDataNodeConfig) => void;
  onCancel: () => void;
}

const GetParticipantDataConfigDialog: React.FC<ConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch } = useForm<GetParticipantDataNodeConfig>({ defaultValues: { ...DEFAULT_CONFIG, ...initialConfig } });

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset]);

  const currentMode = watch("mode");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserSearch className="h-4 w-4 text-primary" />
              Configure Get Participant Data
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">Mode</Label>
                  <HelpTooltip>
                    <p className="mb-1">
                      <span className="font-semibold">Tool</span> — Exposes a callable tool; the caller passes the participant id and which fields to read.
                    </p>
                    <p>
                      <span className="font-semibold">Script</span> — Reads the connected participant id and outputs the selected fields (JSON).
                    </p>
                  </HelpTooltip>
                </div>
                <Controller
                  name="mode"
                  control={control}
                  render={({ field }) => (
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      {(["tool", "script"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${value === "script" ? "border-l border-border" : ""} ${
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

              {currentMode === "tool" ? (
                <>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Tool Name</Label>
                    <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="getParticipantData" className="text-xs h-8" />} />
                    <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool. Use camelCase with no spaces.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label className="text-xs font-medium">Tool Description</Label>
                      <HelpTooltip>Sent directly to the model. Explain what data the tool returns and when to call it.</HelpTooltip>
                    </div>
                    <Controller
                      name="toolDescription"
                      control={control}
                      render={({ field }) => <Textarea {...field} rows={3} placeholder="Get a participant's data by id" className="text-xs resize-none" />}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Label className="text-xs font-medium">Fields</Label>
                    <HelpTooltip>Which fields to include in the output. Select none to return all available fields.</HelpTooltip>
                  </div>
                  <Controller
                    name="fields"
                    control={control}
                    render={({ field }) => {
                      const selected = field.value ?? [];
                      const toggle = (value: ParticipantDataField) => field.onChange(selected.includes(value) ? selected.filter((f) => f !== value) : [...selected, value]);
                      return (
                        <div className="flex flex-wrap gap-1.5">
                          {PARTICIPANT_DATA_FIELDS.map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggle(value)}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                                selected.includes(value) ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/50 text-muted-foreground hover:bg-muted/50",
                              )}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
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

const GetParticipantDataContent = memo<{ nodeId: string; config: GetParticipantDataNodeConfig; onConfigure: () => void }>(({ nodeId, config, onConfigure }) => {
  const edges = useStore((state) => state.edges);
  const isParticipantConnected = useMemo(() => edges.some((edge) => edge.target === nodeId && edge.targetHandle === "in-participant"), [edges, nodeId]);
  const isToolMode = config.mode === "tool";

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase ${
            isToolMode ? "bg-purple-400/20 text-purple-600 dark:text-purple-300" : "bg-purple-400/10 text-purple-600 dark:text-purple-400"
          }`}
        >
          {isToolMode ? "Tool" : "Script"}
        </span>
        <NodeConfigButton onClick={onConfigure} title="Configure get participant data" />
      </div>

      {isToolMode ? (
        <>
          <NodeField label="Tool Name" icon={Type}>
            <NodeConfigPreview variant="text" empty="getParticipantData">
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
          <NodeField label="Participant" icon={UserSearch} refId="participant-section">
            <NodeConfigPreview variant="text">
              {isParticipantConnected ? (
                <span className="text-purple-500 dark:text-purple-400 font-medium not-italic text-xxs">↳ Receiving from input</span>
              ) : (
                <span className="italic">Connect a participant id</span>
              )}
            </NodeConfigPreview>
          </NodeField>
          <NodeField label="Fields" icon={ListFilter}>
            <NodeConfigPreview variant="text" empty="All fields">
              {config.fields.length > 0 ? config.fields.join(", ") : undefined}
            </NodeConfigPreview>
          </NodeField>
        </>
      )}
    </div>
  );
});

GetParticipantDataContent.displayName = "GetParticipantDataContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const GetParticipantDataNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DEFAULT_CONFIG) as GetParticipantDataNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: GetParticipantDataNodeConfig) => {
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
        <GetParticipantDataContent nodeId={id} config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <GetParticipantDataConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

GetParticipantDataNode.displayName = "GetParticipantDataNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: GET_PARTICIPANT_DATA_NODE_METADATA,
  component: GetParticipantDataNode,
  configProvider: GetParticipantDataNodeConfigProvider,
  executor: executeGetParticipantDataNode,
  getDynamicOutputs: (config) => getOutputsForMode((config as GetParticipantDataNodeConfig)?.mode),
});

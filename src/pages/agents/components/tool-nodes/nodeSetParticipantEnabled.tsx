import { useReactFlow, useStore } from "@xyflow/react";
import { MessageSquareMore, Power, Type, UserCog } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NodeExecutionResult, NodeExecutor, WorkflowToolDefinition } from "@/services/agent-workflow/types";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";
import { SET_PARTICIPANT_ENABLED_TOOL_SCHEMA, setParticipantEnabled } from "./participant-tools";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SetParticipantEnabledNodeConfig {
  mode: "script" | "tool";
  toolName: string;
  toolDescription: string;
  enabled: boolean;
}

const DEFAULT_CONFIG: SetParticipantEnabledNodeConfig = {
  mode: "script",
  toolName: "setParticipantEnabled",
  toolDescription: "Enable or disable a chat participant by id. Disabled participants stay in the chat but are excluded from generation.",
  enabled: true,
};

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeSetParticipantEnabledNode: NodeExecutor = async (node, inputs, context, agent, deps): Promise<NodeExecutionResult> => {
  const cfg = (node.config || DEFAULT_CONFIG) as SetParticipantEnabledNodeConfig;
  const mode = cfg.mode ?? "tool";

  const outgoing = agent.edges.filter((e) => e.source === node.id);
  const wantTool = mode === "tool" || outgoing.some((e) => e.sourceHandle === "out-toolset");
  const wantText = mode === "script" || outgoing.some((e) => e.sourceHandle === "out-string");

  if (wantTool && !wantText) {
    const tool: WorkflowToolDefinition = {
      name: cfg.toolName || DEFAULT_CONFIG.toolName,
      description: cfg.toolDescription || DEFAULT_CONFIG.toolDescription,
      inputSchema: SET_PARTICIPANT_ENABLED_TOOL_SCHEMA,
      invoke: async (args: { participantId?: unknown; enabled?: unknown }) => {
        const participantId = typeof args.participantId === "string" ? args.participantId : "";
        if (!participantId) {
          return "Provide a 'participantId' to enable or disable.";
        }
        if (typeof args.enabled !== "boolean") {
          return "Provide 'enabled' as a boolean (true to activate, false to disable).";
        }
        const result = await setParticipantEnabled(context, deps, participantId, args.enabled);
        return result.message;
      },
    };
    context.nodeValues.set(`${node.id}::out-toolset`, [tool]);
    return { success: true, value: [tool] };
  }

  const participantId = typeof inputs.participantId === "string" ? inputs.participantId : "";
  if (!participantId) {
    return { success: false, error: "Set Participant Enabled node received no participant id" };
  }
  const result = await setParticipantEnabled(context, deps, participantId, cfg.enabled);
  if (!result.ok) {
    return { success: false, error: result.message };
  }
  return { success: true, value: participantId };
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-string", label: "Participant ID", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const SET_PARTICIPANT_ENABLED_NODE_METADATA = {
  type: "setParticipantEnabled",
  label: "Set Participant Enabled",
  description: "Enable or disable a chat participant by id — usable as a tool or in a workflow",
  icon: UserCog,
  category: "Chat",
  theme: createNodeTheme("orange"),
  deletable: true,
  inputs: [{ id: "in-participant", label: "Participant ID", edgeType: "string" as const, targetRef: "participant-section" }] as NodeInput[],
  outputs: SCRIPT_OUTPUTS,
  defaultConfig: DEFAULT_CONFIG,
};

function getOutputsForMode(mode?: "script" | "tool"): NodeOutput[] {
  return mode === "tool" ? TOOL_OUTPUTS : SCRIPT_OUTPUTS;
}

namespace SetParticipantEnabledNodeConfigProvider {
  export function getDefaultConfig() {
    return { label: SET_PARTICIPANT_ENABLED_NODE_METADATA.label, config: SET_PARTICIPANT_ENABLED_NODE_METADATA.defaultConfig };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface ConfigDialogProps {
  open: boolean;
  initialConfig: SetParticipantEnabledNodeConfig;
  onSave: (config: SetParticipantEnabledNodeConfig) => void;
  onCancel: () => void;
}

const SetParticipantEnabledConfigDialog: React.FC<ConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch } = useForm<SetParticipantEnabledNodeConfig>({ defaultValues: { ...DEFAULT_CONFIG, ...initialConfig } });

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
              <UserCog className="h-4 w-4 text-primary" />
              Configure Set Participant Enabled
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">Mode</Label>
                  <HelpTooltip>
                    <p className="mb-1">
                      <span className="font-semibold">Tool</span> — Exposes a callable tool; the caller passes the participant id and whether to enable or disable.
                    </p>
                    <p>
                      <span className="font-semibold">Script</span> — Sets the connected participant to the fixed state below, then passes the id through.
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
                    <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="setParticipantEnabled" className="text-xs h-8" />} />
                    <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool. Use camelCase with no spaces.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label className="text-xs font-medium">Tool Description</Label>
                      <HelpTooltip>Sent directly to the model. Explain when to enable or disable a participant.</HelpTooltip>
                    </div>
                    <Controller
                      name="toolDescription"
                      control={control}
                      render={({ field }) => <Textarea {...field} rows={3} placeholder="Enable or disable a chat participant by id" className="text-xs resize-none" />}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Label className="text-xs font-medium">Target State</Label>
                    <HelpTooltip>The state applied to the participant connected to this node's input.</HelpTooltip>
                  </div>
                  <Controller
                    name="enabled"
                    control={control}
                    render={({ field }) => (
                      <div className="inline-flex rounded-md border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => field.onChange(true)}
                          className={`px-4 py-1.5 text-xs font-medium transition-colors ${field.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                        >
                          Enable
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange(false)}
                          className={`px-4 py-1.5 text-xs font-medium border-l border-border transition-colors ${
                            !field.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Disable
                        </button>
                      </div>
                    )}
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

const SetParticipantEnabledContent = memo<{ nodeId: string; config: SetParticipantEnabledNodeConfig; onConfigure: () => void }>(({ nodeId, config, onConfigure }) => {
  const edges = useStore((state) => state.edges);
  const isParticipantConnected = useMemo(() => edges.some((edge) => edge.target === nodeId && edge.targetHandle === "in-participant"), [edges, nodeId]);
  const isToolMode = config.mode === "tool";

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase ${
            isToolMode ? "bg-orange-400/20 text-orange-600 dark:text-orange-300" : "bg-orange-400/10 text-orange-600 dark:text-orange-400"
          }`}
        >
          {isToolMode ? "Tool" : "Script"}
        </span>
        <NodeConfigButton onClick={onConfigure} title="Configure set participant enabled" />
      </div>

      {isToolMode ? (
        <>
          <NodeField label="Tool Name" icon={Type}>
            <NodeConfigPreview variant="text" empty="setParticipantEnabled">
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
          <NodeField label="Participant" icon={UserCog} refId="participant-section">
            <NodeConfigPreview variant="text">
              {isParticipantConnected ? (
                <span className="text-orange-500 dark:text-orange-400 font-medium not-italic text-xxs">↳ Receiving from input</span>
              ) : (
                <span className="italic">Connect a participant id</span>
              )}
            </NodeConfigPreview>
          </NodeField>
          <NodeField label="Target State" icon={Power}>
            <NodeConfigPreview variant="text">{config.enabled ? "Enable" : "Disable"}</NodeConfigPreview>
          </NodeField>
        </>
      )}
    </div>
  );
});

SetParticipantEnabledContent.displayName = "SetParticipantEnabledContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const SetParticipantEnabledNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DEFAULT_CONFIG) as SetParticipantEnabledNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: SetParticipantEnabledNodeConfig) => {
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
        <SetParticipantEnabledContent nodeId={id} config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <SetParticipantEnabledConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

SetParticipantEnabledNode.displayName = "SetParticipantEnabledNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: SET_PARTICIPANT_ENABLED_NODE_METADATA,
  component: SetParticipantEnabledNode,
  configProvider: SetParticipantEnabledNodeConfigProvider,
  executor: executeSetParticipantEnabledNode,
  getDynamicOutputs: (config) => getOutputsForMode((config as SetParticipantEnabledNodeConfig)?.mode),
});

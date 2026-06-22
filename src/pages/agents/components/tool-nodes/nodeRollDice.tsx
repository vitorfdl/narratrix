import { useReactFlow, useStore } from "@xyflow/react";
import { Dices, Hash, MessageSquareMore, Type } from "lucide-react";
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
import { ROLL_DICE_TOOL_SCHEMA, rollDice } from "./dice-tools";
import type { NodeProps } from "./nodeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RollDiceNodeConfig {
  mode: "script" | "tool";
  toolName: string;
  toolDescription: string;
  notation: string;
}

const DEFAULT_CONFIG: RollDiceNodeConfig = {
  mode: "script",
  toolName: "rollDice",
  toolDescription: "Roll dice using standard notation (e.g. 2d6+3) and return the individual rolls and their total.",
  notation: "1d20",
};

const FALLBACK_NOTATION = "1d20";

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeRollDiceNode: NodeExecutor = async (node, inputs, context, agent): Promise<NodeExecutionResult> => {
  const cfg = (node.config || DEFAULT_CONFIG) as RollDiceNodeConfig;
  const mode = cfg.mode ?? "script";

  const outgoing = agent.edges.filter((e) => e.source === node.id);
  const wantTool = mode === "tool" || outgoing.some((e) => e.sourceHandle === "out-toolset");
  const wantText = mode === "script" || outgoing.some((e) => e.sourceHandle === "out-string");

  if (wantTool && !wantText) {
    const tool: WorkflowToolDefinition = {
      name: cfg.toolName || DEFAULT_CONFIG.toolName,
      description: cfg.toolDescription || DEFAULT_CONFIG.toolDescription,
      inputSchema: ROLL_DICE_TOOL_SCHEMA,
      invoke: async (args: { notation?: unknown }) => {
        const notation = typeof args.notation === "string" && args.notation.trim() ? args.notation : cfg.notation || FALLBACK_NOTATION;
        const result = rollDice(notation);
        return "error" in result ? result.error : JSON.stringify(result);
      },
    };
    context.nodeValues.set(`${node.id}::out-toolset`, [tool]);
    return { success: true, value: [tool] };
  }

  const notation = typeof inputs.notation === "string" && inputs.notation.trim() ? inputs.notation : cfg.notation || FALLBACK_NOTATION;
  const result = rollDice(notation);
  if ("error" in result) {
    return { success: false, error: result.error };
  }
  return { success: true, value: JSON.stringify(result) };
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-string", label: "Roll Result (JSON)", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const ROLL_DICE_NODE_METADATA = {
  type: "rollDice",
  label: "Roll Dice",
  description: "Roll dice from standard notation (e.g. 2d6+3) — usable as a tool or in a workflow",
  icon: Dices,
  category: "Chat",
  theme: createNodeTheme("green"),
  deletable: true,
  inputs: [{ id: "in-notation", label: "Notation", edgeType: "string" as const, targetRef: "notation-section" }] as NodeInput[],
  outputs: SCRIPT_OUTPUTS,
  defaultConfig: DEFAULT_CONFIG,
};

function getOutputsForMode(mode?: "script" | "tool"): NodeOutput[] {
  return mode === "tool" ? TOOL_OUTPUTS : SCRIPT_OUTPUTS;
}

namespace RollDiceNodeConfigProvider {
  export function getDefaultConfig() {
    return { label: ROLL_DICE_NODE_METADATA.label, config: ROLL_DICE_NODE_METADATA.defaultConfig };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface ConfigDialogProps {
  open: boolean;
  initialConfig: RollDiceNodeConfig;
  onSave: (config: RollDiceNodeConfig) => void;
  onCancel: () => void;
}

const RollDiceConfigDialog: React.FC<ConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch } = useForm<RollDiceNodeConfig>({ defaultValues: { ...DEFAULT_CONFIG, ...initialConfig } });

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
              <Dices className="h-4 w-4 text-primary" />
              Configure Roll Dice
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 py-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-xs font-medium">Mode</Label>
                  <HelpTooltip>
                    <p className="mb-1">
                      <span className="font-semibold">Script</span> — Rolls the dice below (or the connected notation) and outputs the result as JSON.
                    </p>
                    <p>
                      <span className="font-semibold">Tool</span> — Exposes a callable tool; the caller passes the dice notation to roll.
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

              {isToolMode ? (
                <>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Tool Name</Label>
                    <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="rollDice" className="text-xs h-8" />} />
                    <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool. Use camelCase with no spaces.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label className="text-xs font-medium">Tool Description</Label>
                      <HelpTooltip>Sent directly to the model. Explain when to roll dice and what is returned.</HelpTooltip>
                    </div>
                    <Controller
                      name="toolDescription"
                      control={control}
                      render={({ field }) => <Textarea {...field} rows={3} placeholder="Roll dice using standard notation" className="text-xs resize-none" />}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Label className="text-xs font-medium">Dice</Label>
                    <HelpTooltip>
                      Standard notation like <span className="font-mono">2d6+3</span>, <span className="font-mono">d20</span> or <span className="font-mono">4d8-1</span>. Used when no Notation input
                      is connected.
                    </HelpTooltip>
                  </div>
                  <Controller name="notation" control={control} render={({ field }) => <Input {...field} placeholder="1d20" className="text-xs h-8 font-mono" />} />
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

const RollDiceContent = memo<{ nodeId: string; config: RollDiceNodeConfig; onConfigure: () => void }>(({ nodeId, config, onConfigure }) => {
  const edges = useStore((state) => state.edges);
  const isNotationConnected = useMemo(() => edges.some((edge) => edge.target === nodeId && edge.targetHandle === "in-notation"), [edges, nodeId]);
  const isToolMode = config.mode === "tool";

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase ${
            isToolMode ? "bg-green-400/20 text-green-600 dark:text-green-300" : "bg-green-400/10 text-green-600 dark:text-green-400"
          }`}
        >
          {isToolMode ? "Tool" : "Script"}
        </span>
        <NodeConfigButton onClick={onConfigure} title="Configure roll dice" />
      </div>

      {isToolMode ? (
        <>
          <NodeField label="Tool Name" icon={Type}>
            <NodeConfigPreview variant="text" empty="rollDice">
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
        <NodeField label="Dice" icon={Hash} refId="notation-section">
          <NodeConfigPreview variant="text">
            {isNotationConnected ? (
              <span className="text-green-500 dark:text-green-400 font-medium not-italic text-xxs">↳ Receiving from input</span>
            ) : (
              <span className="font-mono">{config.notation || FALLBACK_NOTATION}</span>
            )}
          </NodeConfigPreview>
        </NodeField>
      )}
    </div>
  );
});

RollDiceContent.displayName = "RollDiceContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const RollDiceNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DEFAULT_CONFIG) as RollDiceNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: RollDiceNodeConfig) => {
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
        <RollDiceContent nodeId={id} config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <RollDiceConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

RollDiceNode.displayName = "RollDiceNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: ROLL_DICE_NODE_METADATA,
  component: RollDiceNode,
  configProvider: RollDiceNodeConfigProvider,
  executor: executeRollDiceNode,
  getDynamicOutputs: (config) => getOutputsForMode((config as RollDiceNodeConfig)?.mode),
});

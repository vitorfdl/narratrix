import { useReactFlow, useStore } from "@xyflow/react";
import { GripVertical, ListChecks, MessageSquareMore, Plus, Trash2, Type } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfileStore } from "@/hooks/ProfileStore";
import { type PendingChoiceOption, useUserChoiceStore } from "@/hooks/userChoiceStore";
import type { NodeExecutionResult, NodeExecutor, WorkflowToolDefinition } from "@/services/agent-workflow/types";
import { playBeepSound } from "@/services/inference/utils";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UserChoiceNodeConfig {
  mode: "script" | "tool";
  prompt: string;
  choices: string[];
  toolName: string;
  toolDescription: string;
  timeoutSeconds: number;
}

const DEFAULT_CONFIG: UserChoiceNodeConfig = {
  mode: "script",
  prompt: "What would you like to do?",
  choices: ["Option A", "Option B"],
  toolName: "userChoice",
  toolDescription: "Present the user with a multiple-choice prompt and return their selection",
  timeoutSeconds: 0,
};

// ─── Executor ──────────────────────────────────────────────────────────────────

function parseChoices(raw: unknown, fallback: string[]): PendingChoiceOption[] {
  let parsed: unknown[] | null = null;

  if (typeof raw === "string") {
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json)) {
        parsed = json;
      }
    } catch {
      // use fallback
    }
  } else if (Array.isArray(raw)) {
    parsed = raw;
  }

  if (parsed) {
    return parsed.map((item, i) => {
      if (typeof item === "string") {
        return { label: item, value: item };
      }
      if (item && typeof item === "object" && "label" in item && "value" in item) {
        return { label: String((item as Record<string, unknown>).label), value: String((item as Record<string, unknown>).value) };
      }
      return { label: `Option ${i + 1}`, value: String(item) };
    });
  }

  return fallback.map((s) => ({ label: s, value: s }));
}

function createPendingChoice(runKey: string, executionId: string, prompt: string, choices: PendingChoiceOption[], timeoutSeconds: number): Promise<string | null> {
  return new Promise((resolve) => {
    const choiceId = `choice_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const wrappedResolve = (value: string | null) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve(value);
    };

    useUserChoiceStore.getState().actions.addPendingChoice({
      id: choiceId,
      runKey,
      executionId,
      prompt,
      choices,
      resolve: wrappedResolve,
    });

    const agentBeepSound = useProfileStore.getState().currentProfile?.settings?.chat?.agentBeepSound;
    if (agentBeepSound) {
      playBeepSound(agentBeepSound);
    }

    if (timeoutSeconds > 0) {
      timeoutHandle = setTimeout(() => {
        useUserChoiceStore.getState().actions.resolveChoice(choiceId, null);
      }, timeoutSeconds * 1000);
    }
  });
}

const executeUserChoiceNode: NodeExecutor = async (node, inputs, context, agent): Promise<NodeExecutionResult> => {
  const cfg = (node.config || DEFAULT_CONFIG) as UserChoiceNodeConfig;
  const mode = cfg.mode ?? "script";

  const outgoing = agent.edges.filter((e) => e.source === node.id);
  const wantText = mode === "script" || outgoing.some((e) => e.sourceHandle === "out-string");
  const wantTool = mode === "tool" || outgoing.some((e) => e.sourceHandle === "out-toolset");

  const textHandleKey = `${node.id}::out-string`;
  const toolsetHandleKey = `${node.id}::out-toolset`;

  if (wantTool && !wantText) {
    const tool: WorkflowToolDefinition = {
      name: cfg.toolName || "userChoice",
      description: cfg.toolDescription || DEFAULT_CONFIG.toolDescription,
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "The question or prompt to show the user" },
          choices: {
            type: "array",
            items: { type: "string" },
            description: "List of choices for the user to pick from",
          },
        },
        required: ["prompt", "choices"],
      },
      invoke: async (args: { prompt?: string; choices?: string[] }) => {
        const prompt = args.prompt || cfg.prompt;
        const choices = parseChoices(args.choices, cfg.choices);
        if (choices.length === 0) {
          return "No choices provided";
        }

        if (!context.isRunning) {
          throw new Error("Workflow cancelled");
        }

        const selected = await createPendingChoice(context.runKey, context.executionId, prompt, choices, cfg.timeoutSeconds);
        if (selected === null) {
          throw new Error("Workflow cancelled");
        }
        return selected;
      },
    };

    context.nodeValues.set(toolsetHandleKey, [tool]);
    return { success: true, value: [tool] };
  }

  const prompt = typeof inputs.prompt === "string" ? inputs.prompt : cfg.prompt;
  const choices = parseChoices(inputs.choices, cfg.choices);

  if (choices.length === 0) {
    return { success: false, error: "User choice node has no choices configured" };
  }

  const selected = await createPendingChoice(context.runKey, context.executionId, prompt, choices, cfg.timeoutSeconds);

  if (selected === null) {
    return { success: false, error: "User cancelled the choice" };
  }

  context.nodeValues.set(textHandleKey, selected);
  return { success: true, value: selected };
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const SCRIPT_OUTPUTS: NodeOutput[] = [{ id: "out-string", label: "Selected Choice", edgeType: "string" }];
const TOOL_OUTPUTS: NodeOutput[] = [{ id: "out-toolset", label: "Toolset", edgeType: "toolset" }];

const USER_CHOICE_NODE_METADATA = {
  type: "userChoice",
  label: "User Choice",
  description: "Present the user with multiple-choice options and wait for their selection",
  icon: ListChecks,
  category: "Chat",
  theme: createNodeTheme("pink"),
  deletable: true,
  inputs: [
    { id: "in-prompt", label: "Prompt", edgeType: "string" as const, targetRef: "prompt-section" },
    { id: "in-choices", label: "Choices (JSON Array)", edgeType: "string" as const, targetRef: "choices-section" },
  ] as NodeInput[],
  outputs: SCRIPT_OUTPUTS,
  defaultConfig: DEFAULT_CONFIG,
};

function getOutputsForMode(mode?: "script" | "tool"): NodeOutput[] {
  if (mode === "tool") {
    return TOOL_OUTPUTS;
  }
  return SCRIPT_OUTPUTS;
}

namespace UserChoiceNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: USER_CHOICE_NODE_METADATA.label,
      config: USER_CHOICE_NODE_METADATA.defaultConfig,
    };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface UserChoiceConfigDialogProps {
  open: boolean;
  initialConfig: UserChoiceNodeConfig;
  onSave: (config: UserChoiceNodeConfig) => void;
  onCancel: () => void;
}

const UserChoiceConfigDialog: React.FC<UserChoiceConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch, setValue } = useForm<UserChoiceNodeConfig>({
    defaultValues: { ...DEFAULT_CONFIG, ...initialConfig },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset only when dialog opens
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset]);

  const currentMode = watch("mode");
  const currentChoices = watch("choices");
  const currentTimeout = watch("timeoutSeconds");
  const onSubmit = (data: UserChoiceNodeConfig) => onSave(data);

  const handleAddChoice = () => {
    setValue("choices", [...(currentChoices ?? []), ""], { shouldDirty: true });
  };

  const handleRemoveChoice = (index: number) => {
    setValue(
      "choices",
      (currentChoices ?? []).filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const handleChoiceChange = (index: number, value: string) => {
    const updated = [...(currentChoices ?? [])];
    updated[index] = value;
    setValue("choices", updated, { shouldDirty: true });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Configure User Choice
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
                      <span className="font-semibold">Script</span> — Pauses the workflow and waits for the user to select a choice. The selected value flows to the next node.
                    </p>
                    <p>
                      <span className="font-semibold">Tool</span> — Exposes a callable tool for Agent nodes. The agent can invoke it with a dynamic prompt and choices.
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

              {/* Tool Name + Description — only in tool mode */}
              {currentMode === "tool" && (
                <>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Tool Name</Label>
                    <Controller name="toolName" control={control} render={({ field }) => <Input {...field} placeholder="userChoice" className="text-xs h-8" />} />
                    <p className="text-xxs text-muted-foreground mt-1">Identifier the LLM uses to invoke this tool. Use camelCase with no spaces.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label className="text-xs font-medium">Tool Description</Label>
                      <HelpTooltip>
                        This description is sent directly to the model. It tells the LLM what this tool does and when to call it — be specific so the agent knows when to invoke it and what to expect
                        at runtime.
                      </HelpTooltip>
                    </div>
                    <Controller
                      name="toolDescription"
                      control={control}
                      render={({ field }) => <Textarea {...field} rows={3} placeholder="Present the user with a multiple-choice prompt and return their selection" className="text-xs resize-none" />}
                    />
                  </div>
                </>
              )}

              {/* Prompt + Choices — only in script mode */}
              {currentMode === "script" && (
                <>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Label className="text-xs font-medium">Default Prompt</Label>
                      <HelpTooltip>
                        <span className="text-xs">
                          Used when no <strong>Prompt</strong> input is connected. Connecting a string input overrides this at runtime.
                        </span>
                      </HelpTooltip>
                    </div>
                    <Controller name="prompt" control={control} render={({ field }) => <Input {...field} placeholder="What would you like to do?" className="text-xs h-8" />} />
                  </div>

                  {/* Choices list */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium">Default Choices</Label>
                        <HelpTooltip>
                          <div className="space-y-2 text-xs">
                            <p>
                              Used when no <strong>Choices (JSON Array)</strong> input is connected.
                            </p>
                            <p>When an input is connected, it must be a JSON string in one of these formats:</p>
                            <div className="font-mono text-[11px] bg-muted/60 rounded p-1.5 space-y-0.5">
                              <p className="text-muted-foreground">{"// Simple labels"}</p>
                              <p>{'["A", "B", "C"]'}</p>
                            </div>
                            <div className="font-mono text-[11px] bg-muted/60 rounded p-1.5 space-y-0.5">
                              <p className="text-muted-foreground">{"// Custom values"}</p>
                              <p>{'[{"label":"Go left",\n  "value":"left"}]'}</p>
                            </div>
                          </div>
                        </HelpTooltip>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10" onClick={handleAddChoice} title="Add choice">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
                      {(currentChoices ?? []).map((choice, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: order is stable for this list
                        <div key={index} className="flex items-center gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0 cursor-grab" />
                          <Input value={choice} onChange={(e) => handleChoiceChange(index, e.target.value)} placeholder={`Option ${index + 1}`} className="text-xs h-7 flex-1" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                            onClick={() => handleRemoveChoice(index)}
                            title="Remove choice"
                            disabled={(currentChoices ?? []).length <= 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {(currentChoices ?? []).length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">No choices. Click + to add one.</p>}
                    </div>
                  </div>
                </>
              )}

              {/* Timeout */}
              <Controller
                name="timeoutSeconds"
                control={control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium">Timeout</Label>
                        <HelpTooltip>
                          <span className="text-xs">How long to wait for the user to select a choice before auto-cancelling. Set to 0 to wait indefinitely.</span>
                        </HelpTooltip>
                      </div>
                      <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-0.5 rounded-md">{currentTimeout === 0 ? "No timeout" : `${currentTimeout}s`}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={300}
                      step={5}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="w-full h-1.5 accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-xxs text-muted-foreground">
                      <span>No timeout</span>
                      <span>5 min</span>
                    </div>
                  </div>
                )}
              />
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

const UserChoiceContent = memo<{ nodeId: string; config: UserChoiceNodeConfig; onConfigure: () => void }>(({ nodeId, config, onConfigure }) => {
  const edges = useStore((state) => state.edges);
  const isPromptConnected = useMemo(() => edges.some((edge) => edge.target === nodeId && edge.targetHandle === "in-prompt"), [edges, nodeId]);
  const isChoicesConnected = useMemo(() => edges.some((edge) => edge.target === nodeId && edge.targetHandle === "in-choices"), [edges, nodeId]);
  const isToolMode = config.mode === "tool";

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xxs font-bold tracking-wider uppercase ${
            isToolMode ? "bg-pink-400/20 text-pink-500 dark:text-pink-300" : "bg-pink-400/10 text-pink-600 dark:text-pink-400"
          }`}
        >
          {isToolMode ? "Tool" : "Script"}
        </span>
        <NodeConfigButton onClick={onConfigure} title="Configure user choice" />
      </div>

      {isToolMode ? (
        <>
          <NodeField label="Tool Name" icon={Type}>
            <NodeConfigPreview variant="text" empty="userChoice">
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
          <NodeField label="Prompt" icon={MessageSquareMore} refId="prompt-section">
            <NodeConfigPreview variant="text">
              {isPromptConnected ? (
                <span className="text-pink-500 dark:text-pink-400 font-medium not-italic text-xxs">↳ Receiving from input</span>
              ) : (
                config.prompt || <span className="italic">No prompt configured</span>
              )}
            </NodeConfigPreview>
          </NodeField>
          <NodeField
            label="Choices"
            icon={Type}
            refId="choices-section"
            helpText={
              <div className="space-y-2 text-xs">
                <p>Connect a JSON string. Accepted formats:</p>
                <div className="space-y-1 font-mono text-[11px] bg-muted/60 rounded p-1.5">
                  <p className="text-muted-foreground">{"// Simple string array"}</p>
                  <p>{'["A", "B", "C"]'}</p>
                </div>
                <div className="space-y-1 font-mono text-[11px] bg-muted/60 rounded p-1.5">
                  <p className="text-muted-foreground">{"// Label/value pairs"}</p>
                  <p>{'[{"label":"Go left","value":"left"}]'}</p>
                </div>
                <p className="text-muted-foreground">When connected, overrides the default choices configured below.</p>
              </div>
            }
          >
            <NodeConfigPreview variant="badge">
              {isChoicesConnected ? (
                <span className="text-pink-500 dark:text-pink-400 font-medium text-xxs">↳ Receiving from input</span>
              ) : config.choices.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {config.choices.slice(0, 3).map((choice) => (
                    <span key={choice} className="inline-flex items-center px-1.5 py-0.5 rounded bg-pink-400/15 text-pink-600 dark:text-pink-300 text-xxs font-medium truncate max-w-[80px]">
                      {choice}
                    </span>
                  ))}
                  {config.choices.length > 3 && <span className="text-xxs text-muted-foreground">+{config.choices.length - 3} more</span>}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">No choices configured</span>
              )}
            </NodeConfigPreview>
          </NodeField>
        </>
      )}
    </div>
  );
});

UserChoiceContent.displayName = "UserChoiceContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const UserChoiceNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DEFAULT_CONFIG) as UserChoiceNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const handleConfigSave = useCallback(
    (newConfig: UserChoiceNodeConfig) => {
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
        <UserChoiceContent nodeId={id} config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <UserChoiceConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

UserChoiceNode.displayName = "UserChoiceNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: USER_CHOICE_NODE_METADATA,
  component: UserChoiceNode,
  configProvider: UserChoiceNodeConfigProvider,
  executor: executeUserChoiceNode,
  getDynamicOutputs: (config) => getOutputsForMode((config as UserChoiceNodeConfig)?.mode),
});

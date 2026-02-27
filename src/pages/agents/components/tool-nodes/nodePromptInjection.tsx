import { useReactFlow, useStore } from "@xyflow/react";
import { Cpu, MessageSquareDiff, PersonStanding, Sparkles, UserRound } from "lucide-react";
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
import { useChatStore } from "@/hooks/chatStore";
import type { PromptConfig } from "@/schema/chat-message-schema";
import type { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { getNextMessagePosition } from "@/services/chat-message-service";
import { NodeBase, type NodeInput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PromptInjectionNodeConfig {
  behavior: PromptConfig["behavior"];
  role: PromptConfig["role"];
  position: PromptConfig["position"];
  depth: number;
  globalType: string;
  scopeToAgent: boolean;
}

const DEFAULT_CONFIG: PromptInjectionNodeConfig = {
  behavior: "next",
  role: "system",
  position: "bottom",
  depth: 1,
  globalType: "",
  scopeToAgent: false,
};

// ─── Executor ──────────────────────────────────────────────────────────────────

const executePromptInjectionNode: NodeExecutor = async (node, inputs, _context, agent): Promise<NodeExecutionResult> => {
  const response: string = typeof inputs.response === "string" ? inputs.response : "";

  if (!response.trim()) {
    return { success: false, error: "Prompt injection node missing prompt content" };
  }

  const config = (node.config || DEFAULT_CONFIG) as PromptInjectionNodeConfig;

  try {
    const store = useChatStore.getState();
    const chatId = store.selectedChat?.id;
    const chapterId = store.selectedChat?.active_chapter_id;

    if (!chatId || !chapterId) {
      return { success: false, error: "No active chat/chapter to write prompt injection" };
    }

    const position = await getNextMessagePosition(chatId, chapterId);
    await store.actions.addChatMessage({
      character_id: null,
      type: "system",
      messages: [response],
      position,
      disabled: false,
      tokens: null,
      extra: {
        script: "agent",
        name: agent.name,
        agentId: agent.id,
        promptConfig: {
          behavior: config.behavior,
          role: config.role,
          position: config.position,
          depth: config.depth,
          globalType: config.globalType || undefined,
          scopeToAgent: config.scopeToAgent,
        },
      },
    });

    return { success: true, value: response };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to write prompt injection";
    return { success: false, error: message };
  }
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const PROMPT_INJECTION_NODE_METADATA = {
  type: "promptInjection",
  label: "Prompt Injection",
  category: "Chat",
  description: "Inject a dynamic prompt into the next or all future generations",
  icon: MessageSquareDiff,
  theme: createNodeTheme("indigo"),
  deletable: true,
  inputs: [{ id: "response", label: "Prompt Content", edgeType: "string" as const, targetRef: "response-section" }] as NodeInput[],
  outputs: [],
  defaultConfig: DEFAULT_CONFIG,
};

namespace PromptInjectionNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: PROMPT_INJECTION_NODE_METADATA.label,
      config: PROMPT_INJECTION_NODE_METADATA.defaultConfig,
    };
  }
}

// ─── Config Dialog ─────────────────────────────────────────────────────────────

interface PromptInjectionConfigDialogProps {
  open: boolean;
  initialConfig: PromptInjectionNodeConfig;
  onSave: (config: PromptInjectionNodeConfig) => void;
  onCancel: () => void;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "user":
      return <UserRound className="h-3.5 w-3.5" />;
    case "character":
      return <PersonStanding className="h-3.5 w-3.5" />;
    case "system":
      return <Sparkles className="h-3.5 w-3.5" />;
    default:
      return <Sparkles className="h-3.5 w-3.5" />;
  }
};

const PromptInjectionConfigDialog: React.FC<PromptInjectionConfigDialogProps> = ({ open, initialConfig, onSave, onCancel }) => {
  const { control, handleSubmit, reset, watch, setValue } = useForm<PromptInjectionNodeConfig>({
    defaultValues: { ...DEFAULT_CONFIG, ...initialConfig },
  });

  useEffect(() => {
    if (open) {
      reset({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [open, reset, initialConfig]);

  const behavior = watch("behavior");
  const position = watch("position");
  const role = watch("role");
  const onSubmit = (data: PromptInjectionNodeConfig) => onSave(data);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareDiff className="h-4 w-4 text-primary" />
              Configure Prompt Injection
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3 py-2">
              {/* Row 1: Behavior */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Label className="text-xs font-medium">Behavior</Label>
                  <HelpTooltip>
                    <span className="text-xs">
                      <strong>Next Generation Only</strong> — injected once for the next character generation after this message. Has no effect if another user or character message follows it first.
                      <br />
                      <br />
                      <strong>Global (Persistent)</strong> — stays active for all future generations until superseded by another injection with the same Global Type tag.
                    </span>
                  </HelpTooltip>
                </div>
                <Controller
                  name="behavior"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="next" className="text-xs">
                          Next Generation Only
                        </SelectItem>
                        <SelectItem value="global" className="text-xs">
                          Global (Persistent)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Global options — compact, right below Behavior */}
              {behavior === "global" && (
                <div className="flex items-start gap-2 pl-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Label className="text-xs font-medium">Global Tag</Label>
                      <HelpTooltip>
                        <span className="text-xs">Injections with the same tag replace each other. Leave empty to never be replaced by another injection.</span>
                      </HelpTooltip>
                    </div>
                    <Controller name="globalType" control={control} render={({ field }) => <Input {...field} placeholder="e.g. mood, scene, instructions" className="text-xs h-8" />} />
                  </div>
                  <div className="flex flex-col items-center gap-1 pt-5">
                    <Controller name="scopeToAgent" control={control} render={({ field }) => <Switch id="scopeToAgent" checked={field.value} onCheckedChange={field.onChange} />} />
                    <div className="flex items-center gap-1">
                      <Label htmlFor="scopeToAgent" className="text-xxs text-muted-foreground cursor-pointer whitespace-nowrap">
                        Agent only
                      </Label>
                      <HelpTooltip>
                        <span className="text-xs">When enabled, the tag is scoped to this specific agent. Injections from other agents with the same tag won't replace this one.</span>
                      </HelpTooltip>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 2: Role + Position */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1 block">Role</Label>
                  <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          if ((value === "system" || value === "character") && (position === "before_user_input" || position === "after_user_input")) {
                            setValue("position", "bottom");
                          }
                        }}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue>
                            <div className="flex items-center gap-1.5">
                              {getRoleIcon(field.value)}
                              <span>{field.value.charAt(0).toUpperCase() + field.value.slice(1)}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system" className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              System
                            </div>
                          </SelectItem>
                          <SelectItem value="user" className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5" />
                              User
                            </div>
                          </SelectItem>
                          <SelectItem value="character" className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <PersonStanding className="h-3.5 w-3.5" />
                              Character
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Label className="text-xs font-medium">Position</Label>
                  </div>
                  <Controller
                    name="position"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top" className="text-xs">
                            Top of Conversation
                          </SelectItem>
                          <SelectItem value="bottom" className="text-xs">
                            Bottom of Conversation
                          </SelectItem>
                          <SelectItem value="depth" className="text-xs">
                            At Specific Depth
                          </SelectItem>
                          {role === "user" && (
                            <SelectItem value="before_user_input" className="text-xs">
                              Before User Input Text
                            </SelectItem>
                          )}
                          {role === "user" && (
                            <SelectItem value="after_user_input" className="text-xs">
                              After User Input Text
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {/* Depth slider */}
              {position === "depth" && (
                <Controller
                  name="depth"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-medium">Depth</Label>
                        <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-0.5 rounded-md">{field.value}</span>
                      </div>
                      <Slider min={1} max={50} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} className="py-1" />
                    </div>
                  )}
                />
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

const BEHAVIOR_LABELS: Record<PromptConfig["behavior"], string> = {
  next: "Next Gen",
  global: "Global",
};

const POSITION_LABELS: Record<PromptConfig["position"], string> = {
  top: "Top",
  bottom: "Bottom",
  depth: "Depth",
  before_user_input: "Before User",
  after_user_input: "After User",
};

const PromptInjectionContent = memo<{ nodeId: string; config: PromptInjectionNodeConfig; onConfigure: () => void }>(({ nodeId, config, onConfigure }) => {
  const edges = useStore((state) => state.edges);
  const isResponseConnected = useMemo(() => edges.some((edge) => edge.target === nodeId && edge.targetHandle === "response"), [edges, nodeId]);

  return (
    <div className="space-y-3 w-full">
      <NodeField label="Injection Config" icon={Cpu} action={<NodeConfigButton onClick={onConfigure} title="Configure injection" />}>
        <NodeConfigPreview
          variant="key-value"
          items={[
            { label: "Behavior", value: BEHAVIOR_LABELS[config.behavior] },
            { label: "Role", value: config.role.charAt(0).toUpperCase() + config.role.slice(1) },
            { label: "Position", value: config.position === "depth" ? `Depth ${config.depth}` : POSITION_LABELS[config.position] },
            ...(config.behavior === "global" && config.globalType ? [{ label: "Tag", value: config.globalType }] : []),
          ]}
        />
      </NodeField>
      <NodeField label="Prompt Content" icon={MessageSquareDiff} refId="response-section">
        <NodeConfigPreview variant="badge">
          {isResponseConnected ? <span className="text-xs text-muted-foreground italic">Receiving input...</span> : <span className="text-xs text-muted-foreground">Connect a prompt source</span>}
        </NodeConfigPreview>
      </NodeField>
    </div>
  );
});

PromptInjectionContent.displayName = "PromptInjectionContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const PromptInjectionNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const config = (data.config || DEFAULT_CONFIG) as PromptInjectionNodeConfig;
  const { setNodes } = useReactFlow();

  const handleConfigSave = useCallback(
    (newConfig: PromptInjectionNodeConfig) => {
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes],
  );

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <PromptInjectionContent nodeId={id} config={config} onConfigure={() => setConfigDialogOpen(true)} />
      </NodeBase>
      <PromptInjectionConfigDialog open={configDialogOpen} initialConfig={config} onSave={handleConfigSave} onCancel={() => setConfigDialogOpen(false)} />
    </>
  );
});

PromptInjectionNode.displayName = "PromptInjectionNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: PROMPT_INJECTION_NODE_METADATA,
  component: PromptInjectionNode,
  configProvider: PromptInjectionNodeConfigProvider,
  executor: executePromptInjectionNode,
});

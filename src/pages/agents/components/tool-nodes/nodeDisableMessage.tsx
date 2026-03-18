import { useReactFlow, useStore } from "@xyflow/react";
import { EyeOff, Filter, Hash, Layers, MessageSquare, SlidersHorizontal, User } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useChatStore } from "@/hooks/chatStore";
import type { ChatMessage } from "@/schema/chat-message-schema";
import { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { updateChatMessage as apiUpdateChatMessage } from "@/services/chat-message-service";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DisableMessageNodeConfig {
  name: string;
  disableMode: "all" | "lastN";
  count: number;
  senderFilter: "any" | "user" | "character" | "agent";
}

// ── Executor ──────────────────────────────────────────────────────────────────

/**
 * Resolves message IDs to disable from the provided inputs.
 * Priority: history input > messageIds input > config filter.
 */
function resolveTargetMessages(inputs: Record<string, unknown>, allMessages: ChatMessage[], config: DisableMessageNodeConfig): ChatMessage[] {
  // 1. history input (ChatMessage[])
  if (Array.isArray(inputs.history) && inputs.history.length > 0) {
    return (inputs.history as ChatMessage[]).filter((m) => typeof m?.id === "string" && m.id);
  }

  // 2. messageIds input (string | string[])
  const rawIds = inputs.messageIds;
  if (rawIds !== undefined && rawIds !== null && rawIds !== "") {
    let ids: string[] = [];
    if (Array.isArray(rawIds)) {
      ids = rawIds.filter((id): id is string => typeof id === "string" && id.trim() !== "");
    } else if (typeof rawIds === "string") {
      const trimmed = rawIds.trim();
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            ids = parsed.filter((id): id is string => typeof id === "string" && id.trim() !== "");
          }
        } catch {
          // fall through to single ID
        }
      }
      if (ids.length === 0 && trimmed) {
        ids = [trimmed];
      }
    }
    const idSet = new Set(ids);
    return allMessages.filter((m) => idSet.has(m.id));
  }

  // 3. Config filter mode
  let filtered = [...allMessages];

  switch (config.senderFilter) {
    case "user":
      filtered = filtered.filter((m) => m.type === "user");
      break;
    case "character":
      filtered = filtered.filter((m) => m.type === "character" && m.extra?.script !== "agent");
      break;
    case "agent":
      filtered = filtered.filter((m) => m.type === "character" && m.extra?.script === "agent");
      break;
    default:
      break;
  }

  const characterId = inputs.characterId;
  if (typeof characterId === "string" && characterId.trim()) {
    if (characterId === "user") {
      filtered = filtered.filter((m) => m.type === "user");
    } else {
      filtered = filtered.filter((m) => m.character_id === characterId);
    }
  }

  if (config.disableMode === "lastN") {
    filtered = filtered.slice(-Math.max(1, config.count));
  }

  return filtered;
}

const executeDisableMessageNode: NodeExecutor = async (node, inputs): Promise<NodeExecutionResult> => {
  try {
    const store = useChatStore.getState();
    const { selectedChatMessages } = store;
    const messages = Array.isArray(selectedChatMessages) ? selectedChatMessages : [];

    const config: DisableMessageNodeConfig = {
      name: "Disable Message Node",
      disableMode: "all",
      count: 1,
      senderFilter: "any",
      ...(node.config as Partial<DisableMessageNodeConfig>),
    };

    const targets = resolveTargetMessages(inputs, messages, config);

    // Skip already-disabled messages to avoid redundant writes
    const toDisable = targets.filter((m) => !m.disabled);

    if (toDisable.length === 0) {
      return { success: true, value: "0" };
    }

    const results = await Promise.allSettled(toDisable.map((m) => apiUpdateChatMessage(m.id, { disabled: true })));

    const disabledCount = results.filter((r) => r.status === "fulfilled" && r.value !== null).length;

    await store.actions.fetchChatMessages();

    return { success: true, value: String(disabledCount) };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to disable messages";
    return { success: false, error: message };
  }
};

// ── Metadata ──────────────────────────────────────────────────────────────────

const DISABLE_MESSAGE_NODE_METADATA = {
  type: "disableMessage",
  label: "Disable Message",
  category: "Chat",
  description: "Disable one or more chat messages by ID, history input, or config-based filter",
  icon: EyeOff,
  theme: createNodeTheme("yellow"),
  deletable: true,
  inputs: [
    { id: "in-message-ids", label: "Message IDs", edgeType: "string" as const, targetRef: "message-ids-section" },
    { id: "in-history", label: "Chat History", edgeType: "message-list" as const, targetRef: "history-section" },
    { id: "in-character", label: "Character ID", edgeType: "string" as const, targetRef: "character-section" },
  ] as NodeInput[],
  outputs: [] as NodeOutput[],
  defaultConfig: {
    name: "Disable Message Node",
    disableMode: "all" as const,
    count: 1,
    senderFilter: "any" as const,
  } as DisableMessageNodeConfig,
};

// ── Config provider ───────────────────────────────────────────────────────────

namespace DisableMessageNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: DISABLE_MESSAGE_NODE_METADATA.label,
      config: DISABLE_MESSAGE_NODE_METADATA.defaultConfig,
    };
  }
}

// ── Config dialog ─────────────────────────────────────────────────────────────

export interface DisableMessageNodeConfigDialogProps {
  open: boolean;
  initialConfig: DisableMessageNodeConfig;
  hasInputOverride: boolean;
  onSave: (config: DisableMessageNodeConfig) => void;
  onCancel: () => void;
}

const DisableMessageNodeConfigDialog: React.FC<DisableMessageNodeConfigDialogProps> = ({ open, initialConfig, hasInputOverride, onSave, onCancel }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = useForm<DisableMessageNodeConfig>({
    defaultValues: initialConfig,
    mode: "onChange",
  });

  const disableMode = useWatch({ control, name: "disableMode" });

  useEffect(() => {
    if (open) {
      reset(initialConfig);
    }
  }, [open, reset, initialConfig]);

  const onSubmit = (data: DisableMessageNodeConfig) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Disable Message</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4 py-2">
              <div>
                <Label className="text-xs font-medium text-foreground mb-1 block">Node Name</Label>
                <Controller name="name" control={control} render={({ field }) => <Input {...field} placeholder="Enter node name" className="text-xs" maxLength={64} autoFocus />} />
              </div>

              {hasInputOverride ? (
                <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                  Filter settings are unavailable — Message IDs or Chat History input is connected and takes priority.
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs font-medium text-foreground mb-1 block">Sender Filter</Label>
                    <Controller
                      name="senderFilter"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Select sender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any Message</SelectItem>
                            <SelectItem value="user">User Only</SelectItem>
                            <SelectItem value="character">Character Only</SelectItem>
                            <SelectItem value="agent">Agent Only</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-foreground mb-1 block">Disable Mode</Label>
                    <Controller
                      name="disableMode"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Matching</SelectItem>
                            <SelectItem value="lastN">Last N Matching</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {disableMode === "lastN" && (
                    <Controller
                      name="count"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <Label className="text-xs font-medium">Message Count</Label>
                            <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-0.5 rounded-md">{field.value}</span>
                          </div>
                          <Slider min={1} max={500} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} className="py-1" />
                        </div>
                      )}
                    />
                  )}
                </>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} size="dialog">
              Cancel
            </Button>
            <Button type="submit" size="dialog" disabled={!isDirty || !isValid}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Node body content ─────────────────────────────────────────────────────────

function getSenderFilterLabel(filter: string): string {
  switch (filter) {
    case "user":
      return "User Only";
    case "character":
      return "Character Only";
    case "agent":
      return "Agent Only";
    default:
      return "Any Message";
  }
}

interface DisableMessageContentProps {
  nodeId: string;
  config: DisableMessageNodeConfig;
  onConfigure: () => void;
}

const DisableMessageContent = memo<DisableMessageContentProps>(({ nodeId, config, onConfigure }) => {
  const edges = useStore((state) => state.edges);
  const hasInputOverride = useMemo(() => edges.some((e) => e.target === nodeId && (e.targetHandle === "in-message-ids" || e.targetHandle === "in-history")), [edges, nodeId]);

  return (
    <div className="space-y-3 w-full">
      <NodeField
        label="Message IDs"
        icon={Hash}
        optional
        refId="message-ids-section"
        helpText={
          <>
            A single message ID string or a JSON array of IDs, e.g. <code>["id-1","id-2"]</code>. When connected, config filters are ignored.
          </>
        }
      />
      <NodeField
        label="Chat History"
        icon={MessageSquare}
        optional
        refId="history-section"
        helpText="A ChatMessage[] array. Every message in the array will be disabled. When connected, config filters are ignored."
      />
      <NodeField
        label="Character ID"
        icon={User}
        optional
        disabled={hasInputOverride}
        refId="character-section"
        helpText="Narrows config-mode filter to a specific character or 'user'. Has no effect when Message IDs or Chat History inputs are connected."
      />

      <NodeField label="Configuration" icon={SlidersHorizontal} disabled={hasInputOverride} action={<NodeConfigButton onClick={onConfigure} title="Configure disable settings" />}>
        <NodeConfigPreview
          items={[
            { label: "Mode", value: config.disableMode === "lastN" ? `Last ${config.count}` : "All matching", icon: Layers },
            { label: "Filter", value: getSenderFilterLabel(config.senderFilter), icon: Filter },
          ]}
        />
      </NodeField>
    </div>
  );
});

DisableMessageContent.displayName = "DisableMessageContent";

// ── Node component ────────────────────────────────────────────────────────────

export const DisableMessageNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DISABLE_MESSAGE_NODE_METADATA.defaultConfig) as DisableMessageNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  const hasInputOverride = useStore(useCallback((state) => state.edges.some((e) => e.target === id && (e.targetHandle === "in-message-ids" || e.targetHandle === "in-history")), [id]));

  const handleConfigSave = useCallback(
    (newConfig: DisableMessageNodeConfig) => {
      takeSnapshot();
      setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, config: newConfig } } : node)));
      setConfigDialogOpen(false);
    },
    [id, setNodes, takeSnapshot],
  );

  const handleConfigCancel = useCallback(() => setConfigDialogOpen(false), []);
  const handleConfigure = useCallback(() => setConfigDialogOpen(true), []);

  return (
    <>
      <NodeBase nodeId={id} data={data} selected={!!selected}>
        <DisableMessageContent nodeId={id} config={config} onConfigure={handleConfigure} />
      </NodeBase>

      <DisableMessageNodeConfigDialog open={configDialogOpen} initialConfig={config} hasInputOverride={hasInputOverride} onSave={handleConfigSave} onCancel={handleConfigCancel} />
    </>
  );
});

DisableMessageNode.displayName = "DisableMessageNode";

// ── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: DISABLE_MESSAGE_NODE_METADATA,
  component: DisableMessageNode,
  configProvider: DisableMessageNodeConfigProvider,
  executor: executeDisableMessageNode,
});

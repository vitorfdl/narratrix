import { useReactFlow, useStore } from "@xyflow/react";
import { Filter, Hash, Layers, MessageSquare, SlidersHorizontal, Trash2, User } from "lucide-react";
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
import { deleteChatMessage as apiDeleteChatMessage, updateChatMessagesUsingFilter } from "@/services/chat-message-service";
import { useTakeSnapshot } from "../../hooks/useUndoRedo";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeConfigButton, NodeConfigPreview, NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import { NodeProps } from "./nodeTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeleteMessageNodeConfig {
  name: string;
  deleteMode: "all" | "lastN";
  count: number;
  senderFilter: "any" | "user" | "character" | "agent";
}

// ── Executor ──────────────────────────────────────────────────────────────────

/**
 * Resolves message IDs to delete from the provided inputs.
 * Priority: history input > messageIds input > config filter.
 */
function resolveTargetIds(inputs: Record<string, unknown>, allMessages: ChatMessage[], config: DeleteMessageNodeConfig): string[] {
  // 1. history input (ChatMessage[])
  if (Array.isArray(inputs.history) && inputs.history.length > 0) {
    return (inputs.history as ChatMessage[]).filter((m) => typeof m?.id === "string" && m.id).map((m) => m.id);
  }

  // 2. messageIds input (string | string[])
  const rawIds = inputs.messageIds;
  if (rawIds !== undefined && rawIds !== null && rawIds !== "") {
    if (Array.isArray(rawIds)) {
      return rawIds.filter((id): id is string => typeof id === "string" && id.trim() !== "");
    }
    if (typeof rawIds === "string") {
      const trimmed = rawIds.trim();
      // Attempt JSON parse for arrays
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.filter((id): id is string => typeof id === "string" && id.trim() !== "");
          }
        } catch {
          // fall through to treating as single ID
        }
      }
      return trimmed ? [trimmed] : [];
    }
  }

  // 3. Config filter mode
  let filtered = [...allMessages];

  // Sender filter
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
      // "any" — no type filter
      break;
  }

  // Narrow by character ID if provided
  const characterId = inputs.characterId;
  if (typeof characterId === "string" && characterId.trim()) {
    if (characterId === "user") {
      filtered = filtered.filter((m) => m.type === "user");
    } else {
      filtered = filtered.filter((m) => m.character_id === characterId);
    }
  }

  // Last N
  if (config.deleteMode === "lastN") {
    filtered = filtered.slice(-Math.max(1, config.count));
  }

  return filtered.map((m) => m.id);
}

const executeDeleteMessageNode: NodeExecutor = async (node, inputs): Promise<NodeExecutionResult> => {
  try {
    const store = useChatStore.getState();
    const { selectedChatMessages } = store;
    const messages = Array.isArray(selectedChatMessages) ? selectedChatMessages : [];

    const config: DeleteMessageNodeConfig = {
      name: "Delete Message Node",
      deleteMode: "all",
      count: 1,
      senderFilter: "any",
      ...(node.config as Partial<DeleteMessageNodeConfig>),
    };

    const targetIds = resolveTargetIds(inputs, messages, config);

    if (targetIds.length === 0) {
      return { success: true, value: "0" };
    }

    // Build a lookup for fast access
    const messageMap = new Map(messages.map((m) => [m.id, m]));

    let deletedCount = 0;
    const summaryReEnablePromises: Promise<number>[] = [];

    for (const id of targetIds) {
      const message = messageMap.get(id);

      // Before deleting a summary, re-enable the messages it covered
      if (message?.type === "system" && message.extra?.script === "summary") {
        const startPosition = message.extra?.startPosition;
        if (typeof startPosition === "number") {
          summaryReEnablePromises.push(
            updateChatMessagesUsingFilter(
              {
                position_gte: startPosition,
                position_lt: message.position,
                not_type: "system",
              },
              { disabled: false },
            ),
          );
        }
      }
    }

    // Flush all summary re-enables before deleting
    if (summaryReEnablePromises.length > 0) {
      await Promise.all(summaryReEnablePromises);
    }

    // Delete each message; skip silently if not found (already deleted / wrong id)
    const deleteResults = await Promise.allSettled(targetIds.map((id) => apiDeleteChatMessage(id)));
    for (const result of deleteResults) {
      if (result.status === "fulfilled" && result.value === true) {
        deletedCount++;
      }
    }

    // Sync store after bulk operation
    await store.actions.fetchChatMessages();

    return { success: true, value: String(deletedCount) };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to delete messages";
    return { success: false, error: message };
  }
};

// ── Metadata ──────────────────────────────────────────────────────────────────

const DELETE_MESSAGE_NODE_METADATA = {
  type: "deleteMessage",
  label: "Delete Message",
  category: "Chat",
  description: "Delete one or more chat messages by ID, history input, or config-based filter",
  icon: Trash2,
  theme: createNodeTheme("red"),
  deletable: true,
  inputs: [
    { id: "in-message-ids", label: "Message IDs", edgeType: "string" as const, targetRef: "message-ids-section" },
    { id: "in-history", label: "Chat History", edgeType: "message-list" as const, targetRef: "history-section" },
    { id: "in-character", label: "Character ID", edgeType: "string" as const, targetRef: "character-section" },
  ] as NodeInput[],
  outputs: [{ id: "out-deleted-count", label: "Deleted Count", edgeType: "string" as const }] as NodeOutput[],
  defaultConfig: {
    name: "Delete Message Node",
    deleteMode: "all" as const,
    count: 1,
    senderFilter: "any" as const,
  } as DeleteMessageNodeConfig,
};

// ── Config provider ───────────────────────────────────────────────────────────

namespace DeleteMessageNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: DELETE_MESSAGE_NODE_METADATA.label,
      config: DELETE_MESSAGE_NODE_METADATA.defaultConfig,
    };
  }
}

// ── Config dialog ─────────────────────────────────────────────────────────────

export interface DeleteMessageNodeConfigDialogProps {
  open: boolean;
  initialConfig: DeleteMessageNodeConfig;
  hasInputOverride: boolean;
  onSave: (config: DeleteMessageNodeConfig) => void;
  onCancel: () => void;
}

const DeleteMessageNodeConfigDialog: React.FC<DeleteMessageNodeConfigDialogProps> = ({ open, initialConfig, hasInputOverride, onSave, onCancel }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = useForm<DeleteMessageNodeConfig>({
    defaultValues: initialConfig,
    mode: "onChange",
  });

  const deleteMode = useWatch({ control, name: "deleteMode" });

  useEffect(() => {
    if (open) {
      reset(initialConfig);
    }
  }, [open, reset, initialConfig]);

  const onSubmit = (data: DeleteMessageNodeConfig) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent size="default">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Configure Delete Message</DialogTitle>
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
                    <Label className="text-xs font-medium text-foreground mb-1 block">Delete Mode</Label>
                    <Controller
                      name="deleteMode"
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

                  {deleteMode === "lastN" && (
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

interface DeleteMessageContentProps {
  nodeId: string;
  config: DeleteMessageNodeConfig;
  onConfigure: () => void;
}

const DeleteMessageContent = memo<DeleteMessageContentProps>(({ nodeId, config, onConfigure }) => {
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
        helpText="A ChatMessage[] array. Every message in the array will be deleted. When connected, config filters are ignored."
      />
      <NodeField
        label="Character ID"
        icon={User}
        optional
        refId="character-section"
        helpText="Narrows config-mode filter to a specific character or 'user'. Has no effect when Message IDs or Chat History inputs are connected."
      />

      <NodeField label="Configuration" icon={SlidersHorizontal} action={<NodeConfigButton onClick={onConfigure} title="Configure delete settings" />}>
        <NodeConfigPreview
          className={hasInputOverride ? "opacity-40" : undefined}
          items={[
            { label: "Mode", value: config.deleteMode === "lastN" ? `Last ${config.count}` : "All matching", icon: Layers },
            { label: "Filter", value: getSenderFilterLabel(config.senderFilter), icon: Filter },
          ]}
        />
      </NodeField>
    </div>
  );
});

DeleteMessageContent.displayName = "DeleteMessageContent";

// ── Node component ────────────────────────────────────────────────────────────

export const DeleteMessageNode = memo(({ id, data, selected }: NodeProps) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const config = (data.config || DELETE_MESSAGE_NODE_METADATA.defaultConfig) as DeleteMessageNodeConfig;
  const takeSnapshot = useTakeSnapshot();

  // Derived boolean selector — only re-renders when the value actually changes
  const hasInputOverride = useStore(useCallback((state) => state.edges.some((e) => e.target === id && (e.targetHandle === "in-message-ids" || e.targetHandle === "in-history")), [id]));

  const handleConfigSave = useCallback(
    (newConfig: DeleteMessageNodeConfig) => {
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
        <DeleteMessageContent nodeId={id} config={config} onConfigure={handleConfigure} />
      </NodeBase>

      <DeleteMessageNodeConfigDialog open={configDialogOpen} initialConfig={config} hasInputOverride={hasInputOverride} onSave={handleConfigSave} onCancel={handleConfigCancel} />
    </>
  );
});

DeleteMessageNode.displayName = "DeleteMessageNode";

// ── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: DELETE_MESSAGE_NODE_METADATA,
  component: DeleteMessageNode,
  configProvider: DeleteMessageNodeConfigProvider,
  executor: executeDeleteMessageNode,
});

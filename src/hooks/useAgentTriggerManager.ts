import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAgents } from "@/hooks/agentStore";
import { useChatStore } from "@/hooks/chatStore";
import type { AgentTriggerType, TriggerContext } from "@/schema/agent-schema";
import { isWorkflowRunning } from "@/services/agent-workflow/runner";
import type { ChatEvent } from "@/services/chat-event-bus";
import { chatEventBus } from "@/services/chat-event-bus";
import { getAgentTriggerConfig } from "@/services/chat-generation-orchestrator";
import { useAgentWorkflow } from "./useAgentWorkflow";

/**
 * Maps a ChatEvent type to the AgentTriggerType(s) that should fire for it.
 *
 * Note: "every_x_messages" is checked separately using per-agent counters that
 * increment on every after_participant_message / after_user_message event.
 * The dedicated "message_count" event type is kept for forward-compat but not
 * currently emitted.
 */
const EVENT_TO_TRIGGER_TYPES: Record<string, AgentTriggerType[]> = {
  after_user_message: ["after_user_message", "after_any_message"],
  before_user_message: ["before_user_message", "before_any_message"],
  after_participant_message: ["after_any_message", "after_character_message"],
  before_participant_message: ["before_any_message", "before_character_message"],
  after_all_participants: ["after_all_participants"],
  message_count: ["every_x_messages"],
};

/** Event types that increment the per-agent every_x_messages counter */
const COUNTER_EVENT_TYPES = new Set<string>(["after_user_message", "after_participant_message"]);

/**
 * useAgentTriggerManager
 *
 * Mounts inside a chat context and subscribes to the Chat Event Bus.
 * For each event, checks which agent participants have matching trigger
 * configurations and executes their workflows.
 *
 * Events with `source === "system"` are skipped — these come from the
 * orchestrated generation loop (WidgetGenerate) which handles agent triggers
 * directly and synchronously.  Skipping them prevents double-firing and
 * ensures agents never cascade into triggering other agents.
 */
export function useAgentTriggerManager(chatId: string) {
  const agentList = useAgents();
  const { executeWorkflow } = useAgentWorkflow();

  // Per-agent message counters for "every_x_messages" triggers.
  // Incremented on every after_participant_message and after_user_message event.
  const messageCounts = useRef<Map<string, number>>(new Map());

  // Reset message counts when chatId changes (ref mutation — no reactive deps needed)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional ref reset on chatId change
  useEffect(() => {
    messageCounts.current.clear();
  }, [chatId]);

  useEffect(() => {
    if (!chatId) {
      return;
    }

    const unsubscribe = chatEventBus.subscribe(async (event: ChatEvent) => {
      // Skip orchestrated-loop events — the orchestrator drives agent execution directly
      if (event.source === "system") {
        return;
      }

      const matchingTriggerTypes = EVENT_TO_TRIGGER_TYPES[event.type] ?? [];
      const isCounterEvent = COUNTER_EVENT_TYPES.has(event.type);

      if (matchingTriggerTypes.length === 0 && !isCounterEvent) {
        return;
      }

      // Get current participants for this chat from the store (not reactive - we read on event)
      const chatState = useChatStore.getState();
      const chat = chatState.selectedChat;
      const participants = chat?.participants ?? [];
      const userCharacterId = chat?.user_character_id ?? null;

      // Only consider agents that are enabled in this chat
      const agentParticipants = participants
        .filter((p) => p.enabled)
        .map((p) => agentList.find((a) => a.id === p.id))
        .filter((a) => a !== undefined);

      for (const agent of agentParticipants) {
        const { triggerType, messageCount } = getAgentTriggerConfig(agent);

        if (triggerType === "manual") {
          continue;
        }

        // ── every_x_messages ────────────────────────────────────────────────
        if (triggerType === "every_x_messages") {
          if (!isCounterEvent) {
            continue;
          }
          const threshold = messageCount ?? 5;
          const current = (messageCounts.current.get(agent.id) ?? 0) + 1;
          messageCounts.current.set(agent.id, current);
          if (current < threshold) {
            continue;
          }
          // Threshold reached — reset counter and fall through to fire the workflow
          messageCounts.current.set(agent.id, 0);
        } else if (!matchingTriggerTypes.includes(triggerType)) {
          continue;
        }

        // Don't re-trigger an already-running agent
        if (isWorkflowRunning(agent.id)) {
          continue;
        }

        const triggerContext: TriggerContext = {
          type: triggerType,
          chatId,
          message: event.message,
          // For participant-specific triggers, use the event's participant ID.
          // For all other triggers, fall back to the agent's own ID so downstream
          // nodes (e.g. Chat History) can filter by the agent itself.
          participantId: event.participantId ?? agent.id,
          userCharacterId,
          messageCount: event.messageCount,
        };

        // Fire-and-forget with error handling — don't block the event loop
        executeWorkflow(agent, triggerContext).catch((error: unknown) => {
          toast.error(`Agent ${agent.name} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        });
      }
    }, chatId);

    return unsubscribe;
  }, [chatId, agentList, executeWorkflow]);
}

/**
 * Chat Generation Orchestrator
 *
 * Provides an imperative, sequential generation loop that:
 * 1. Runs "before_user" + "before_any" agents and awaits them (blocking)
 * 2. Creates the user message
 * 3. Runs "after_user" + "after_any" agents (awaited)
 * 4. For each character participant in order:
 *    a. Runs "before_char" + "before_any" agents (blocking)
 *    b. Generates the character message
 *    c. Runs "after_char" + "after_any" agents (awaited)
 * 5. For each manual-agent participant: executes the workflow at its position
 * 6. After all participants: runs "after_all_participants" agents
 *
 * Using this instead of a fire-and-forget event model ensures:
 * - "Before" triggers properly block generation
 * - Participant order is respected for agent execution
 * - Agents never inadvertently trigger other agents (emitChatEvents: false passed to generateMessage)
 */

import type { TriggerNodeConfig } from "@/pages/agents/components/tool-nodes/nodeTrigger";
import type { AgentTriggerType, AgentType, TriggerContext } from "@/schema/agent-schema";
import type { ChatParticipant } from "@/schema/chat-schema";
import type { NodeExecutionResult } from "@/services/agent-workflow/types";
import type { GenerationOptions } from "@/services/inference/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrchestrationDeps {
  chatId: string;
  /** Ordered list of ALL participants from the chat (enabled and disabled) */
  participants: ChatParticipant[];
  /** Full agent list from the store */
  agents: AgentType[];
  /** The user's persona character ID (null if not set) */
  userCharacterId: string | null;
  /** Insert a user message into the chat */
  addUserMessage: (text: string) => Promise<void>;
  /** Execute an agent workflow */
  executeWorkflow: (agent: AgentType, ctx: TriggerContext, onProgress?: (nodeId: string, result: NodeExecutionResult) => void) => Promise<string | null>;
  /** Generate a character message (inference service) */
  generateMessage: (options: GenerationOptions) => Promise<string | null>;
  /** Resolves when the current streaming generation finishes */
  waitForGenerationToFinish: () => Promise<void>;
  /** Returns true if the user cancelled the generation */
  isAborted: () => boolean;
}

// Resolved trigger configuration for an agent participant
interface AgentParticipantConfig {
  participant: ChatParticipant;
  agent: AgentType;
  triggerType: AgentTriggerType;
  messageCount?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reads the trigger type from the agent's Trigger node config (preferred),
 * falling back to agent.settings.run_on.type.
 */
export function getAgentTriggerConfig(agent: AgentType): { triggerType: AgentTriggerType; messageCount?: number } {
  const triggerNode = agent.nodes?.find((n) => n.type === "trigger");
  if (triggerNode?.config) {
    const cfg = triggerNode.config as unknown as TriggerNodeConfig;
    return { triggerType: cfg.triggerType ?? "manual", messageCount: cfg.messageCount };
  }
  return {
    triggerType: agent.settings?.run_on?.type ?? "manual",
    messageCount: agent.settings?.run_on?.config?.messageCount,
  };
}

/**
 * Run all agents in `agentConfigs` whose triggerType matches any of `triggerTypes`, in order.
 * Each agent is awaited before the next one starts.
 */
async function runAgentsForTriggers(
  triggerTypes: AgentTriggerType[],
  agentConfigs: AgentParticipantConfig[],
  contextBase: Omit<TriggerContext, "type">,
  deps: Pick<OrchestrationDeps, "executeWorkflow" | "isAborted">,
): Promise<void> {
  for (const { agent, triggerType } of agentConfigs) {
    if (deps.isAborted()) {
      break;
    }
    if (!triggerTypes.includes(triggerType)) {
      continue;
    }

    const ctx: TriggerContext = { ...contextBase, type: triggerType };
    await deps.executeWorkflow(agent, ctx).catch((err: unknown) => {
      console.error(`Agent "${agent.name}" failed (trigger=${triggerType}):`, err);
    });
  }
}

// ─── Main Orchestration ───────────────────────────────────────────────────────

/**
 * Orchestrate a full generation round triggered by the user submitting a message.
 *
 * @param userText  The text the user typed (empty string for continuation rounds)
 * @param deps      Resolved dependencies
 */
export async function orchestrateGeneration(userText: string, deps: OrchestrationDeps): Promise<void> {
  const { chatId, participants, agents, userCharacterId, addUserMessage, executeWorkflow, generateMessage, waitForGenerationToFinish, isAborted } = deps;

  // Identify all enabled agent participants and their trigger configs, in participant order
  const enabledParticipants = participants.filter((p) => p.enabled);

  const agentConfigs: AgentParticipantConfig[] = enabledParticipants
    .map((p) => {
      const agent = agents.find((a) => a.id === p.id);
      if (!agent) {
        return null;
      }
      const { triggerType, messageCount } = getAgentTriggerConfig(agent);
      return { participant: p, agent, triggerType, messageCount } satisfies AgentParticipantConfig;
    })
    .filter((x): x is AgentParticipantConfig => x !== null);

  // Helper: base context shared across all triggers in this round
  const baseCtx: Omit<TriggerContext, "type"> = {
    chatId,
    message: userText,
    userCharacterId,
  };

  const safeExec = (agent: AgentType, ctx: TriggerContext) =>
    executeWorkflow(agent, ctx).catch((err: unknown) => {
      console.error(`Agent "${agent.name}" failed:`, err);
      return null;
    });

  const runTriggers = (types: AgentTriggerType[], participantId?: string) => runAgentsForTriggers(types, agentConfigs, { ...baseCtx, participantId }, { executeWorkflow: safeExec, isAborted });

  // ── 1. Before user message agents ─────────────────────────────────────────
  if (!isAborted()) {
    await runTriggers(["before_user_message", "before_any_message"], userCharacterId ?? undefined);
  }

  if (isAborted()) {
    return;
  }

  // ── 2. Create user message ─────────────────────────────────────────────────
  if (userText.trim()) {
    await addUserMessage(userText.trim());
  }

  if (isAborted()) {
    return;
  }

  // ── 3. After user message agents ──────────────────────────────────────────
  await runTriggers(["after_user_message", "after_any_message"], userCharacterId ?? undefined);

  // ── 4. Loop through enabled participants in order ─────────────────────────
  for (const participant of enabledParticipants) {
    if (isAborted()) {
      break;
    }

    const agentConfig = agentConfigs.find((ac) => ac.participant.id === participant.id);
    const isAgent = agentConfig !== undefined;

    if (isAgent) {
      if (agentConfig.triggerType !== "manual") {
        // Non-manual agents are driven by before/after hooks elsewhere; skip here
        continue;
      }
      // Manual agent: run workflow at its participant-list position
      await safeExec(agentConfig.agent, {
        ...baseCtx,
        type: "manual",
        participantId: participant.id,
      });
      continue;
    }

    // Skip the virtual "user" participant — user message is already inserted above
    if (participant.id === "user") {
      continue;
    }

    // Character participant
    if (isAborted()) {
      break;
    }

    // ── 4a. Before character agents ──────────────────────────────────────
    await runTriggers(["before_character_message", "before_any_message"], participant.id);

    if (isAborted()) {
      break;
    }

    // ── 4b. Generate character message ───────────────────────────────────
    await generateMessage({
      chatId,
      characterId: participant.id,
      stream: true,
      emitChatEvents: false,
    });

    await waitForGenerationToFinish();

    if (isAborted()) {
      break;
    }

    // ── 4c. After character agents ───────────────────────────────────────
    await runTriggers(["after_character_message", "after_any_message"], participant.id);
  }

  if (isAborted()) {
    return;
  }

  // ── 5. After all participants agents ───────────────────────────────────────
  await runTriggers(["after_all_participants"]);
}

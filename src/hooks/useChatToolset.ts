import { useCallback } from "react";
import { useAgents } from "@/hooks/agentStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useAgentWorkflow } from "@/hooks/useAgentWorkflow";
import type { ExecutableToolDefinition } from "@/hooks/useInference";
import type { ChatTemplate } from "@/schema/template-chat-schema";

/**
 * Builds the executable toolset for a chat from a chat template's `tools` references.
 * Agents are scoped to the current profile so a template can never pull in another
 * profile's agents (e.g. via an imported template that references foreign ids).
 */
export function useChatToolset() {
  const { buildChatTools } = useAgentWorkflow();
  const agents = useAgents();
  const currentProfile = useCurrentProfile();
  const profileId = currentProfile?.id;

  const buildToolsForTemplate = useCallback(
    (chatTemplate: ChatTemplate | null | undefined, chatId?: string): ExecutableToolDefinition[] => {
      const refs = chatTemplate?.tools ?? [];
      if (refs.length === 0 || !profileId) {
        return [];
      }
      const profileAgents = agents.filter((agent) => agent.profile_id === profileId);
      return buildChatTools(refs, profileAgents, chatId);
    },
    [agents, profileId, buildChatTools],
  );

  return { buildToolsForTemplate };
}

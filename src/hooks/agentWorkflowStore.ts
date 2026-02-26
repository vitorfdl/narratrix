/**
 * Global Zustand store tracking the running state of every agent workflow.
 *
 * This lets components that did NOT initiate the workflow (e.g. WidgetParticipants
 * showing the animation for an agent triggered by WidgetGenerate's orchestrator)
 * react to state changes without prop-drilling or shared hook instances.
 */
import { create } from "zustand";

export interface AgentWorkflowState {
  isRunning: boolean;
  currentNodeId?: string;
  executedNodes: string[];
  error?: string;
}

const DEFAULT_STATE: AgentWorkflowState = { isRunning: false, executedNodes: [] };

interface AgentWorkflowStoreState {
  /** Map from agentId → current workflow state */
  states: Record<string, AgentWorkflowState>;
  setAgentState: (agentId: string, state: AgentWorkflowState) => void;
  clearAgentState: (agentId: string) => void;
}

export const useAgentWorkflowStore = create<AgentWorkflowStoreState>((set) => ({
  states: {},
  setAgentState: (agentId, state) =>
    set((prev) => ({ states: { ...prev.states, [agentId]: state } })),
  clearAgentState: (agentId) =>
    set((prev) => {
      const next = { ...prev.states };
      delete next[agentId];
      return { states: next };
    }),
}));

/** Returns the workflow state for a specific agent (defaults to idle). */
export const useAgentWorkflowStateById = (agentId: string): AgentWorkflowState =>
  useAgentWorkflowStore((state) => state.states[agentId] ?? DEFAULT_STATE);

/** Returns true if ANY agent workflow is currently running. */
export const useIsAnyAgentRunning = (): boolean =>
  useAgentWorkflowStore((state) => Object.values(state.states).some((s) => s.isRunning));

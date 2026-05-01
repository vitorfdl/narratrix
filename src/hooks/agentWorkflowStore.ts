import { create } from "zustand";

export function makeRunKey(agentId: string, chatId?: string | null): string {
  return `${chatId ?? "global"}::${agentId}`;
}

export interface AgentWorkflowState {
  agentId: string;
  chatId?: string;
  isRunning: boolean;
  currentNodeId?: string;
  executedNodes: string[];
  error?: string;
}

const DEFAULT_STATE: AgentWorkflowState = { agentId: "", isRunning: false, executedNodes: [] };

interface AgentWorkflowStoreState {
  /** Map from runKey → current workflow state */
  states: Record<string, AgentWorkflowState>;
  /** Map from runKey → full cancel callback (set by useAgentWorkflow on start) */
  cancelFns: Record<string, () => void>;
  setAgentState: (runKey: string, state: AgentWorkflowState) => void;
  clearAgentState: (runKey: string) => void;
  registerCancelFn: (runKey: string, fn: () => void) => void;
  unregisterCancelFn: (runKey: string) => void;
}

export const useAgentWorkflowStore = create<AgentWorkflowStoreState>((set) => ({
  states: {},
  cancelFns: {},
  setAgentState: (runKey, state) => set((prev) => ({ states: { ...prev.states, [runKey]: state } })),
  clearAgentState: (runKey) =>
    set((prev) => {
      const next = { ...prev.states };
      delete next[runKey];
      return { states: next };
    }),
  registerCancelFn: (runKey, fn) => set((prev) => ({ cancelFns: { ...prev.cancelFns, [runKey]: fn } })),
  unregisterCancelFn: (runKey) =>
    set((prev) => {
      const next = { ...prev.cancelFns };
      delete next[runKey];
      return { cancelFns: next };
    }),
}));

/** Calls the stored cancel callback for a specific run key. */
export function cancelAgentWorkflow(runKey: string): void {
  useAgentWorkflowStore.getState().cancelFns[runKey]?.();
}

/** Returns the workflow state for a specific agent in a specific chat (defaults to idle). */
export const useAgentWorkflowState = (agentId: string, chatId?: string | null): AgentWorkflowState => useAgentWorkflowStore((state) => state.states[makeRunKey(agentId, chatId)] ?? DEFAULT_STATE);

/** Returns true if ANY agent workflow is currently running. */
export const useIsAnyAgentRunning = (): boolean => useAgentWorkflowStore((state) => Object.values(state.states).some((s) => s.isRunning));

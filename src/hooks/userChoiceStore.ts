import { create } from "zustand";

export interface PendingChoiceOption {
  label: string;
  value: string;
}

export interface PendingChoice {
  id: string;
  agentId: string;
  executionId: string;
  prompt: string;
  choices: PendingChoiceOption[];
  resolve: (value: string | null) => void;
}

interface UserChoiceState {
  pendingChoices: PendingChoice[];
  actions: {
    addPendingChoice: (choice: PendingChoice) => void;
    resolveChoice: (id: string, value: string | null) => void;
    cancelChoicesForAgent: (agentId: string) => void;
  };
}

export const useUserChoiceStore = create<UserChoiceState>((set, get) => ({
  pendingChoices: [],
  actions: {
    addPendingChoice: (choice) =>
      set((state) => ({
        pendingChoices: [...state.pendingChoices, choice],
      })),

    resolveChoice: (id, value) => {
      const choice = get().pendingChoices.find((c) => c.id === id);
      if (!choice) {
        return;
      }
      choice.resolve(value);
      set((state) => ({
        pendingChoices: state.pendingChoices.filter((c) => c.id !== id),
      }));
    },

    cancelChoicesForAgent: (agentId) => {
      const toCancel = get().pendingChoices.filter((c) => c.agentId === agentId);
      for (const choice of toCancel) {
        choice.resolve(null);
      }
      set((state) => ({
        pendingChoices: state.pendingChoices.filter((c) => c.agentId !== agentId),
      }));
    },
  },
}));

export const useUserChoiceActions = () => useUserChoiceStore((state) => state.actions);
export const usePendingChoices = () => useUserChoiceStore((state) => state.pendingChoices);

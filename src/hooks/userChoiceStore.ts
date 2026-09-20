import { create } from "zustand";

export interface PendingChoiceOption {
  label: string;
  value: string;
  /** Optional secondary text shown beneath the label. */
  description?: string;
}

export interface PendingChoice {
  id: string;
  runKey: string;
  executionId: string;
  prompt: string;
  choices: PendingChoiceOption[];
  /** When true, the user may type a custom free-text answer instead of picking a choice. */
  allowCustom?: boolean;
  /** When true, the user may select more than one option; the answer is a JSON array string. */
  allowMultiple?: boolean;
  resolve: (value: string | null) => void;
}

interface UserChoiceState {
  pendingChoices: PendingChoice[];
  actions: {
    addPendingChoice: (choice: PendingChoice) => void;
    resolveChoice: (id: string, value: string | null) => void;
    cancelChoicesForRun: (runKey: string) => void;
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

    cancelChoicesForRun: (runKey) => {
      const toCancel = get().pendingChoices.filter((c) => c.runKey === runKey);
      for (const choice of toCancel) {
        choice.resolve(null);
      }
      set((state) => ({
        pendingChoices: state.pendingChoices.filter((c) => c.runKey !== runKey),
      }));
    },
  },
}));

export const useUserChoiceActions = () => useUserChoiceStore((state) => state.actions);
export const usePendingChoices = () => useUserChoiceStore((state) => state.pendingChoices);

import { create } from "zustand";

interface ExpressionStore {
  selectedText: string | null;
  selectedMessageCharacterId: string | null;
  setSelectedText: (text: string | null, characterId: string | null) => void;
  clearSelection: () => void;
}

export const useExpressionStore = create<ExpressionStore>((set) => ({
  selectedText: null,
  selectedMessageCharacterId: null,
  setSelectedText: (text, characterId) => set({ selectedText: text, selectedMessageCharacterId: characterId }),
  clearSelection: () => set({ selectedText: null, selectedMessageCharacterId: null }),
}));

import { create } from "zustand";

interface UIState {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeSection: "chat", // Default section
  setActiveSection: (section) => set({ activeSection: section }),
}));

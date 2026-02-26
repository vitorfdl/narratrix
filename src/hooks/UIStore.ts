import { create } from "zustand";

export interface NavigationContext {
  agentId?: string;
  returnTo?: string;
}

interface UIState {
  activeSection: string;
  navigationContext: NavigationContext | null;
  setActiveSection: (section: string) => void;
  navigateToSection: (section: string, context?: NavigationContext) => void;
  clearNavigationContext: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeSection: "chat",
  navigationContext: null,
  setActiveSection: (section) => set({ activeSection: section, navigationContext: null }),
  navigateToSection: (section, context = null) => set({ activeSection: section, navigationContext: context }),
  clearNavigationContext: () => set({ navigationContext: null }),
}));

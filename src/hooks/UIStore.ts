import { create } from "zustand";

export interface NavigationContext {
  agentId?: string;
  returnTo?: string;
}

interface UIState {
  activeSection: string;
  navigationContext: NavigationContext | null;
  sidebarCollapsed: boolean;
  recentThreadsExpanded: boolean;
  setActiveSection: (section: string) => void;
  navigateToSection: (section: string, context?: NavigationContext) => void;
  clearNavigationContext: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleRecentThreads: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeSection: "chat",
  navigationContext: null,
  sidebarCollapsed: false,
  recentThreadsExpanded: true,
  setActiveSection: (section) => set({ activeSection: section, navigationContext: null }),
  navigateToSection: (section, context = undefined) => set({ activeSection: section, navigationContext: context }),
  clearNavigationContext: () => set({ navigationContext: null }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleRecentThreads: () => set((state) => ({ recentThreadsExpanded: !state.recentThreadsExpanded })),
}));

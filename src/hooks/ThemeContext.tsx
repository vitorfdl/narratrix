import type { AppSettings } from "@/schema/profiles-schema";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Type definition for theme
export type Theme = AppSettings["appearance"]["theme"];

// Interface for the theme store
interface ThemeState {
  // State
  theme: Theme;

  // Actions
  setTheme: (theme: Theme) => void;
}

/**
 * Theme store implemented with zustand
 * Uses localStorage persistence to maintain theme preference
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Initial state
      theme: "system",

      // Actions
      setTheme: (theme) => {
        set({ theme });

        // Apply theme to document
        if (theme === "system") {
          const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          document.documentElement.classList.toggle("dark", systemTheme === "dark");
        } else {
          document.documentElement.classList.toggle("dark", theme === "dark");
        }
      },
    }),
    {
      name: "theme-storage",
    },
  ),
);

/**
 * Initialize theme on app load
 * This function needs to be called once when the app starts
 */
export function initializeTheme(): void {
  const { theme } = useThemeStore.getState();

  // Apply theme to document
  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.toggle("dark", systemTheme === "dark");

    // Setup listener for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (useThemeStore.getState().theme === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    });
  } else {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

/**
 * Legacy useTheme hook for backward compatibility
 * @deprecated Use useThemeStore directly instead
 */
export function useTheme() {
  const { theme, setTheme } = useThemeStore();
  return { theme, setTheme };
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings } from "@/schema/profiles-schema";

// Type definition for theme
export type Theme = AppSettings["appearance"]["theme"];

// Interface for the theme store
interface ThemeState {
  // State
  theme: Theme;
  fontSize: number;
  originalFontSize: number | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setFontSize: (fontSize: number) => void;
}

/**
 * Theme store implemented with zustand
 * Uses localStorage persistence to maintain theme preference and font size
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: "system",
      fontSize: 16,
      originalFontSize: null,

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
      setFontSize: (fontSize) => {
        // Store the original font size if not already stored
        const currentOriginal = get().originalFontSize;
        if (currentOriginal === null) {
          const computed = window.getComputedStyle(document.documentElement).fontSize;
          const original = Number.parseInt(computed, 10) || 16;
          set({ originalFontSize: original });
        }
        set({ fontSize });
        document.documentElement.style.fontSize = `${fontSize}px`;
      },
    }),
    {
      name: "theme-storage",
    },
  ),
);

/**
 * Initialize theme and font size on app load
 * This function needs to be called once when the app starts
 */
export function initializeTheme(): void {
  const { theme, fontSize, setFontSize } = useThemeStore.getState();

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

  // Apply font size
  setFontSize(fontSize ?? 16);
}

/**
 * Legacy useTheme hook for backward compatibility
 * @deprecated Use useThemeStore directly instead
 */
export function useTheme() {
  const { theme, setTheme, fontSize, setFontSize, originalFontSize } = useThemeStore();
  return { theme, setTheme, fontSize, setFontSize, originalFontSize };
}

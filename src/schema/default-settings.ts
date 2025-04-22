import { AppSettingsSchema } from "./profiles-schema.ts";

// Default settings based on the mock data
export const defaultSettings = AppSettingsSchema.parse({
  general: {
    language: "en",
    autoSave: true,
  },
  notifications: {
    enabled: true,
    sound: true,
    desktop: true,
    chatNotifications: true,
    updateNotifications: true,
  },
  chat: {
    timestampFormat: "24h",
    showAvatars: true,
    sendShortcut: "Ctrl+Enter",
  },
  censorship: {
    enabled: false,
    customWords: [],
    applyToSystemPrompts: true,
    applyToUserMessages: true,
    applyToAssistantMessages: true,
  },
  appearance: {
    theme: "dark",
    fontSize: 16,
    fontFamily: "Inter",
    accentColor: "#7C3AED",
  },
  system: {
    expressionPackDirectory: "",
    debugMode: false,
    autoUpdate: true,
  },
});

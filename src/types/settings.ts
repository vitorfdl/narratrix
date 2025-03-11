export interface AppSettings {
    general: GeneralSettings;
    notifications: NotificationSettings;
    chat: ChatSettings;
    censorship: CensorshipSettings;
    appearance: AppearanceSettings;
    system: SystemSettings;
}

export interface GeneralSettings {
    language: "en" | "es" | "fr" | "de";
    autoSave: boolean;
    // Moved autoUpdate to SystemSettings based on the JSON
}

export interface NotificationSettings {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    chatNotifications: boolean;
    updateNotifications: boolean;
}

export interface ChatSettings {
    timestampFormat: "12h" | "24h";
    showAvatars: boolean;
    sendShortcut: string; // Added based on the JSON
}

export interface CensorshipSettings {
    enabled: boolean;
    customWords: string[];
    applyToSystemPrompts: boolean;
    applyToUserMessages: boolean;
    applyToAssistantMessages: boolean;
}

export interface AppearanceSettings {
    theme: "light" | "dark" | "system";
    fontSize: "small" | "medium" | "large";
    fontFamily: string;
    accentColor: string;
}

export interface SystemSettings {
    expressionPackDirectory: string;
    debugMode: boolean;
    autoUpdate: boolean;
}

// Mock data
export const mockSettings: AppSettings = {
    "general": {
        "language": "en",
        "autoSave": true,
    },
    "notifications": {
        "enabled": true,
        "sound": true,
        "desktop": true,
        "chatNotifications": true,
        "updateNotifications": true,
    },
    "chat": {
        "timestampFormat": "24h",
        "showAvatars": true,
        "sendShortcut": "Ctrl+Enter",
    },
    "censorship": {
        "enabled": false,
        "customWords": [],
        "applyToSystemPrompts": true,
        "applyToUserMessages": true,
        "applyToAssistantMessages": true,
    },
    "appearance": {
        "theme": "dark",
        "fontSize": "medium",
        "fontFamily": "Inter",
        "accentColor": "#7C3AED",
    },
    "system": {
        "expressionPackDirectory": "",
        "debugMode": false,
        "autoUpdate": true,
    },
};

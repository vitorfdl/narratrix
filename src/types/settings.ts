export interface AppSettings {
    general: GeneralSettings;
    notifications: NotificationSettings;
    chat: ChatSettings;
    censorship: CensorshipSettings;
    appearance: AppearanceSettings;
    system: SystemSettings;
}

export interface GeneralSettings {
    language: 'en' | 'es' | 'fr' | 'de';
    autoSave: boolean;
    autoUpdate: boolean;
}

export interface NotificationSettings {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    chatNotifications: boolean;
    updateNotifications: boolean;
}

export interface ChatSettings {
    messageDisplay: 'compact' | 'comfortable';
    timestampFormat: '12h' | '24h';
    showAvatars: boolean;
    showTypingIndicator: boolean;
}

export interface CensorshipSettings {
    enabled: boolean;
    level: 'low' | 'medium' | 'high';
    customWords: string[];
    applyToSystemPrompts: boolean;
    applyToUserMessages: boolean;
    applyToAssistantMessages: boolean;
}

export interface AppearanceSettings {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    fontFamily: string;
    accentColor: string;
}

export interface SystemSettings {
    expressionPackDirectory: string;
    maxConcurrentChats: number;
    debugMode: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// Mock data
export const mockSettings: AppSettings = {
    general: {
        language: 'en',
        autoSave: true,
        autoUpdate: true
    },
    notifications: {
        enabled: true,
        sound: true,
        desktop: true,
        chatNotifications: true,
        updateNotifications: true
    },
    chat: {
        messageDisplay: 'comfortable',
        timestampFormat: '24h',
        showAvatars: true,
        showTypingIndicator: true
    },
    censorship: {
        enabled: false,
        level: 'medium',
        customWords: [],
        applyToSystemPrompts: true,
        applyToUserMessages: true,
        applyToAssistantMessages: true
    },
    appearance: {
        theme: 'dark',
        fontSize: 'medium',
        fontFamily: 'Inter',
        accentColor: '#7C3AED'
    },
    system: {
        expressionPackDirectory: 'C:\\Expressions',
        maxConcurrentChats: 4,
        debugMode: false,
        logLevel: 'info'
    }
}; 
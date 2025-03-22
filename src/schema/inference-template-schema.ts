export interface InferenceTemplate {
  id: string;
  name: string;
  description: string;
  modelInstructions: ModelInstructions;
  systemPrompts: SystemPrompt[];
  reasoning: Reasoning;
  settings: TemplateSettings;
}

export interface ModelInstructions {
  systemPromptFormatting: MessageFormatting;
  userMessageFormatting: MessageFormatting;
  assistantMessageFormatting: MessageFormatting & {
    prefill: string;
    prefillOnlyCharacters: boolean;
  };
  agentMessageFormatting: {
    useSameAsUser: boolean;
    useSameAsSystemPrompt: boolean;
    prefix: string;
    suffix: string;
  };
  customStopStrings: string[];
}

export interface MessageFormatting {
  prefix: string;
  suffix: string;
}

export interface SystemPrompt {
  id: string;
  type: SystemPromptType;
  name: string;
  content: string;
  isCollapsed?: boolean;
  order: number;
  settings?: {
    useGlobal?: boolean;
    mergeMessages?: boolean;
    applyCensorship?: boolean;
  };
}

export enum SystemPromptType {
  Context = "context",
  UserDescription = "userDescription",
  CharacterDescription = "characterDescription",
  Scenario = "scenario",
  CharacterMemory = "characterMemory",
  CharacterInventory = "characterInventory",
  CustomField = "customField",
}

export interface Reasoning {
  prefix: string;
  suffix: string;
}

export interface TemplateSettings {
  trimAssistantIncomplete: boolean;
  trimDoubleSpaces: boolean;
  collapseConsecutiveLines: boolean;
  chatCompletion: boolean;
  textCompletion: boolean;
  prefixMessages: {
    enabled: boolean;
    type: "never" | "always" | "characters";
  };
  mergeMessagesOnUser: boolean;
  applyCensorship: boolean;
  mergeSubsequentMessages: boolean;
}

export interface InferenceTemplateDoc {
  id: string;
  title: string;
  content: string;
}

import { Character, CharacterUnion } from "@/schema/characters-schema";
import { ChatChapter } from "@/schema/chat-chapter-schema";
import { ChatMessage } from "@/schema/chat-message-schema";
import { InferenceMessage } from "@/schema/inference-engine-schema";
import { Model } from "@/schema/models-schema";
import { ChatTemplate, ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { FormatTemplate } from "@/schema/template-format-schema";
import { InferenceTemplate } from "@/schema/template-inferance-schema";
import { applyContextLimit } from "./apply-context-limit";
import { applyInferenceTemplate } from "./apply-inference-template";
import { LorebookContentResponse, getLorebookContent, processLorebookMessages } from "./apply-lorebook";
import { collapseConsecutiveLines, mergeMessagesOnUser, mergeSubsequentMessages } from "./format-template-utils";
import { replaceTextPlaceholders } from "./replace-text";

/**
 * Interface for message with character information
 */
interface MessageWithCharacter extends ChatMessage {
  character_name?: string;
}

/**
 * Interface for prompt formatter configuration
 */
export interface PromptFormatterConfig {
  // Prompt Defaults
  messageHistory: MessageWithCharacter[] | ChatMessage[];
  userPrompt?: string;
  systemOverridePrompt?: string;

  // Settings
  modelSettings?: Model | null;
  formatTemplate?: FormatTemplate | null;
  inferenceTemplate?: InferenceTemplate | null;
  chatTemplate?: {
    custom_prompts?: ChatTemplateCustomPrompt[];
    config?: ChatTemplate["config"];
    lorebook_list?: ChatTemplate["lorebook_list"];
  };
  chatConfig?: {
    injectionPrompts?: Record<string, string>;
    user_character?: Pick<Character, "name" | "custom" | "lorebook_id">;
    character?: Pick<CharacterUnion, "name" | "settings" | "custom" | "type" | "lorebook_id">;
    chapter?: Pick<ChatChapter, "title" | "scenario" | "instructions">;
    extra?: Record<string, string>;
    censorship?: {
      words?: string[];
    };
  };
}

/**
 * Interface for the formatted prompt result
 */
export interface FormattedPromptResult {
  inferenceMessages: InferenceMessage[];
  systemPrompt?: string;
  customStopStrings?: string[];
}

const addPrefix = (string: string, prefix: string) => {
  return `${prefix}: ${string}`;
};

const hasMoreThanOneCharacter = (messages: MessageWithCharacter[]) => {
  return new Set(messages.filter((message) => message.type === "character").map((message) => message.character_id)).size > 1;
};

/**
 * Get chat history and append user message if provided
 */
export function getChatHistory(
  messages: MessageWithCharacter[],
  userMessage?: string,
  prefixOption?: FormatTemplate["config"]["settings"]["prefix_messages"],
): InferenceMessage[] {
  const inferenceMessages: InferenceMessage[] = [];

  const canInsertPrefix = prefixOption === "always" || (prefixOption === "characters" && hasMoreThanOneCharacter(messages));
  // Process existing chat messages
  if (messages && messages.length > 0) {
    for (const message of messages) {
      if (message.messages.length === 0 || message.disabled) {
        continue;
      }

      const character = message.character_name || "";
      const index = message.message_index || 0;
      const messageText = message.messages[index];
      if (message.type === "user" && messageText) {
        inferenceMessages.push({
          role: "user",
          text: canInsertPrefix ? addPrefix(messageText, character) : messageText,
        });
      } else if (message.type === "character" && messageText) {
        inferenceMessages.push({
          role: "assistant",
          text: canInsertPrefix ? addPrefix(messageText, character) : messageText,
        });
      } else if (message.type === "system") {
        inferenceMessages.push({
          role: "user",
          text: messageText,
        });
      }
    }
  }

  // Add the current user message if provided
  if (userMessage) {
    inferenceMessages.push({
      role: "user",
      text: userMessage,
    });
  }

  return inferenceMessages;
}

interface CreateSystemPromptConfig {
  systemPromptTemplate?: FormatTemplate | null;
  chatConfig?: PromptFormatterConfig["chatConfig"];
  lorebookContent?: LorebookContentResponse["replacers"];
  systemOverridePrompt?: string | null;
}
/**
 * Create system prompt from template
 */
export function createSystemPrompt(config: CreateSystemPromptConfig): string | undefined {
  const { systemPromptTemplate, chatConfig, lorebookContent, systemOverridePrompt } = config;

  if (!systemPromptTemplate || !systemPromptTemplate.config || systemPromptTemplate.prompts.length === 0) {
    return systemOverridePrompt || undefined; // If no system prompt template is provided, return the system override prompt
  }

  let prompts = structuredClone(systemPromptTemplate.prompts || []);
  if (prompts.length === 0 && systemOverridePrompt) {
    return systemOverridePrompt; // If no system prompt template is provided, return the system override prompt
  }

  const hasCharacter = !!chatConfig?.character && chatConfig?.character.type === "character";
  const hasChapter = !!chatConfig?.chapter?.scenario;
  const hasUserCharacter = !!chatConfig?.user_character?.custom?.personality;

  // System Overrides will override the context prompt, or be added at the top if no context prompt is present
  if (systemOverridePrompt) {
    const contextIndex = prompts.findIndex((prompt) => prompt.type === "context");
    if (contextIndex !== -1) {
      prompts[contextIndex] = {
        type: "context",
        content: systemOverridePrompt,
      };
    } else {
      prompts.unshift({
        type: "context",
        content: systemOverridePrompt,
      });
    }
  }

  if (!hasCharacter) {
    prompts = prompts.filter((prompt) => prompt.type !== "character-context");
    prompts = prompts.filter((prompt) => prompt.type !== "character-memory");
  }

  if (!hasChapter) {
    prompts = prompts.filter((prompt) => prompt.type !== "chapter-context");
  }

  if (!hasUserCharacter) {
    prompts = prompts.filter((prompt) => prompt.type !== "user-context");
  }

  if (!lorebookContent?.lorebook_top) {
    prompts = prompts.filter((prompt) => prompt.type !== "lorebook-top");
  }

  if (!lorebookContent?.lorebook_bottom) {
    prompts = prompts.filter((prompt) => prompt.type !== "lorebook-bottom");
  }

  if (prompts.length === 0) {
    return undefined;
  }

  const contextSeparator = systemPromptTemplate.config.context_separator?.replaceAll("\\n", "\n") || "\n\n";
  return prompts.map((section) => section.content).join(contextSeparator);
}

/**
 * Process custom prompts and insert them into appropriate positions in the message history
 */
export function processCustomPrompts(messages: InferenceMessage[], customPrompts?: ChatTemplateCustomPrompt[]): InferenceMessage[] {
  if (!customPrompts || customPrompts.length === 0) {
    return messages;
  }

  const result = [...messages];

  // Process each custom prompt based on its position
  customPrompts.forEach((customPrompt) => {
    const promptMessage: InferenceMessage = {
      role: customPrompt.role === "character" ? "assistant" : customPrompt.role === "system" ? ("system" as any) : "user",
      text: customPrompt.prompt,
    };

    if (customPrompt.position === "top") {
      // Insert at the beginning
      result.unshift(promptMessage);
    } else if (customPrompt.position === "bottom") {
      // Insert at the end
      result.push(promptMessage);
    } else if (customPrompt.position === "depth") {
      // Insert at specific depth from the end
      const depth = customPrompt.depth || 1;
      const insertPosition = Math.max(0, result.length - depth);
      result.splice(insertPosition, 0, promptMessage);
    }
  });

  return result;
}

/**
 * Main format prompt function that orchestrates the prompt formatting process
 */
export async function formatPrompt(config: PromptFormatterConfig): Promise<FormattedPromptResult> {
  const prefixOption = config.formatTemplate?.config.settings.prefix_messages;
  // Step 1: Get chat history with user message
  const chatHistory = getChatHistory(structuredClone(config.messageHistory), config.userPrompt, prefixOption);
  // Step 2: Process custom prompts from the chat template
  let processedMessages = processCustomPrompts(chatHistory, config.chatTemplate?.custom_prompts);

  if (config.formatTemplate?.config.settings.collapse_consecutive_lines) {
    processedMessages = collapseConsecutiveLines(structuredClone(processedMessages));
  }

  // Get the order of lorebooks to be used (Character > User > Template)
  const LoreBookOrder = [
    config.chatConfig?.character?.lorebook_id,
    config.chatConfig?.user_character?.lorebook_id,
    ...(config.chatTemplate?.lorebook_list || []),
  ].filter((id) => id) as string[];

  const LorebookBudget = config.chatTemplate?.config?.lorebook_token_budget || 400;

  const lorebookSeparator = config.formatTemplate?.config.lorebook_separator?.replaceAll("\\n", "\n") || "\n---\n";
  const lorebookContent = await getLorebookContent(LoreBookOrder, LorebookBudget, processedMessages, lorebookSeparator);
  processedMessages = processLorebookMessages(processedMessages, lorebookContent.messages);

  config.chatConfig = {
    ...config.chatConfig,
    extra: {
      ...config.chatConfig?.extra,
      "lorebook.top": lorebookContent.replacers.lorebook_top,
      "lorebook.bottom": lorebookContent.replacers.lorebook_bottom,
    },
  };

  if (config.formatTemplate?.config.settings.merge_messages_on_user) {
    processedMessages = mergeMessagesOnUser(structuredClone(processedMessages));
  } else if (config.formatTemplate?.config.settings.merge_subsequent_messages) {
    processedMessages = mergeSubsequentMessages(structuredClone(processedMessages));
  }

  // Step 3: Create system prompt
  const rawSystemPrompt = createSystemPrompt({
    systemPromptTemplate: config.formatTemplate,
    chatConfig: config.chatConfig,
    lorebookContent: lorebookContent.replacers,
    systemOverridePrompt: config.systemOverridePrompt,
  });
  const formattedPrompt = replaceTextPlaceholders(processedMessages, rawSystemPrompt, config.chatConfig);

  const limitedPrompt = await applyContextLimit(formattedPrompt, {
    config: config.chatTemplate?.config || { max_context: 100, max_tokens: 1500, max_depth: 100 },
    custom_prompts: config.chatTemplate?.custom_prompts || [],
  });

  if (config.inferenceTemplate) {
    const inferencePrompt = await applyInferenceTemplate({
      systemPrompt: limitedPrompt.systemPrompt,
      inferenceTemplate: config.inferenceTemplate,
      messages: limitedPrompt.inferenceMessages,
      chatConfig: config.chatConfig,
    });

    return {
      inferenceMessages: [{ role: "user", text: inferencePrompt.text }],
      systemPrompt: undefined,
      customStopStrings: inferencePrompt.customStopStrings,
    };
  }

  return limitedPrompt;
}

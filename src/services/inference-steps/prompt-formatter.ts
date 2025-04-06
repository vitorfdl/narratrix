import { Character, CharacterUnion } from "@/schema/characters-schema";
import { ChatChapter } from "@/schema/chat-chapter-schema";
import { ChatMessage } from "@/schema/chat-message-schema";
import { InferenceMessage } from "@/schema/inference-engine-schema";
import { Model } from "@/schema/models-schema";
import { ChatTemplate, ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { FormatTemplate } from "@/schema/template-format-schema";
import { InferenceTemplate } from "@/schema/template-inferance-schema";
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
  };
  chatConfig?: {
    user_character?: Pick<Character, "name" | "custom">;
    character?: Pick<CharacterUnion, "name" | "settings" | "custom" | "type">;
    chapter?: Pick<ChatChapter, "title" | "scenario" | "instructions">;
    extra?: Record<string, string>;
  };
}

/**
 * Interface for the formatted prompt result
 */
export interface FormattedPromptResult {
  inferenceMessages: InferenceMessage[];
  systemPrompt?: string;
}

/**
 * Get chat history and append user message if provided
 */
export function getChatHistory(messages: MessageWithCharacter[], userMessage?: string): InferenceMessage[] {
  const inferenceMessages: InferenceMessage[] = [];

  // Process existing chat messages
  if (messages && messages.length > 0) {
    for (const message of messages) {
      if (message.type === "user" && message.messages && message.messages.length > 0) {
        inferenceMessages.push({
          role: "user",
          text: message.messages[0],
        });
      } else if (message.type === "character" && message.messages && message.messages.length > 0) {
        inferenceMessages.push({
          role: "assistant",
          text: message.messages[0],
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

/**
 * Create system prompt from template
 */
export function createSystemPrompt(systemPromptTemplate?: FormatTemplate | null): string | undefined {
  if (!systemPromptTemplate || !systemPromptTemplate.config || systemPromptTemplate.prompts.length === 0) {
    return undefined;
  }

  return systemPromptTemplate.prompts.map((section) => section.content).join("\n\n");
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
export function formatPrompt(config: PromptFormatterConfig): FormattedPromptResult {
  // Step 1: Get chat history with user message
  const chatHistory = getChatHistory(structuredClone(config.messageHistory), config.userPrompt);

  // Step 2: Process custom prompts from the chat template
  let processedMessages = processCustomPrompts(chatHistory, config.chatTemplate?.custom_prompts);

  if (config.formatTemplate?.config.settings.collapse_consecutive_lines) {
    processedMessages = collapseConsecutiveLines(structuredClone(processedMessages));
  }

  if (config.formatTemplate?.config.settings.merge_messages_on_user) {
    processedMessages = mergeMessagesOnUser(structuredClone(processedMessages));
  } else if (config.formatTemplate?.config.settings.merge_subsequent_messages) {
    processedMessages = mergeSubsequentMessages(structuredClone(processedMessages));
  }

  // if (config.formatTemplate?.config.settings.prefix_messages) {
  //   processedMessages = prefixMessages(structuredClone(processedMessages));
  // }

  // Step 3: Create system prompt
  const systemPrompt = config.systemOverridePrompt || createSystemPrompt(config.formatTemplate);

  // Step 4: Replace placeholders
  return replaceTextPlaceholders(processedMessages, systemPrompt, config.chatConfig);
}

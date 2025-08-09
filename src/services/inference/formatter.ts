import { Character } from "@/schema/characters-schema";
import { ChatChapter } from "@/schema/chat-chapter-schema";
import { ChatMessage } from "@/schema/chat-message-schema";
import { InferenceMessage } from "@/schema/inference-engine-schema";
import { Model } from "@/schema/models-schema";
import { ChatTemplate, ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { FormatTemplate } from "@/schema/template-format-schema";
import { InferenceTemplate } from "@/schema/template-inferance-schema";
import { applyContextLimit } from "./formatter/apply-context-limit";
import { applyInferenceTemplate } from "./formatter/apply-inference-template";
import { getLorebookContent, LorebookContentResponse, processLorebookMessages } from "./formatter/apply-lorebook";
import { collapseConsecutiveLines, mergeMessagesOnUser, mergeSubsequentMessages } from "./formatter/format-template-utils";
import { replaceTextPlaceholders } from "./formatter/replace-text";

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
    character?: Pick<Character, "name" | "settings" | "custom" | "type" | "lorebook_id">;
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
  injectionPrompts?: Record<string, string>,
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
        // Handle summary messages specially
        if (message.extra?.script === "summary" && injectionPrompts?.summary) {
          // Use the injection template and replace {{summary}} with the actual summary content
          const injectionTemplate = injectionPrompts.summary;
          const formattedSummary = injectionTemplate.replace(/\{\{summary\}\}/g, messageText);

          inferenceMessages.push({
            role: "user",
            text: formattedSummary,
          });
        } else {
          // Regular system message
          inferenceMessages.push({
            role: "user",
            text: messageText,
          });
        }
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
  contextSeparator?: string;
  customPrompts?: ChatTemplateCustomPrompt[];
}
/**
 * Create system prompt from template
 */
export function createSystemPrompt(config: CreateSystemPromptConfig): string | undefined {
  const { systemPromptTemplate, chatConfig, lorebookContent, systemOverridePrompt, contextSeparator, customPrompts } = config;

  let prompts = structuredClone(systemPromptTemplate?.prompts?.filter((prompt) => prompt.enabled) || []);

  if (customPrompts && customPrompts.length > 0) {
    // Group custom prompts by position and depth to maintain order
    const topPrompts: typeof customPrompts = [];
    const bottomPrompts: typeof customPrompts = [];
    const depthGroups: Record<number, typeof customPrompts> = {};
    const defaultPrompts: typeof customPrompts = [];

    for (const customPrompt of customPrompts) {
      if (customPrompt.role !== "system" || !customPrompt.enabled) {
        continue;
      }

      if (customPrompt.position === "top") {
        topPrompts.push(customPrompt);
      } else if (customPrompt.position === "bottom") {
        bottomPrompts.push(customPrompt);
      } else if (customPrompt.position === "depth") {
        const depth = customPrompt.depth || 1;
        if (!depthGroups[depth]) {
          depthGroups[depth] = [];
        }
        depthGroups[depth].push(customPrompt);
      } else {
        // Default behavior: insert at the beginning
        defaultPrompts.push(customPrompt);
      }
    }

    // Process in order: default (top), top, depth (by depth value), bottom
    // Default prompts (insert at beginning in reverse order to maintain original order)
    for (let i = defaultPrompts.length - 1; i >= 0; i--) {
      const customPrompt = defaultPrompts[i];
      const systemPrompt = {
        type: "custom-field" as any,
        content: customPrompt.prompt,
        enabled: true,
      };
      prompts.unshift(systemPrompt);
    }

    // Top prompts (insert at beginning in reverse order to maintain original order)
    for (let i = topPrompts.length - 1; i >= 0; i--) {
      const customPrompt = topPrompts[i];
      const systemPrompt = {
        type: "custom-field" as any,
        content: customPrompt.prompt,
        enabled: true,
      };
      prompts.unshift(systemPrompt);
    }

    // Depth prompts (process by depth value, maintaining order within each depth)
    const sortedDepths = Object.keys(depthGroups)
      .map(Number)
      .sort((a, b) => a - b);
    for (const depth of sortedDepths) {
      const depthPrompts = depthGroups[depth];
      // Insert all prompts with the same depth at the same calculated position
      const insertPosition = Math.max(0, prompts.length - depth);

      // Insert in reverse order to maintain original sequence
      for (let i = depthPrompts.length - 1; i >= 0; i--) {
        const customPrompt = depthPrompts[i];
        const systemPrompt = {
          type: "custom-field" as any,
          content: customPrompt.prompt,
          enabled: true,
        };
        prompts.splice(insertPosition, 0, systemPrompt);
      }
    }

    // Bottom prompts (append in original order)
    for (const customPrompt of bottomPrompts) {
      const systemPrompt = {
        type: "custom-field" as any,
        content: customPrompt.prompt,
        enabled: true,
      };
      prompts.push(systemPrompt);
    }
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
        enabled: true,
      };
    } else {
      prompts.unshift({
        type: "context",
        content: systemOverridePrompt,
        enabled: true,
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

  return prompts.map((section) => section.content).join(contextSeparator || "\n\n");
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
  // biome-ignore lint/complexity/noForEach: I want to use foreach here
  customPrompts.forEach((customPrompt) => {
    if (!customPrompt.enabled || customPrompt.role === "system") {
      return;
    }

    const promptMessage: InferenceMessage = {
      role: customPrompt.role === "character" ? "assistant" : "user",
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
  const contextSeparator = config.formatTemplate?.config.context_separator?.replaceAll("\\n", "\n");
  // Step 1: Get chat history with user message
  const chatHistory = getChatHistory(structuredClone(config.messageHistory), config.userPrompt, prefixOption, config.chatConfig?.injectionPrompts);
  // Step 2: Process custom prompts from the chat template
  let processedMessages = processCustomPrompts(chatHistory, config.chatTemplate?.custom_prompts);

  // Get the order of lorebooks to be used (Character > User > Template)
  const LoreBookOrder = [config.chatConfig?.character?.lorebook_id, config.chatConfig?.user_character?.lorebook_id, ...(config.chatTemplate?.lorebook_list || [])].filter((id) => id) as string[];

  const LorebookBudget = config.chatTemplate?.config?.lorebook_token_budget || 400;

  const lorebookSeparator = config.formatTemplate?.config.lorebook_separator?.replaceAll("\\n", "\n");
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
    processedMessages = mergeSubsequentMessages(structuredClone(processedMessages), contextSeparator);
  }

  // Step 3: Create system prompt
  const rawSystemPrompt = createSystemPrompt({
    customPrompts: config.chatTemplate?.custom_prompts,
    systemPromptTemplate: config.formatTemplate,
    chatConfig: config.chatConfig,
    lorebookContent: lorebookContent.replacers,
    systemOverridePrompt: config.systemOverridePrompt,
    contextSeparator,
  });

  let formattedPrompt = replaceTextPlaceholders(processedMessages, rawSystemPrompt, config.chatConfig);

  if (config.formatTemplate?.config.settings.collapse_consecutive_lines) {
    formattedPrompt = collapseConsecutiveLines(structuredClone(formattedPrompt));
  }

  const limitedPrompt = await applyContextLimit(formattedPrompt, {
    config: config.chatTemplate?.config || { max_context: 100, max_tokens: 1500, max_depth: 100 },
    custom_prompts: config.chatTemplate?.custom_prompts || [],
  });

  if (!limitedPrompt.inferenceMessages.length) {
    throw new Error("After cutting off the context, no inference messages were left. Please adjust the context limit in the chat template.");
  }

  if (config.inferenceTemplate) {
    const inferencePrompt = await applyInferenceTemplate({
      systemPrompt: limitedPrompt.systemPrompt,
      inferenceTemplate: config.inferenceTemplate,
      messages: limitedPrompt.inferenceMessages,
      chatConfig: config.chatConfig,
      prefixOption,
    });

    return {
      inferenceMessages: inferencePrompt.messages,
      systemPrompt: inferencePrompt.systemPrompt,
      customStopStrings: inferencePrompt.customStopStrings,
    };
  }

  return { ...limitedPrompt, customStopStrings: [] };
}

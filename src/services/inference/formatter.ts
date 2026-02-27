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
import { replaceTextPlaceholders } from "./formatter/replace-text-placeholders";

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

      // Scripted prompt injections are resolved separately — skip them here
      if (message.extra?.promptConfig) {
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

      // before_user_input / after_user_input are inline message positions — not valid in the system prompt
      if (customPrompt.position === "before_user_input" || customPrompt.position === "after_user_input") {
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
      result.unshift(promptMessage);
    } else if (customPrompt.position === "bottom") {
      result.push(promptMessage);
    } else if (customPrompt.position === "depth") {
      const depth = customPrompt.depth || 1;
      const insertPosition = Math.max(0, result.length - depth);
      result.splice(insertPosition, 0, promptMessage);
    } else if (customPrompt.position === "before_user_input") {
      // Insert just before the last user-role message (the current user turn)
      let lastUserIdx = -1;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].role === "user") {
          lastUserIdx = i;
          break;
        }
      }
      if (lastUserIdx >= 0) {
        result.splice(lastUserIdx, 0, promptMessage);
      } else {
        result.push(promptMessage);
      }
    } else if (customPrompt.position === "after_user_input") {
      // Insert just after the last user-role message (the current user turn)
      let lastUserIdx = -1;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].role === "user") {
          lastUserIdx = i;
          break;
        }
      }
      if (lastUserIdx >= 0) {
        result.splice(lastUserIdx + 1, 0, promptMessage);
      } else {
        result.push(promptMessage);
      }
    }
  });

  return result;
}

/**
 * Resolve active scripted prompt injections from chat messages.
 *
 * "next" prompts: active only if the last scripted-next message in the list
 *   has no regular user/character message following it (i.e. it's the most
 *   recent actionable item).
 * "global" prompts: grouped by globalType (optionally scoped to agentId).
 *   For each group, only the most recent message is active.
 *
 * Disabled messages are ignored.
 */
export function resolveScriptedPrompts(messages: ChatMessage[]): ChatTemplateCustomPrompt[] {
  const activePrompts: ChatTemplateCustomPrompt[] = [];

  // Work through messages in position order (assumed sorted ascending)
  const ordered = [...messages].sort((a, b) => a.position - b.position);

  // ── "next" behavior ──────────────────────────────────────────────────────────
  // Find the last non-disabled scripted-next message, then check that nothing
  // regular (user/character) comes after it in the chat.
  let lastNextMsg: ChatMessage | null = null;
  let hasRegularAfterLastNext = false;

  for (const msg of ordered) {
    if (msg.disabled) {
      continue;
    }
    const pc = msg.extra?.promptConfig;
    if (pc && pc.behavior === "next") {
      lastNextMsg = msg;
      hasRegularAfterLastNext = false;
    } else if (msg.type === "user" || msg.type === "character") {
      if (lastNextMsg) {
        hasRegularAfterLastNext = true;
      }
    }
  }

  if (lastNextMsg && !hasRegularAfterLastNext) {
    const pc = lastNextMsg.extra!.promptConfig!;
    activePrompts.push({
      id: lastNextMsg.id,
      name: lastNextMsg.extra?.name ?? "Agent Prompt (Next)",
      role: pc.role,
      position: pc.position,
      depth: pc.depth,
      prompt: lastNextMsg.messages[lastNextMsg.message_index] ?? "",
      enabled: true,
      filter: {},
    });
  }

  // ── "global" behavior ────────────────────────────────────────────────────────
  // For each group key (globalType + optional agentId scope), keep only the
  // most recently positioned message.
  const globalGroups = new Map<string, ChatMessage>();

  for (const msg of ordered) {
    if (msg.disabled) {
      continue;
    }
    const pc = msg.extra?.promptConfig;
    if (!pc || pc.behavior !== "global") {
      continue;
    }

    const groupKey = pc.scopeToAgent
      ? `${pc.globalType ?? "__none__"}::${msg.extra?.agentId ?? "__unknown__"}`
      : `${pc.globalType ?? "__none__"}`;

    // Later positions overwrite earlier ones (ordered ascending)
    globalGroups.set(groupKey, msg);
  }

  for (const msg of globalGroups.values()) {
    const pc = msg.extra!.promptConfig!;
    activePrompts.push({
      id: msg.id,
      name: msg.extra?.name ?? "Agent Prompt (Global)",
      role: pc.role,
      position: pc.position,
      depth: pc.depth,
      prompt: msg.messages[msg.message_index] ?? "",
      enabled: true,
      filter: {},
    });
  }

  return activePrompts;
}

/**
 * Main format prompt function that orchestrates the prompt formatting process
 */
export async function formatPrompt(config: PromptFormatterConfig): Promise<FormattedPromptResult> {
  const prefixOption = config.formatTemplate?.config.settings.prefix_messages;
  const contextSeparator = config.formatTemplate?.config.context_separator?.replaceAll("\\n", "\n");

  // Resolve active scripted prompt injections from the raw message history
  const scriptedPrompts = resolveScriptedPrompts(config.messageHistory as ChatMessage[]);
  const mergedCustomPrompts = [...(config.chatTemplate?.custom_prompts ?? []), ...scriptedPrompts];

  // Step 1: Get chat history with user message (scripted prompt messages are skipped inside)
  const chatHistory = getChatHistory(structuredClone(config.messageHistory), config.userPrompt, prefixOption, config.chatConfig?.injectionPrompts);
  // Step 2: Process custom prompts (template + resolved scripted prompts)
  let processedMessages = processCustomPrompts(chatHistory, mergedCustomPrompts);

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

  // Step 3: Create system prompt (uses merged custom + scripted prompts)
  const rawSystemPrompt = createSystemPrompt({
    customPrompts: mergedCustomPrompts,
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
    custom_prompts: mergedCustomPrompts,
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

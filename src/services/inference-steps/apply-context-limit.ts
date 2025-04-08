import { ChatTemplate } from "@/schema/template-chat-schema";
import { FormattedPromptResult } from "./formatter";

interface FormattedPromptCutResult extends FormattedPromptResult {
  engine_max_tokens: {
    openai: number;
    anthropic: number;
  };
  max_tokens: number;
  total_tokens: number;
  frozen_tokens: number;
}

export const getTokenCount = (text: string) => Math.ceil(text.length / 4);

/**
 * Applies a context limit to the formatted prompt
 * TODO: This is a temporary solution to the context limit issue. Need to implement tokenizers.
 * @returns The formatted prompt with the context limit applied
 */
export function applyContextLimit(
  formattedPrompt: FormattedPromptResult,
  chatConfig: Pick<ChatTemplate, "config" | "custom_prompts">,
): FormattedPromptCutResult {
  const frozenTokens = getTokenCount(formattedPrompt.systemPrompt || "");
  const maxResponseTokens = chatConfig.config.max_tokens as number;
  const maxContextSize = (chatConfig.config.max_context as number) - maxResponseTokens;

  const maxMessageTokens = maxContextSize - frozenTokens;

  // Calculate token counts for each message
  const messagesWithTokens = formattedPrompt.inferenceMessages.map((message) => ({
    ...message,
    tokens: getTokenCount(message.text),
  }));

  // Preserve messages from tail (most recent), so reverse to process newest first
  const reversedMessages = [...messagesWithTokens].reverse();

  const includedMessages = [];
  let currentTokenCount = 0;
  const maxDepth = chatConfig.config.max_depth as number;

  // Add messages until we reach the token limit
  for (const message of reversedMessages) {
    if (currentTokenCount + message.tokens > maxMessageTokens) {
      break;
    }
    if (includedMessages.length >= maxDepth) {
      break;
    }
    includedMessages.push(message);
    currentTokenCount += message.tokens;
  }

  // Reverse back to original order (oldest to newest)
  const finalMessages = includedMessages.reverse().map(({ tokens, ...message }) => message);

  return {
    inferenceMessages: finalMessages,
    systemPrompt: formattedPrompt.systemPrompt,
    max_tokens: chatConfig.config.max_context as number,
    frozen_tokens: frozenTokens,
    total_tokens: currentTokenCount,
    engine_max_tokens: {
      openai: maxMessageTokens + maxResponseTokens,
      anthropic: maxMessageTokens + maxResponseTokens,
    },
  };
}

import { ChatTemplate } from "@/schema/template-chat-schema";
import { FormattedPromptResult } from "./formatter";

import { countTokens } from "@/commands/inference";
interface FormattedPromptCutResult extends FormattedPromptResult {
  statistics: {
    systemTokens: number;
    historyTokens: number;
    responseTokens: number;
  };
}

/**
 * This formula is not accurate, but it's a good estimate.
 * Testing in multiple chats give me around 8% error margin.
 */
function estimateTokens(text: string, padding = 164): number {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const punctCount = (text.match(/[.,!?;:()[\]{}'"\/\\<>@#$%^&*_\-+=|~`]/g) || []).length;
  const accentedCount = (text.match(/[áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g) || []).length;
  const contractionCount = (text.match(/\b(d[oa]s?|n[oa]s?|pel[oa]s?|a[oa]s?)\b/gi) || []).length;
  return Math.ceil(wordCount * 1.5 + punctCount * 0.3 + accentedCount * 0.1 + contractionCount * 0.2) + padding;
}

export const USE_TOKENIZER = true as const;
export const getTokenCount = async (text: string, useTokenizer = false) => {
  // ? Tokenizer slows down the APP.
  if (useTokenizer) {
    const result = await countTokens(text, "DEFAULT");
    return result.count;
  }

  const result = estimateTokens(text);
  return result;
};

/**
 * Applies a context limit to the formatted prompt
 * TODO: This is a temporary solution to the context limit issue. Need to implement tokenizers.
 * @returns The formatted prompt with the context limit applied
 */
export async function applyContextLimit(
  formattedPrompt: FormattedPromptResult,
  chatConfig: Pick<ChatTemplate, "config" | "custom_prompts">,
): Promise<FormattedPromptCutResult> {
  const frozenTokens = await getTokenCount(formattedPrompt.systemPrompt || "", USE_TOKENIZER);
  const maxResponseTokens = chatConfig.config.max_tokens as number;
  const maxContextSize = (chatConfig.config.max_context as number) - maxResponseTokens;

  const maxMessageTokens = maxContextSize - frozenTokens;
  // Calculate token counts for each message
  const messagesWithTokens = await Promise.all(
    formattedPrompt.inferenceMessages.map(async (message) => ({
      ...message,
      tokens: await getTokenCount(message.text),
    })),
  );

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
    statistics: {
      systemTokens: frozenTokens,
      historyTokens: currentTokenCount - frozenTokens,
      responseTokens: maxResponseTokens,
    },
  };
}

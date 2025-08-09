import { countTokens } from "@/commands/inference";
import { ChatTemplate } from "@/schema/template-chat-schema";
import { FormattedPromptResult } from "../formatter";

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
export function estimateTokens(text: string, padding = 32): number {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const punctCount = (text.match(/[.,!?;:()[\]{}'"/\\<>@#$%^&*_\-+=|~`]/g) || []).length;
  const accentedCount = (text.match(/[áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g) || []).length;
  const contractionCount = (text.match(/\b(d[oa]s?|n[oa]s?|pel[oa]s?|a[oa]s?)\b/gi) || []).length;
  return Math.ceil(wordCount * 1.5 + punctCount * 0.3 + accentedCount * 0.1 + contractionCount * 0.2) + padding;
}

export const USE_TOKENIZER = true as const;
export const USE_ESTIMATOR = false as const;

// Token count cache to avoid redundant tokenization
const tokenCache = new Map<string, number>();

export const getTokenCount = async (text: string, useTokenizer = false) => {
  // Check cache first
  const cacheKey = `${text}-${useTokenizer}`;
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey)!;
  }

  // ? Tokenizer slows down the APP.
  let result: number;
  if (useTokenizer) {
    result = (await countTokens(text, "DEFAULT")).count + 32;
  } else {
    result = estimateTokens(text);
  }

  // Cache the result
  tokenCache.set(cacheKey, result);
  return result;
};

/**
 * Applies a context limit to the formatted prompt
 * @returns The formatted prompt with the context limit applied
 */
export async function applyContextLimit(formattedPrompt: FormattedPromptResult, chatConfig: Pick<ChatTemplate, "config" | "custom_prompts">): Promise<FormattedPromptCutResult> {
  // Always use the tokenizer for system prompt as it's critical
  const frozenTokens = await getTokenCount(formattedPrompt.systemPrompt || "", USE_TOKENIZER);
  const maxResponseTokens = chatConfig.config.max_tokens as number;
  const maxContextSize = (chatConfig.config.max_context as number) - maxResponseTokens;

  const maxMessageTokens = maxContextSize - frozenTokens;

  // Use a hybrid approach: estimate tokens first, then refine with tokenizer if needed
  const messagesWithEstimatedTokens = await Promise.all(
    formattedPrompt.inferenceMessages.map(async (message) => ({
      ...message,
      tokens: await getTokenCount(message.text, USE_ESTIMATOR), // Use estimator first
    })),
  );

  // Preserve messages from tail (most recent), so reverse to process newest first
  const reversedMessages = [...messagesWithEstimatedTokens].reverse();

  const includedMessages = [];
  let currentTokenCount = 0;
  const maxDepth = chatConfig.config.max_depth as number;

  // First pass: Add messages using estimated tokens
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

  // Second pass (optimization): Only use tokenizer for the most recent messages (up to 3)
  // and only if we're close to the limit (within 10% margin)
  if (currentTokenCount > maxMessageTokens * 0.9) {
    currentTokenCount = 0;
    const recentMessagesToTokenize = includedMessages.slice(-3); // Last 3 messages

    for (let i = 0; i < includedMessages.length; i++) {
      const message = includedMessages[i];
      // Only use tokenizer for recent messages
      const useTokenizerForThisMessage = recentMessagesToTokenize.includes(message);
      message.tokens = await getTokenCount(message.text, useTokenizerForThisMessage);
      currentTokenCount += message.tokens;
    }

    // If we exceed the limit after accurate tokenization, remove messages as needed
    while (includedMessages.length > 0 && currentTokenCount > maxMessageTokens) {
      const removed = includedMessages.shift();
      if (removed) {
        currentTokenCount -= removed.tokens;
      }
    }
  }

  // Reverse back to original order (oldest to newest)
  const finalMessages = includedMessages.reverse().map(({ tokens, ...message }) => message);

  return {
    inferenceMessages: finalMessages,
    systemPrompt: formattedPrompt.systemPrompt,
    statistics: {
      systemTokens: frozenTokens,
      historyTokens: currentTokenCount,
      responseTokens: maxResponseTokens,
    },
  };
}

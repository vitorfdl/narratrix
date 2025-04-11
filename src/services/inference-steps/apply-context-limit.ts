import { countTokens } from "@/commands/inference";
import { ConsoleRequest } from "@/hooks/consoleStore";
import { ChatTemplate } from "@/schema/template-chat-schema";
import { FormattedPromptResult } from "./formatter";

interface FormattedPromptCutResult extends FormattedPromptResult, Pick<ConsoleRequest, "statistics"> {}

export const getTokenCount = async (text: string) => {
  const result = await countTokens(text, "DEFAULT");
  return result.count;
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
  const frozenTokens = await getTokenCount(formattedPrompt.systemPrompt || "");
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

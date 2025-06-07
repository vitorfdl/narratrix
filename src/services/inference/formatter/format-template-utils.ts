import { InferenceMessage } from "@/schema/inference-engine-schema";
import { FormattedPromptResult } from "../formatter";

/**
 * Collapses consecutive lines in messages text content
 * @param result FormattedPromptResult containing inference messages and other properties
 * @returns FormattedPromptResult with consecutive lines collapsed in messages
 */
export function collapseConsecutiveLines(result: FormattedPromptResult): FormattedPromptResult {
  const collapseText = (text: string) => text.replace(/\n{3,}/g, "\n\n");
  const processedMessages = result.inferenceMessages.map((message) => {
    if (!message.text) {
      return message;
    }

    // Replace consecutive line breaks with a single line break
    const collapsedText = collapseText(message.text);

    return {
      ...message,
      text: collapsedText,
    };
  });

  // Process system prompt if it exists
  const processedSystemPrompt = result.systemPrompt ? collapseText(result.systemPrompt) : result.systemPrompt;

  return {
    ...result,
    inferenceMessages: processedMessages,
    systemPrompt: processedSystemPrompt,
  };
}

/**
 * Merges all messages into a single user message
 * @param messages Array of inference messages
 * @returns Array with messages merged into a single user message
 */
export function mergeMessagesOnUser(messages: InferenceMessage[], separator = "\n\n"): InferenceMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  return [
    {
      role: "user",
      text: messages.map((message) => message.text).join(separator),
    },
  ];
}

/**
 * Merges adjacent messages from the same role
 * @param messages Array of inference messages
 * @returns Array with adjacent messages of the same role merged
 */
export function mergeSubsequentMessages(messages: InferenceMessage[], separator = "\n\n"): InferenceMessage[] {
  if (messages.length <= 1) {
    return messages;
  }

  const result: InferenceMessage[] = [];
  let currentRole: string | null = null;
  let currentTexts: string[] = [];

  // Process each message
  for (const message of messages) {
    // If this is a new role or first message
    if (currentRole === null || message.role !== currentRole) {
      // Add previous role's merged message if it exists
      if (currentRole !== null && currentTexts.length > 0) {
        result.push({
          role: currentRole as any, // Type assertion to handle any role
          text: currentTexts.join(separator),
        });
      }

      // Start new role tracking
      currentRole = message.role;
      currentTexts = message.text ? [message.text] : [];
    } else {
      // Same role, append text
      if (message.text) {
        currentTexts.push(message.text);
      }
    }
  }

  // Add the last role's merged message if it exists
  if (currentRole !== null && currentTexts.length > 0) {
    result.push({
      role: currentRole as any, // Type assertion to handle any role
      text: currentTexts.join(separator),
    });
  }

  return result;
}

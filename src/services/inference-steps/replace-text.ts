import { InferenceMessage } from "@/schema/inference-engine-schema";
import { FormattedPromptResult, PromptFormatterConfig } from "./prompt-formatter";

/**
 * Applies placeholder replacements to a given text string based on the configuration.
 */
function applyTextReplacements(text: string, config: PromptFormatterConfig["chatConfig"], isSystemPrompt = false): string {
  const { character, user_character, chapter, extra } = config || {};
  let processedText = text;

  if (character?.name) {
    processedText = processedText.replace(/\{\{char\}\}/g, character.name);
    processedText = processedText.replace(/\{\{character\.name\}\}/g, character.name);
  }
  if (user_character?.name) {
    processedText = processedText.replace(/\{\{user\}\}/g, user_character.name);
    processedText = processedText.replace(/\{\{user\.name\}\}/g, user_character.name);
  }
  if (character?.type === "character") {
    const personality = (character?.custom as any)?.personality;
    if (personality) {
      processedText = processedText.replace(/\{\{character\.personality\}\}/g, personality);
    }
  }
  if (user_character?.custom?.personality) {
    processedText = processedText.replace(/\{\{user\.personality\}\}/g, user_character.custom.personality);
  }
  if (chapter?.instructions) {
    processedText = processedText.replace(/\{\{chapter\.instructions\}\}/g, chapter.instructions);
  }

  // Process extra replacements
  if (extra && typeof extra === "object") {
    Object.entries(extra).forEach(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const placeholder = `{{${key}}}`;
        // Use a regex with the 'g' flag for global replacement
        const regex = new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g");
        processedText = processedText.replace(regex, String(value));
      }
    });
  }

  // Process system prompt specific replacements
  if (isSystemPrompt) {
    if (chapter?.title) {
      processedText = processedText.replace(/\{\{chapter\.title\}\}/g, chapter.title);
    }
    if (chapter?.scenario) {
      processedText = processedText.replace(/\{\{chapter\.scenario\}\}/g, chapter.scenario);
    }
  }

  return processedText;
}

/**
 * Replace placeholder text in messages and system prompt
 */
export function replaceTextPlaceholders(
  messages: InferenceMessage[],
  systemPrompt: string | undefined,
  config: PromptFormatterConfig["chatConfig"],
): FormattedPromptResult {
  const { character, user_character, chapter, extra } = config || {};

  // Skip if no replacements needed
  if (!character && !user_character && !chapter && !extra) {
    return { inferenceMessages: messages, systemPrompt };
  }

  console.log("⚠️ !> config", config);

  // Process text replacements in messages
  const processedMessages = messages.map((message) => ({
    ...message,
    ...(message.text ? { text: applyTextReplacements(message.text, config) } : {}),
  }));

  // Process text replacements in system prompt
  const processedSystemPrompt = systemPrompt ? applyTextReplacements(systemPrompt, config, true) : undefined;

  return {
    inferenceMessages: processedMessages,
    systemPrompt: processedSystemPrompt,
  };
}

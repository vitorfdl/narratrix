import { InferenceMessage } from "@/schema/inference-engine-schema";
import { applyCensorship } from "./apply-censorship";
import { FormattedPromptResult, PromptFormatterConfig } from "./formatter";

/**
 * Applies placeholder replacements to a given text string based on the configuration.
 */
function applyTextReplacements(text: string, config: PromptFormatterConfig["chatConfig"]): string {
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
  if (chapter?.scenario) {
    processedText = processedText.replace(/\{\{chapter\.scenario\}\}/g, chapter.scenario);
  }
  if (chapter?.title) {
    processedText = processedText.replace(/\{\{chapter\.title\}\}/g, chapter.title);
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

  return processedText;
}

/**
 * Random Pattern is a text embraced by a single bracket:
 * Using this script, the prompt:
 * A {{house|apartment|lodge|cottage}} in {{summer|winter|autumn|spring}} by {{2$$artist1|artist2|artist3}}
 * Will produce any of the following prompts:
 * A house in summer by artist1, artist2
 * A lodge in autumn by artist3, artist1
 * A cottage in winter by artist2, artist3
 * @param text
 */
export function replaceRandomPattern(text: string): string {
  // Regular expression to match patterns like {{option1|option2|...}}
  const patternRegex = /\{\{([^{}]+)\}\}/g;

  return text.replace(patternRegex, (match, content) => {
    // Split options by pipe character
    const options = content.split("|");

    // Check if this is a multi-select pattern (starts with a number followed by $$)
    const multiSelectMatch = options[0].match(/^(\d+)\$\$(.*)/);

    // Only process if it's a multi-select pattern or if there are multiple options (contains '|')
    if (multiSelectMatch || options.length > 1) {
      if (multiSelectMatch) {
        // Extract count and first option
        const count = Number.parseInt(multiSelectMatch[1], 10);
        options[0] = multiSelectMatch[2]; // Replace first option with cleaned version

        // Shuffle options and pick the first 'count' items
        const shuffled = [...options].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(count, options.length));

        // Join selected options with comma and space
        return selected.join(", ");
      }
      // Single selection from multiple options: pick a random option
      const randomIndex = Math.floor(Math.random() * options.length);
      return options[randomIndex];
    }
    // If it's not multi-select and has only one option (no '|'),
    // assume it's an unmatched variable placeholder and leave it unchanged.
    return match; // Return the original full match, e.g., "{{character.personality}}"
  });
}

/**
 * Replace placeholder text in messages and system prompt
 */
export function replaceTextPlaceholders(
  messages: InferenceMessage[],
  systemPrompt: string | undefined,
  config: PromptFormatterConfig["chatConfig"],
): FormattedPromptResult {
  // console.log("⚠️ !> config", config);
  const { character, user_character, chapter, extra, censorship } = config || {};

  // Skip if no replacements needed
  if (!character && !user_character && !chapter && !extra && !censorship) {
    return { inferenceMessages: messages, systemPrompt };
  }

  const processText = (text: string): string => {
    const withReplacements = applyTextReplacements(text, config);
    const withRandomPattern = replaceRandomPattern(withReplacements);
    return applyCensorship(withRandomPattern, censorship?.words || []);
  };

  // Process text replacements in messages
  const processedMessages = messages.map((message) => ({
    ...message,
    ...(message.text ? { text: processText(message.text) } : {}),
  }));

  // Process text replacements in system prompt
  const processedSystemPrompt = systemPrompt ? processText(systemPrompt) : undefined;

  return {
    inferenceMessages: processedMessages,
    systemPrompt: processedSystemPrompt,
  };
}

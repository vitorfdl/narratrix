import { InferenceMessage } from "@/schema/inference-engine-schema";
import { FormattedPromptResult, PromptFormatterConfig } from "../formatter";
import { applyCensorship } from "./apply-censorship";

/**
 * Applies placeholder replacements to a given text string based on the configuration.
 */
export function applyTextReplacements(text: string, config: PromptFormatterConfig["chatConfig"]): string {
  const { character, user_character, chapter, extra } = config || {};
  let processedText = structuredClone(text);

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

function normalizeConfig(config: PromptFormatterConfig["chatConfig"]): PromptFormatterConfig["chatConfig"] {
  if (!config) {
    return config;
  }
  const newconfig = structuredClone(config);

  if (newconfig.character?.custom?.personality) {
    newconfig.character.custom.personality = applyTextReplacements(newconfig.character.custom.personality, newconfig);
  }

  if (newconfig.user_character?.custom?.personality) {
    newconfig.user_character.custom.personality = applyTextReplacements(newconfig.user_character.custom.personality, newconfig);
  }

  if (newconfig.chapter?.scenario) {
    newconfig.chapter.scenario = applyTextReplacements(newconfig.chapter.scenario, newconfig);
  }

  if (newconfig.chapter?.title) {
    newconfig.chapter.title = applyTextReplacements(newconfig.chapter.title, newconfig);
  }

  return newconfig;
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
 * A dice Roll Pattern is a text started with "roll:" embraced by a single bracket:
 * - {{roll:1d20+5}}
 * It must roll a dice with the number of sides and modifier.
 * The result will be a random number between 1 and the number of sides, plus the modifier.
 * @param text
 */
export function replaceDiceRollPattern(text: string): string {
  // Regular expression to match dice roll patterns like {{roll:XdY+Z}} or {{roll:XdY-Z}} or {{roll:XdY}}
  const diceRollRegex = /\{\{roll:([^}]+)\}\}/g;

  return text.replace(diceRollRegex, (match, rollExpression) => {
    try {
      // Parse the dice roll expression (e.g., "1d20+5", "2d6-1", "1d100")
      // Updated regex to handle optional whitespace around components
      const dicePattern = /^\s*(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?\s*$/i;
      const diceMatch = rollExpression.trim().match(dicePattern);

      if (!diceMatch) {
        // Invalid dice notation, return original text
        return match;
      }

      const numDice = Number.parseInt(diceMatch[1], 10);
      const numSides = Number.parseInt(diceMatch[2], 10);
      // Handle modifier with potential whitespace by removing all spaces before parsing
      const modifier = diceMatch[3] ? Number.parseInt(diceMatch[3].replace(/\s/g, ""), 10) : 0;

      // Validate dice parameters
      if (numDice <= 0 || numDice > 100 || numSides <= 0 || numSides > 1000) {
        // Invalid parameters, return original text
        return match;
      }

      // Roll the dice
      let total = 0;
      for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * numSides) + 1;
      }

      // Apply modifier
      const finalResult = total + modifier;

      return finalResult.toString();
    } catch (error) {
      // If parsing fails, return the original match
      return match;
    }
  });
}

/**
 * Replaces date and time patterns with current date/time values:
 * - {{time}} - the current time (12-hour format with AM/PM)
 * - {{date}} - the current date (localized format)
 * - {{weekday}} - the current weekday name
 * - {{isotime}} - the current ISO time (24-hour clock, HH:MM:SS)
 * - {{isodate}} - the current ISO date (YYYY-MM-DD)
 * @param text
 */
export function replaceDateTimePattern(text: string, now = new Date()): string {
  // Define all date/time patterns and their replacements
  const patterns: Record<string, string> = {
    // Current time in 12-hour format with AM/PM
    "{{time}}": now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),

    // Current date in localized format
    "{{date}}": now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),

    // Current weekday name
    "{{weekday}}": now.toLocaleDateString("en-US", {
      weekday: "long",
    }),

    // Current ISO time (24-hour clock)
    "{{isotime}}": now.toTimeString().split(" ")[0], // HH:MM:SS format

    // Current ISO date (YYYY-MM-DD)
    "{{isodate}}": now.toISOString().split("T")[0], // YYYY-MM-DD format
  };

  let processedText = text;

  // Replace each pattern
  Object.entries(patterns).forEach(([pattern, replacement]) => {
    // Use global replacement with escaped regex pattern
    const escapedPattern = pattern.replace(/[{}]/g, "\\$&");
    const regex = new RegExp(escapedPattern, "g");
    processedText = processedText.replace(regex, replacement);
  });

  return processedText;
}

/**
 * Removes comment/note patterns from text:
 * - {{// this is a note}} - removes the entire pattern including the comment
 * This allows users to add internal notes or comments that won't appear in the final output.
 * @param text
 */
export function replaceCommentPattern(text: string): string {
  // Regular expression to match comment patterns like {{// any text here}}
  // This regex looks for {{ followed by // and then matches everything until the closing }}
  // It uses a non-greedy approach to handle nested braces properly
  const commentRegex = /\{\{\/\/.*?\}\}/g;

  // Remove all comment patterns by replacing them with empty string
  return text.replace(commentRegex, "");
}

/**
 * Replace placeholder text in a string
 * Alternative to replaceTextPlaceholders for strings
 */
export function replaceStringPlaceholders(text: string, config: PromptFormatterConfig["chatConfig"]) {
  const infereceMessageFormatted: InferenceMessage[] = [{ role: "user", text }];

  const response = replaceTextPlaceholders(infereceMessageFormatted, undefined, config);

  return response.inferenceMessages[0].text;
}

/**
 * Replace placeholder text in messages and system prompt
 */
export function replaceTextPlaceholders(
  messages: InferenceMessage[],
  systemPrompt: string | undefined,
  config: PromptFormatterConfig["chatConfig"],
): FormattedPromptResult {
  const { character, user_character, chapter, extra, censorship } = config || {};

  // Skip if no replacements needed
  if (!character && !user_character && !chapter && !extra && !censorship) {
    return { inferenceMessages: messages, systemPrompt };
  }

  const normalizedConfig = normalizeConfig(config);

  const processText = (text: string): string => {
    const withReplacements = applyTextReplacements(text, normalizedConfig);
    const withRandomPattern = replaceRandomPattern(withReplacements);
    const withDiceRolls = replaceDiceRollPattern(withRandomPattern);
    const withDateTimePattern = replaceDateTimePattern(withDiceRolls);
    const withCommentPattern = replaceCommentPattern(withDateTimePattern);
    return applyCensorship(withCommentPattern, censorship?.words || []);
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

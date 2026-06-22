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
    processedText = processedText.replace(/\{\{char\}\}/gi, character.name);
    processedText = processedText.replace(/\{\{character\.name\}\}/gi, character.name);
  }
  if (user_character?.name) {
    processedText = processedText.replace(/\{\{user\}\}/gi, user_character.name);
    processedText = processedText.replace(/\{\{user\.name\}\}/gi, user_character.name);
  }
  if (character?.type === "character") {
    const personality = (character?.custom as any)?.personality;
    if (personality) {
      processedText = processedText.replace(/\{\{character\.personality\}\}/gi, personality);
    }
  }
  if (user_character?.custom?.personality) {
    processedText = processedText.replace(/\{\{user\.personality\}\}/gi, user_character.custom.personality);
  }
  if (chapter?.scenario) {
    processedText = processedText.replace(/\{\{chapter\.scenario\}\}/gi, chapter.scenario);
  }
  if (chapter?.title) {
    processedText = processedText.replace(/\{\{chapter\.title\}\}/gi, chapter.title);
  }

  // Process extra replacements
  if (extra && typeof extra === "object") {
    Object.entries(extra).forEach(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const placeholder = `{{${key}}}`;
        // Use a regex with the 'g' flag for global replacement
        const regex = new RegExp(placeholder.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "gi");
        processedText = processedText.replace(regex, String(value));
      }
    });
  }

  return processedText;
}

/**
 * Renders a character-context section for ONE specific character, resolving the character-scoped
 * macros ({{char}}, {{character.name}}, {{character.personality}}) up front. This is used when a
 * format template repeats the character-context section per enabled character: the single global
 * placeholder pass only knows one character, so each repeated block must be pre-resolved here.
 *
 * Character-scoped macros inside the personality are resolved against THIS character; every other
 * macro ({{user}}, {{chapter}}, dice, date, …) is left untouched for the later global pass.
 * {{character.personality}} is always replaced (with "" when empty/non-character) so it can never
 * fall through to the global pass and pick up the generating character's personality.
 */
export function renderCharacterContext(content: string, character: NonNullable<PromptFormatterConfig["chatConfig"]>["character"]): string {
  const name = character?.name ?? "";
  const rawPersonality = character?.type === "character" ? ((character?.custom as any)?.personality ?? "") : "";
  // Resolve the character-scoped macros inside the personality against THIS character and strip any
  // self-referential {{character.personality}}, so no character-scoped macro can survive into the
  // global pass (which only knows the generating character). Replacement values are passed via
  // functions so "$" sequences in user-authored names/personalities are treated literally.
  const personality: string = rawPersonality
    ? rawPersonality
        .replace(/\{\{char\}\}/gi, () => name)
        .replace(/\{\{character\.name\}\}/gi, () => name)
        .replace(/\{\{character\.personality\}\}/gi, "")
    : "";

  return content
    .replace(/\{\{char\}\}/gi, () => name)
    .replace(/\{\{character\.name\}\}/gi, () => name)
    .replace(/\{\{character\.personality\}\}/gi, () => personality);
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
  const diceRollRegex = /\{\{roll:([^}]+)\}\}/gi;

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
    const regex = new RegExp(escapedPattern, "gi");
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
  // [\s\S] (not .) so a comment spanning multiple lines is removed, matching SillyTavern.
  // Lazy (*?) so the body terminates at the first closing braces.
  const commentRegex = /\{\{\/\/[\s\S]*?\}\}/g;

  // Remove all comment patterns by replacing them with empty string
  return text.replace(commentRegex, "");
}

/**
 * Removes {{trim}} markers along with the newlines immediately surrounding them, matching
 * SillyTavern. Only newlines are consumed — adjacent spaces and tabs are preserved — which
 * lets a prompt collapse blank lines left behind by conditional or empty macros.
 * Case-insensitive, so {{trim}}, {{Trim}}, and {{TRIM}} all apply.
 * @param text
 */
export function replaceTrimPattern(text: string): string {
  return text.replace(/(?:\r?\n)*\{\{trim\}\}(?:\r?\n)*/gi, "");
}

// Value allows one level of nested {{...}} macros before the closing braces
const SETVAR_PATTERN = /\{\{set(global)?var::([^:}]+)::((?:\{\{[^{}]*\}\}|[\s\S])*?)\}\}/gi;
const GETVAR_PATTERN = /\{\{get(global)?var::([^:}]+)\}\}/gi;

/**
 * Handles SillyTavern-style variable macros across a set of prompt texts:
 * - {{setvar::name::value}} / {{setglobalvar::name::value}} - stores the value and is removed from the text
 * - {{getvar::name}} / {{getglobalvar::name}} - replaced with the stored value, or "" when unset
 *
 * Variables are ephemeral: they live only for this single call (one prompt-formatting
 * pass) and are never persisted. Collection runs over all texts before substitution,
 * so a getvar can reference a setvar declared in a later prompt section — this mirrors
 * the steady-state behavior of SillyTavern presets without persisting anything.
 * Local and global variables use separate namespaces, as in SillyTavern.
 */
export function replaceVariablePatterns(texts: (string | undefined)[]): (string | undefined)[] {
  const variables = new Map<string, string>();
  const keyOf = (globalFlag: string | undefined, name: string) => `${globalFlag ? "global" : "local"}:${name.trim()}`;

  const collected = texts.map((text) =>
    text?.replace(SETVAR_PATTERN, (_match, globalFlag: string | undefined, name: string, value: string) => {
      variables.set(keyOf(globalFlag, name), value);
      return "";
    }),
  );

  // Resolve variable references inside stored values (bounded to guard against cycles)
  for (let depth = 0; depth < 5; depth++) {
    let changed = false;
    for (const [key, value] of variables) {
      const resolved = value.replace(GETVAR_PATTERN, (_match, globalFlag: string | undefined, name: string) => variables.get(keyOf(globalFlag, name)) ?? "");
      if (resolved !== value) {
        variables.set(key, resolved);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }

  return collected.map((text) => text?.replace(GETVAR_PATTERN, (_match, globalFlag: string | undefined, name: string) => variables.get(keyOf(globalFlag, name)) ?? ""));
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
export function replaceTextPlaceholders(messages: InferenceMessage[], systemPrompt: string | undefined, config: PromptFormatterConfig["chatConfig"]): FormattedPromptResult {
  const { censorship } = config || {};

  // Variable macros run first across all texts so getvar-inserted content
  // still goes through the remaining replacement chain ({{char}}, random, etc.)
  const [variableSystemPrompt, ...variableTexts] = replaceVariablePatterns([systemPrompt, ...messages.map((message) => message.text)]);
  const variableMessages = messages.map((message, index) => ({
    ...message,
    ...(variableTexts[index] !== undefined ? { text: variableTexts[index] } : {}),
  }));

  // processText always runs (no early-out on empty config): the content-independent macros
  // below — random, dice, date/time, comments, and {{trim}} — must resolve on every path, or
  // a {{// note}} or {{trim}} would leak to the model whenever no chat config is present.
  // applyTextReplacements and applyCensorship are no-ops without config / censor words.
  const normalizedConfig = normalizeConfig(config);

  const processText = (text: string): string => {
    const withReplacements = applyTextReplacements(text, normalizedConfig);
    const withRandomPattern = replaceRandomPattern(withReplacements);
    const withDiceRolls = replaceDiceRollPattern(withRandomPattern);
    const withDateTimePattern = replaceDateTimePattern(withDiceRolls);
    const withCommentPattern = replaceCommentPattern(withDateTimePattern);
    const withTrimPattern = replaceTrimPattern(withCommentPattern);
    return applyCensorship(withTrimPattern, censorship?.words || []);
  };

  // Process text replacements in messages
  const processedMessages = variableMessages.map((message) => ({
    ...message,
    ...(message.text ? { text: processText(message.text) } : {}),
  }));

  // Process text replacements in system prompt
  const processedSystemPrompt = variableSystemPrompt ? processText(variableSystemPrompt) : undefined;

  return {
    inferenceMessages: processedMessages,
    systemPrompt: processedSystemPrompt,
  };
}

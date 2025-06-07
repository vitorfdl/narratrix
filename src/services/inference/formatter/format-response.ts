import { FormatTemplate } from "@/schema/template-format-schema";
import { trimToEndSentence } from "./trim-incomplete-sentence";

interface FormatResult {
  text: string;
  reasoning: string | null;
}

export function formatFinalText(textRaw: string, formatTemplate?: FormatTemplate | null): FormatResult {
  if (!formatTemplate) {
    // Fallback to previous behavior if no template
    return {
      text: trimToEndSentence(textRaw).replace(/\n{3,}/g, "\n\n"),
      reasoning: null,
    };
  }

  let text = textRaw;
  let extractedReasoning: string | null = null;
  const settings = formatTemplate.config.settings;
  const reasoning = formatTemplate.config.reasoning;

  // 1. Extract and remove reasoning sections if prefix and suffix are defined
  if (reasoning?.prefix && reasoning?.suffix) {
    const reasoningRegex = new RegExp(`${escapeRegExp(reasoning.prefix)}([\\s\\S]*?)${escapeRegExp(reasoning.suffix)}`, "g");
    const matches = Array.from(text.matchAll(reasoningRegex));

    if (matches.length > 0) {
      // Extract the reasoning content (without the tags)
      extractedReasoning = matches
        .map((match) => match[1])
        .join("\n\n")
        .trim();

      // Remove the entire reasoning sections (including tags)
      const removeRegex = new RegExp(`${escapeRegExp(reasoning.prefix)}[\\s\\S]*?${escapeRegExp(reasoning.suffix)}`, "g");
      text = text.replace(removeRegex, "");
    }
  }

  // 2. Trim to end of sentence if enabled
  if (settings.trim_assistant_incomplete) {
    text = trimToEndSentence(text);
  }

  // 3. Collapse consecutive newlines if enabled
  if (settings.collapse_consecutive_lines) {
    text = text.replace(/\n{3,}/g, "\n\n");
  }

  // 4. Collapse double spaces if enabled
  if (settings.trim_double_spaces) {
    text = text.replace(/ {2,}/g, " ");
  }

  return {
    text: text.trim(),
    reasoning: extractedReasoning,
  };
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

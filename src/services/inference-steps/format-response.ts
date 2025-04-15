import { FormatTemplate } from "@/schema/template-format-schema";
import { trimToEndSentence } from "./trim-incomplete-sentence";

export function formatFinalText(textRaw: string, formatTemplate?: FormatTemplate | null) {
  if (!formatTemplate) {
    // Fallback to previous behavior if no template
    return trimToEndSentence(textRaw).replace(/\n{2,}/g, "\n");
  }

  let text = textRaw;
  const settings = formatTemplate.config.settings;

  // 1. Trim to end of sentence if enabled
  if (settings.trim_assistant_incomplete) {
    text = trimToEndSentence(text);
  }

  // 2. Collapse consecutive newlines if enabled
  if (settings.collapse_consecutive_lines) {
    text = text.replace(/\n{2,}/g, "\n");
  }

  // 3. Collapse double spaces if enabled
  if (settings.trim_double_spaces) {
    text = text.replace(/ {2,}/g, " ");
  }

  return text;
}

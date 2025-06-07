import { InferenceMessage } from "@/schema/inference-engine-schema";

export function applyCensorship(prompt: string, badWords: string[], replacer = "***"): string {
  if (!badWords || badWords.length === 0) {
    return prompt;
  }
  // Replace all (case-insensitive) occurrences of any bad word, even as a substring (partial match)
  if (!badWords || badWords.length === 0) {
    return prompt;
  }
  // Escape special regex characters in badWords to avoid regex injection
  const escapedBadWords = badWords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Create a regex that matches any bad word as a substring, case-insensitive, global
  const regex = new RegExp(`(${escapedBadWords.join("|")})`, "gi");
  return prompt.replace(regex, replacer);
}

export function applyCensorshipToMessages(messages: InferenceMessage[], badWords: string[], replacer = "***"): InferenceMessage[] {
  return messages.map((message) => ({
    ...message,
    text: applyCensorship(message.text, badWords, replacer),
  }));
}

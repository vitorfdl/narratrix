import { InferenceMessage } from "@/schema/inference-engine-schema";

export function applyCensorship(prompt: string, badWords: string[], replacer = "*"): string {
  return prompt.replace(new RegExp(`\\b(${badWords.join("|")})\\b`, "gi"), replacer);
}

export function applyCensorshipToMessages(messages: InferenceMessage[], badWords: string[], replacer = "*"): InferenceMessage[] {
  return messages.map((message) => ({
    ...message,
    text: applyCensorship(message.text, badWords, replacer),
  }));
}

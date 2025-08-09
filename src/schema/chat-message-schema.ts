import { z } from "zod";
import { SuggestionItem } from "@/components/markdownRender/markdown-textarea";
import { uuidUtils } from "./utils-schema";

const functionSuggestionList: SuggestionItem[] = [
  { title: "word1|word2|word3", description: "Randomizer", type: "function" },
  { title: "N$$word1|word2", description: "Randomize next N words", type: "function" },
  { title: "roll:1d20+5", description: "Roll a d20 with +5 modifier", type: "function" },
  { title: "roll:2d6", description: "Roll two d6 dice", type: "function" },
  { title: "roll:1d100", description: "Roll a percentile die", type: "function" },
  { title: "roll:3d6+2", description: "Roll 3d6 with +2 modifier", type: "function" },
];

const dateTimeSuggestionList: SuggestionItem[] = [
  { title: "time", description: "Current time (12-hour format with AM/PM)", type: "function" },
  { title: "date", description: "Current date (localized format)", type: "function" },
  { title: "weekday", description: "Current weekday name", type: "function" },
  { title: "isotime", description: "Current ISO time (24-hour clock)", type: "function" },
  { title: "isodate", description: "Current ISO date (YYYY-MM-DD)", type: "function" },
];

const commentSuggestionList: SuggestionItem[] = [{ title: "// comment text", description: "Internal note (removed from output)", type: "function" }];

export const basicPromptSuggestionList: SuggestionItem[] = [
  { title: "user", description: "User Character/Profile Name", section: "prompt" },
  { title: "char", description: "Character Name.", section: "prompt" },
  { title: "character.name", description: "Same as {{char}}", section: "prompt" },
  { title: "user.personality", section: "prompt" },
  { title: "character.personality", section: "prompt" },
  { title: "groups", description: "Comma-separated list of characters in the chat", section: "prompt" },
  ...functionSuggestionList.map((item) => ({ ...item, section: "function" as const })),
  ...dateTimeSuggestionList.map((item) => ({ ...item, section: "function" as const })),
  ...commentSuggestionList.map((item) => ({ ...item, section: "function" as const })),
];

export const promptReplacementSuggestionList: SuggestionItem[] = [
  ...basicPromptSuggestionList,
  { title: "character.expression", description: "Character latest expression", section: "prompt" },
  { title: "chapter.scenario", section: "prompt" },
  { title: "chapter.title", section: "prompt" },
  { title: "lorebook.top", section: "prompt" },
  { title: "lorebook.bottom", section: "prompt" },
];

/**
 * Chat Message Type Enum
 */
export const ChatMessageTypeSchema = z.enum(["user", "character", "system"]);
export type ChatMessageType = z.infer<typeof ChatMessageTypeSchema>;

const extraSchema = z.object({
  script: z.enum(["agent", "summary", "start_chapter"]).optional(),
  startPosition: z.number().int().optional(),
  endPosition: z.number().int().optional(),
});

/**
 * Chat Message Schema
 */
export const chatMessageSchema = z.object({
  id: uuidUtils.withDefault(),
  chat_id: uuidUtils.uuid(),
  chapter_id: uuidUtils.uuid(),
  character_id: uuidUtils.uuid().nullable(), // NULL for user messages
  type: ChatMessageTypeSchema,
  position: z.number().int().positive(), // Use 100, 200, 300 instead of 1,2,3
  messages: z.array(z.string()), // JSON Array of messages ["message", "message", "message"]
  message_index: z.number().int().min(0), // Use 0, 1, 2, 3... Refer to which message in the messages array this is
  disabled: z.boolean().optional().default(false),
  tokens: z.number().int().nullable().optional(),
  extra: extraSchema.optional().nullable().default({}),
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Request/Response Schemas
 */
export const createChatMessageSchema = chatMessageSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateChatMessageSchema = chatMessageSchema.partial().pick({
  messages: true,
  message_index: true,
  disabled: true,
  tokens: true,
  extra: true,
  character_id: true,
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type CreateChatMessageParams = z.infer<typeof createChatMessageSchema>;
export type UpdateChatMessageParams = z.infer<typeof updateChatMessageSchema>;

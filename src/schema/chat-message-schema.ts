import { SuggestionItem } from "@/components/ui/tiptap/tiptap-render";
import { z } from "zod";
import { uuidUtils } from "./utils-schema";

export const basicPromptSuggestionList: SuggestionItem[] = [
  { title: "user", description: "User Character Name or Profile Name" },
  { title: "char", description: "Character Name." },
  { title: "character.name" },
  { title: "user.personality" },
  { title: "character.personality" },
];

export const promptReplacementSuggestionList: SuggestionItem[] = [
  ...basicPromptSuggestionList,
  { title: "character.expression", description: "Character Latest Expression" },
  { title: "chapter.scenario" },
  { title: "chapter.title" },
];

/**
 * Chat Message Type Enum
 */
export const ChatMessageTypeSchema = z.enum(["user", "character", "system"]);
export type ChatMessageType = z.infer<typeof ChatMessageTypeSchema>;

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
  character_id: true,
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type CreateChatMessageParams = z.infer<typeof createChatMessageSchema>;
export type UpdateChatMessageParams = z.infer<typeof updateChatMessageSchema>;

import { z } from "zod";
import { uuidUtils } from "./utils-schema";

/**
 * Tab Types, stored in localstorage
 */
interface GridItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
}

interface ChatTab {
  id: string;
  name: string;
}

const chatParticipantSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(true),
  settings: z.record(z.any()).default({}),
});

const chatUserSettingsSchema = z.object({
  id: z.string(),
  settings: z.record(z.any()).default({}),
});

/**
 * Chat Schema
 */
const chatSchema = z.object({
  id: uuidUtils.withDefault(),
  profile_id: z.string(),
  name: z.string(),
  chat_template_id: z.string().optional(),
  active_chapter_id: z.string().default("").optional(),
  participants: chatParticipantSchema.array().default([]).optional(),
  user_character_id: z.string().optional(),
  user_character_settings: chatUserSettingsSchema.array().default([]).optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Request/Response Schemas
 */
const createChatSchema = chatSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export { chatSchema, createChatSchema };
export type { ChatTab, GridItem };
export type CreateChatParams = z.infer<typeof createChatSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type ChatParticipant = z.infer<typeof chatParticipantSchema>;
export type ChatUserSettings = z.infer<typeof chatUserSettingsSchema>;

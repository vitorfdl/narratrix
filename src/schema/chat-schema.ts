import { z } from "zod";
import { dateUtils, uuidUtils } from "./utils-schema";

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
  isActive: boolean;
  gridItems: GridItem[];
}

/**
 * Chat Schema
 */
const chatSchema = z.object({
  id: uuidUtils.withDefault(),
  profile_id: z.string(),
  title: z.string(),
  chat_template_id: z.string().optional(),
  participants: z.array(z.string()).default([]), // Array of character IDs
  chapters: z.array(z.record(z.any())).default([]),
  user_character_id: z.string().optional(),
  user_character_settings: z.record(z.any()).default({}),
  inference_settings: z.record(z.any()).default({}),
  created_at: dateUtils.withDefaultNow(),
  updated_at: dateUtils.withDefaultNow(),
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

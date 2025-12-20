import { z } from "zod";
import { uuidUtils } from "./utils-schema";

/**
 * Chat Memory Schema
 * Stores both short-term (chapter-specific) and long-term (chat-wide) memories
 * for characters and users.
 *
 * - chapter_id NULL = long-term memory
 * - chapter_id set = short-term memory
 * - character_id NULL = user memory
 * - character_id set = character memory
 */
export const chatMemorySchema = z.object({
  id: uuidUtils.withDefault(),
  chat_id: uuidUtils.uuid(),
  chapter_id: uuidUtils.uuid().nullable().optional(),
  character_id: uuidUtils.uuid().nullable().optional(),
  content: z.string(),
  metadata: z.record(z.any()).nullable().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Request/Response Schemas
 */
export const createChatMemorySchema = chatMemorySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateChatMemorySchema = chatMemorySchema.partial().pick({
  content: true,
  metadata: true,
  chapter_id: true,
  character_id: true,
});

export type ChatMemory = z.infer<typeof chatMemorySchema>;
export type CreateChatMemoryParams = z.infer<typeof createChatMemorySchema>;
export type UpdateChatMemoryParams = z.infer<typeof updateChatMemorySchema>;

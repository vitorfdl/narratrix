import { z } from "zod";
import { uuidUtils } from "./utils-schema";

/**
 * Chat Message Summary Schema
 */
export const chatMessageSummarySchema = z.object({
  id: uuidUtils.withDefault(),
  chat_id: uuidUtils.uuid(),
  chapter_id: uuidUtils.uuid(),
  range_start: z.number().int().nonnegative(),
  range_end: z.number().int().nonnegative(),
  summary: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Request/Response Schemas
 */
export const createChatMessageSummarySchema = chatMessageSummarySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateChatMessageSummarySchema = chatMessageSummarySchema.partial().pick({
  range_start: true,
  range_end: true,
  summary: true,
});

export type ChatMessageSummary = z.infer<typeof chatMessageSummarySchema>;
export type CreateChatMessageSummaryParams = z.infer<typeof createChatMessageSummarySchema>;
export type UpdateChatMessageSummaryParams = z.infer<typeof updateChatMessageSummarySchema>;

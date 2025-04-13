import { z } from "zod";
import { uuidUtils } from "./utils-schema";

const customChapterSchema = z
  .object({
    auto_start_message: z.boolean().optional().default(false),
    branchingOptions: z.array(z.string()).nullable().optional().default([]),
  })
  .default({});

/**
 * Chat Chapter Schema
 */
export const chatChapterSchema = z.object({
  id: uuidUtils.withDefault(),
  chat_id: uuidUtils.uuid(),
  title: z.string(),
  sequence: z.number().int().positive(),
  scenario: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  start_message: z.string().nullable().optional(),
  custom: customChapterSchema.nullable().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Request/Response Schemas
 */
export const createChatChapterSchema = chatChapterSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateChatChapterSchema = chatChapterSchema.partial().pick({
  title: true,
  sequence: true,
  scenario: true,
  instructions: true,
  start_message: true,
  custom: true,
});

export type ChatChapter = z.infer<typeof chatChapterSchema>;
export type CreateChatChapterParams = z.infer<typeof createChatChapterSchema>;
export type UpdateChatChapterParams = z.infer<typeof updateChatChapterSchema>;

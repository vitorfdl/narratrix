import { z } from "zod";
import { uuidUtils } from "./utils-schema";

/**
 * Lorebook Schema
 */
export const lorebookSchema = z.object({
  id: uuidUtils.withDefault(),
  profile_id: uuidUtils.uuid(),
  favorite: z.boolean().default(false),
  name: z.string(),
  description: z.string().nullable(),
  category: z.enum(["ruleset", "character", "world"]).nullable().default("ruleset"),
  tags: z.array(z.string()).default([]),
  allow_recursion: z.boolean().default(false),
  max_recursion_depth: z.number().int().default(25),
  max_depth: z.number().int().default(25),
  max_tokens: z.number().int().default(1000),
  group_keys: z.array(z.string()).default([]),
  extra: z.record(z.string(), z.any()).default({}),
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Lorebook Entry Schema
 */
export const lorebookEntrySchema = z.object({
  id: uuidUtils.withDefault(),
  lorebook_id: uuidUtils.uuid(),
  enabled: z.boolean().default(true),
  comment: z.string(), // A.k.a. "title"
  content: z.string().default(""),
  vector_content: z.string().nullable().optional(), // vectorized content for semantic search
  group_key: z.string().nullable().optional(), // A.k.a. "category"
  insertion_type: z.enum(["lorebook_top", "lorebook_bottom", "user", "assistant"]).default("lorebook_top"),
  depth: z.number().int().default(1),
  trigger_chance: z.number().int().default(100),
  priority: z.number().int().default(100),
  constant: z.boolean().default(false),
  keywords: z.array(z.string()).default([]),
  case_sensitive: z.boolean().default(false),
  match_partial_words: z.boolean().default(true),
  min_chat_messages: z.number().int().default(1),
  extra: z.record(z.string(), z.any()).default({}),
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Request/Response Schemas for Lorebook
 */
export const createLorebookSchema = lorebookSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  favorite: true,
});

export const updateLorebookSchema = lorebookSchema.partial().pick({
  name: true,
  description: true,
  category: true,
  tags: true,
  allow_recursion: true,
  max_recursion_depth: true,
  favorite: true,
  max_depth: true,
  max_tokens: true,
  group_keys: true,
  extra: true,
});

/**
 * Request/Response Schemas for Lorebook Entry
 */
export const createLorebookEntrySchema = lorebookEntrySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateLorebookEntrySchema = lorebookEntrySchema.partial().pick({
  enabled: true,
  comment: true,
  content: true,
  vector_content: true,
  group_key: true,
  insertion_type: true,
  depth: true,
  trigger_chance: true,
  priority: true,
  constant: true,
  keywords: true,
  case_sensitive: true,
  match_partial_words: true,
  min_chat_messages: true,
  extra: true,
});

/**
 * TypeScript Types
 */
export type Lorebook = z.infer<typeof lorebookSchema>;
export type CreateLorebookParams = z.infer<typeof createLorebookSchema>;
export type UpdateLorebookParams = z.infer<typeof updateLorebookSchema>;

export type LorebookEntry = z.infer<typeof lorebookEntrySchema>;
export type CreateLorebookEntryParams = z.infer<typeof createLorebookEntrySchema>;
export type UpdateLorebookEntryParams = z.infer<typeof updateLorebookEntrySchema>;

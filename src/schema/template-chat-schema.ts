import { z } from "zod";
import { baseTemplateSchema } from "./template-base-schema";
import { dateUtils } from "./utils-schema";

const chatTemplateCustomPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["user", "character", "system"]),
  filter: z.record(z.string()).default({}),
  position: z.enum(["top", "bottom", "depth"]),
  depth: z.number().optional().default(1), // Depth only applies to depth position
  prompt: z.string().default(""),
});

/**
 * Chat Template Schema
 */
export const chatTemplateSchema = baseTemplateSchema.extend({
  chat_id: z.string(),
  agent_model_id: z.string().nullable().optional(),
  character_model_id: z.string().nullable().optional(),
  config: z.record(z.any()).default({}),
  custom_prompts: chatTemplateCustomPromptSchema.array().default([]),
  created_at: dateUtils.withDefaultNow(),
  updated_at: dateUtils.withDefaultNow(),
});

export type ChatTemplate = z.infer<typeof chatTemplateSchema>;
export type ChatTemplateCustomPrompt = z.infer<typeof chatTemplateCustomPromptSchema>;

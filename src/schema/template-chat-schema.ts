import { z } from "zod";
import { baseTemplateSchema } from "./template-base-schema";

const chatTemplateCustomPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["user", "character", "system"]),
  filter: z.record(z.string()).optional().default({}),
  position: z.enum(["top", "bottom", "depth"]),
  depth: z.number().optional().default(1), // Depth only applies to depth position
  prompt: z.string().default(""),
});

/**
 * Chat Template Schema
 */
export const chatTemplateSchema = baseTemplateSchema.extend({
  model_id: z.string().nullable().optional(),
  format_template_id: z.string().nullable().optional(),
  config: z
    .object({
      max_tokens: z.number(),
      max_context: z.number().default(4096),
      max_depth: z.number().optional().default(100),
    })
    .passthrough()
    .default(() => ({ max_tokens: 8000, max_context: 4000, max_depth: 100 })),
  custom_prompts: chatTemplateCustomPromptSchema.array().default([]),
});

export type ChatTemplate = z.infer<typeof chatTemplateSchema>;
export type ChatTemplateCustomPrompt = z.infer<typeof chatTemplateCustomPromptSchema>;

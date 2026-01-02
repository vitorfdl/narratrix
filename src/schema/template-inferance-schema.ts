import { z } from "zod";
import { baseTemplateSchema } from "./template-base-schema";
import { templateFormattingSchema } from "./template-format-schema";

const assistantMessageFormattingSchema = templateFormattingSchema.extend({
  prefill: z.string().default(""),
  prefillOnlyCharacters: z.boolean().default(false),
});

const agentMessageFormattingSchema = templateFormattingSchema.extend({
  useSameAsUser: z.boolean().default(false),
  useSameAsSystemPrompt: z.boolean().default(false),
});

const inferenceConfigSchema = z.object({
  systemPromptFormatting: templateFormattingSchema.default({} as any),
  userMessageFormatting: templateFormattingSchema.default({} as any),
  assistantMessageFormatting: assistantMessageFormattingSchema.default({} as any),
  agentMessageFormatting: agentMessageFormattingSchema.default({} as any),
  customStopStrings: z.array(z.string()).default([]),
});

const inferenceTemplateSchema = baseTemplateSchema.extend({
  config: inferenceConfigSchema.default({} as any),
});

/**
 * Request/Response Schemas for Lorebook
 */
export const createInferenceTemplateSchema = inferenceTemplateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export { agentMessageFormattingSchema, assistantMessageFormattingSchema, inferenceTemplateSchema };

export type InferenceTemplate = z.infer<typeof inferenceTemplateSchema>;
export type AssistantMessageFormatting = z.infer<typeof assistantMessageFormattingSchema>;
export type AgentMessageFormatting = z.infer<typeof agentMessageFormattingSchema>;
export type CreateInferenceTemplateParams = z.infer<typeof createInferenceTemplateSchema>;

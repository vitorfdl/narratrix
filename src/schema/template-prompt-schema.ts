import { z } from "zod";
import { baseTemplateSchema } from "./template-base-schema";
// Define the enum values for SystemPromptType since it's only a type in the schema
const SYSTEM_PROMPT_TYPES = [
  "context",
  "chapter-context",
  "character-context",
  "user-context",
  "character-memory",
  "user-memory",
  "custom-field",
] as const;

const systemPromptTypeEnum = z.enum(SYSTEM_PROMPT_TYPES);

const systemPromptSectionSchema = z.object({
  type: systemPromptTypeEnum,
  content: z.string(),
});

const SystempPromptConfigSchema = z
  .array(systemPromptSectionSchema)
  .max(10)
  .default([
    {
      type: "context",
      content: "You are a helpful assistant that can answer questions and help with tasks.",
    },
  ]);

const systemPromptTemplateSchema = baseTemplateSchema.extend({
  config: SystempPromptConfigSchema.default([]),
});

export { SYSTEM_PROMPT_TYPES, SystempPromptConfigSchema, systemPromptTemplateSchema };

export type SystemPromptTemplate = z.infer<typeof systemPromptTemplateSchema>;
export type SystemPromptType = z.infer<typeof systemPromptTypeEnum>;
export type SystemPromptConfig = z.infer<typeof SystempPromptConfigSchema>;
export type SystemPromptSection = z.infer<typeof systemPromptSectionSchema>;

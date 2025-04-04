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

export const SYSTEM_PROMPT_DEFAULT_CONTENT: Record<SystemPromptType, string> = {
  context: "You are a helpful assistant that can answer questions and help with tasks.",
  "chapter-context": "# Scenario<br>{{chapter.title}}: {{chapter.scenario}}<br><br># Instructions<br>{{chapter.instructions}}",
  "character-context": "# Character<br>{{character.name}}: {{character.personality}}",
  "user-context": "# User<br>{{user.name}}: {{user.description}}",
  "character-memory": "# Character Memory<br>{{character.name}}: {{character.memory}}",
  "user-memory": "# User Memory<br>{{user.name}}: {{user.memory}}",
  "custom-field": "",
};

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

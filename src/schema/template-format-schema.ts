import { z } from "zod";
import { baseTemplateSchema } from "./template-base-schema";

// Define the enum values for SystemPromptType since it's only a type in the schema

const SYSTEM_PROMPT_TYPES = ["context", "chapter-context", "character-context", "user-context", "character-memory", "lorebook-top", "lorebook-bottom", "custom-field"] as const;

const SYSTEM_PROMPT_DEFAULT_CONTENT: Record<SystemPromptType, string> = {
  context: "You are a helpful assistant that can answer questions and help with tasks.",
  "chapter-context": "# Scenario\n{{chapter.title}}: {{chapter.scenario}}",
  "character-context": "# Character\n{{character.name}}: {{character.personality}}",
  "user-context": "# User\n{{user.name}}: {{user.personality}}",
  "character-memory": "# Character Past Events\n{{character.name}}: {{character.memory}}",
  "lorebook-top": "{{lorebook.top}}",
  "lorebook-bottom": "{{lorebook.bottom}}",
  "custom-field": "",
};
const systemPromptTypeEnum = z.enum(SYSTEM_PROMPT_TYPES);

const systemPromptSectionSchema = z.object({
  type: systemPromptTypeEnum,
  content: z.string(),
  enabled: z.boolean().optional().default(true),
  label: z.string().optional().nullable(),
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

const templateFormattingSchema = z.object({
  prefix: z.string().default(""),
  suffix: z.string().default(""),
});

const templateSettingsSchema = z.object({
  trim_assistant_incomplete: z.boolean().default(false),
  trim_double_spaces: z.boolean().default(true),
  collapse_consecutive_lines: z.boolean().default(true),
  prefix_messages: z.enum(["never", "always", "characters"]).default("never"),
  apply_censorship: z.boolean().default(false),
  merge_messages_on_user: z.boolean().default(false),
  merge_subsequent_messages: z.boolean().default(true),
});

const formatTemplateSchema = baseTemplateSchema.extend({
  config: z.object({
    settings: templateSettingsSchema.default({}),
    reasoning: templateFormattingSchema.default({}),
    context_separator: z.string().optional().default("\n---\n"),
    lorebook_separator: z.string().optional().default("\n---\n"),
  }),
  prompts: SystempPromptConfigSchema.default([]),
});

const newFormatTemplateSchema = formatTemplateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export { formatTemplateSchema, newFormatTemplateSchema, SYSTEM_PROMPT_DEFAULT_CONTENT, SYSTEM_PROMPT_TYPES, templateFormattingSchema, templateSettingsSchema };

export type TemplateFormatting = z.infer<typeof templateFormattingSchema>;
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;
export type FormatTemplate = z.infer<typeof formatTemplateSchema>;
export type SystemPromptType = z.infer<typeof systemPromptTypeEnum>;
export type SystemPromptConfig = z.infer<typeof SystempPromptConfigSchema>;
export type SystemPromptSection = z.infer<typeof systemPromptSectionSchema>;
export type NewFormatTemplate = z.infer<typeof newFormatTemplateSchema>;

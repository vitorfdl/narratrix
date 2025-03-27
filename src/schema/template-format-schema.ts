import { z } from "zod";
import { baseTemplateSchema } from "./template-base-schema";

const templateFormattingSchema = z.object({
  prefix: z.string().default(""),
  suffix: z.string().default(""),
});

const templateSettingsSchema = z.object({
  trim_assistant_incomplete: z.boolean().default(false),
  trim_double_spaces: z.boolean().default(true),
  collapse_consecutive_lines: z.boolean().default(true),
  completion_type: z.enum(["chat", "text", "both"]).default("chat"),
  prefix_messages: z.enum(["never", "always", "characters"]).default("never"),
  apply_censorship: z.boolean().default(false),
  merge_messages_on_user: z.boolean().default(false),
  merge_subsequent_messages: z.boolean().default(true),
});

const formatTemplateSchema = baseTemplateSchema.extend({
  inference_template_id: z.string().nullable(),
  prompt_template_id: z.string().nullable(),
  config: z.object({
    settings: templateSettingsSchema.default({}),
    reasoning: templateFormattingSchema.default({}),
    use_global_context: z.boolean().default(false),
  }),
});

export { formatTemplateSchema, templateFormattingSchema, templateSettingsSchema };

export type TemplateFormatting = z.infer<typeof templateFormattingSchema>;
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;
export type FormatTemplate = z.infer<typeof formatTemplateSchema>;

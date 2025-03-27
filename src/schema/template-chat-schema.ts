import { z } from "zod";
import { baseTemplateSchema } from "./template-base-schema";
import { dateUtils } from "./utils-schema";

/**
 * Chat Template Schema
 */
export const chatTemplateSchema = baseTemplateSchema.extend({
  id: z.string(),
  format_template_id: z.string(),
  config: z.record(z.any()).default({}),
  created_at: dateUtils.withDefaultNow(),
  updated_at: dateUtils.withDefaultNow(),
});

export type ChatTemplate = z.infer<typeof chatTemplateSchema>;

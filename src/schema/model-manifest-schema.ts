import { z } from "zod";

/**
 * Zod schema for manifest field structure
 */
export const ManifestFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  field_type: z.enum([
    "string",
    "number",
    "boolean",
    "secret",
    "url",
    "hidden",
  ]),
  hints: z.array(z.string()).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

/**
 * Zod schema for reasoning configuration
 */
export const ReasoningSchema = z.object({
  enabled: z.boolean().default(false),
  has_budget: z.boolean().optional().default(false),
  has_options: z.array(z.string()).optional(),
});

/**
 * Zod schema representing a manifest file structure
 */
export const ManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  website: z.string().optional(),
  type: z.literal("llm"),
  inference_type: z.array(z.string()),
  inference_fields: z.array(z.string()).optional(),
  engine: z.string(),
  reasoning: ReasoningSchema.optional(),
  fields: z.array(ManifestFieldSchema),
});

/**
 * Type definition derived from the Zod schema
 */
export type Manifest = z.infer<typeof ManifestSchema>;

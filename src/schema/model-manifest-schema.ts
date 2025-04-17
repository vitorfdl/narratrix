import { z } from "zod";

/**
 * Zod schema for manifest field structure
 */
export const ManifestFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  field_type: z.enum(["string", "number", "boolean", "secret", "url", "hidden"]),
  hints: z.array(z.string()).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  links: z
    .array(
      z.object({
        label: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
  request: z
    .object({
      label: z.string(),
      method: z.enum(["GET", "POST", "PUT"]),
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional(),
      response: z
        .object({
          label: z.string(),
          value: z.string(),
          parse: z.any(),
        })
        .optional(),
    })
    .optional(),
});

const engineSchema = z.enum(["openai_compatible", "openai", "anthropic", "google", "runpod", "aws_bedrock", "openrouter"]);
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
  engine: engineSchema,
  fields: z.array(ManifestFieldSchema),
});

/**
 * Type definition derived from the Zod schema
 */
export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestField = z.infer<typeof ManifestFieldSchema>;
export type Engine = z.infer<typeof engineSchema>;

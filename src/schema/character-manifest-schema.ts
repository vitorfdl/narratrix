import { z } from "zod";

// Field type definition
const fieldTypeEnum = z.enum(["string", "number", "textarea", "string_array", "output", "stepbutton"]);

// Field schema
const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: fieldTypeEnum,
  placeholder: z.string().optional(),
  value: z.string().optional(),
  default: z.string().optional(),
});

// Section schema
const sectionSchema = z.object({
  id: z.string().min(1),
  columns: z.number().int().min(1).max(10).default(1).optional(),
  fields: z.array(fieldSchema).min(1),
});

// Exported field schema
const exportedFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  depends: z.array(z.string()).optional(),
});

// Main character manifest schema
export const characterManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.literal("character"),
  columns: z.number().int().min(1).max(10).optional(),
  sections: z.array(sectionSchema).min(1),
  exported_fields: z.array(exportedFieldSchema).optional(),
});

// Type inference
export type CharacterManifest = z.infer<typeof characterManifestSchema>;
export type CharacterSection = z.infer<typeof sectionSchema>;
export type CharacterField = z.infer<typeof fieldSchema>;
export type ExportedField = z.infer<typeof exportedFieldSchema>;
export type FieldType = z.infer<typeof fieldTypeEnum>;

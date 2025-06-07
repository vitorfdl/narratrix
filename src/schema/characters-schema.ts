import { z } from "zod";

export const EXPRESSION_LIST = [
  "admiration",
  "amusement",
  "anger",
  "annoyance",
  "approval",
  "caring",
  "confusion",
  "curiosity",
  "desire",
  "disappointment",
  "disapproval",
  "disgust",
  "embarrassment",
  "excitement",
  "fear",
  "gratitude",
  "grief",
  "joy",
  "love",
  "nervousness",
  "optimism",
  "pride",
  "realization",
  "relief",
  "remorse",
  "sadness",
  "surprise",
  "neutral",
];

// Common JSON object schema
export const JsonObjectSchema = z.record(z.unknown());

// Expression schema (only for characters)
export const ExpressionSchema = z.object({
  id: z.string(),
  name: z.string(),
  image_path: z.string().nullable(),
});

const BaseCharacterTypeSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  name: z.string(),
  tags: z.array(z.string()).nullable().default([]),
  avatar_path: z.string().nullable(),
  lorebook_id: z.string().nullable(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default("1.0.0"),
  external_update_link: z.string().url().nullable(),
  auto_update: z.boolean().default(true),
  system_override: z.string().nullable(),
  settings: z
    .object({
      author: z.string().nullable().optional(),
    })
    .nullable()
    .default({}),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

// Character-specific schema
export const CharacterSchema = BaseCharacterTypeSchema.extend({
  type: z.literal("character"),
  expressions: z.array(ExpressionSchema).nullable(),
  character_manifest_id: z.string().nullable(),
  custom: z
    .object({
      personality: z.string().nullable().optional(),
    })
    .nullable()
    .default({}),
});

// Infer types from schemas
export type Character = z.infer<typeof CharacterSchema>;
export type Expression = z.infer<typeof ExpressionSchema>;

export const CreateCharacterSchema = CharacterSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  external_update_link: true,
  system_override: true,
  settings: true,
  custom: true,
});

// Update schemas (all fields optional)
export const UpdateCharacterSchema = CreateCharacterSchema.partial();

// Query schema
export const EntityQuerySchema = z.object({
  profile_id: z.string().optional(),
  type: z.enum(["agent", "character"]).optional(),
  name: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Sort schema
export const EntitySortSchema = z.object({
  field: z.enum(["name", "type", "updated_at", "created_at"]),
  direction: z.enum(["asc", "desc"]),
});

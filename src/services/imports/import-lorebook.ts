import { CreateLorebookEntryParams, CreateLorebookParams, Lorebook, createLorebookEntrySchema, createLorebookSchema } from "@/schema/lorebook-schema";
import { z } from "zod";
import { createLorebook, createLorebookEntry } from "../lorebook-service";
import { LorebookSpecV2, transformLorebookSpecV2, validateLorebookSpecV2 } from "./formats/lorebook_spec_v2";

/**
 * Supported lorebook import formats.
 */
export type LorebookImportFormat = "internal_json" | "v2" | "unknown";

/**
 * Schema for internal lorebook import format (V1).
 * This extends the base lorebook schema to include entries.
 */
const internalLorebookImportSchema = createLorebookSchema.extend({
  entries: z.array(createLorebookEntrySchema.omit({ lorebook_id: true })).optional(),
});

/**
 * Result type for validation and transformation.
 */
interface ValidationTransformationResult {
  valid: boolean;
  errors: string[];
  data: z.infer<typeof internalLorebookImportSchema> | null;
  format: LorebookImportFormat;
}

/**
 * Validates the internal JSON lorebook format using Zod.
 * @param data - The parsed JSON data
 * @returns ValidationTransformationResult
 */
function validateInternalLorebookJSON(data: any): ValidationTransformationResult {
  const parseResult = internalLorebookImportSchema.safeParse(data);
  if (parseResult.success) {
    return {
      valid: true,
      errors: [],
      data: parseResult.data,
      format: "internal_json",
    };
  }
  return {
    valid: false,
    errors: parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    data: null,
    format: "internal_json",
  };
}

/**
 * Attempts to validate and transform the parsed lorebook data, detecting its format (V1 or V2).
 * @param data - The parsed JSON data from the file.
 * @param profileId - The profile ID to associate the lorebook with.
 * @param fileName - The name of the imported file.
 * @returns A result object containing the validation status, errors, transformed data (if valid), and detected format.
 */
export function validateAndTransformLorebookData(data: any, profileId: string, fileName: string): ValidationTransformationResult {
  // 1. Try validating as internal JSON (V1)
  const internalResult = validateInternalLorebookJSON({ ...data, profile_id: profileId });
  if (internalResult.valid) {
    return internalResult;
  }

  // 2. Try validating as V2
  const v2Validation = validateLorebookSpecV2(data);
  if (v2Validation.valid) {
    const transformedData = transformLorebookSpecV2(data as LorebookSpecV2, fileName);
    // Transform to match our internal schema structure with proper typing
    const internalData: z.infer<typeof internalLorebookImportSchema> = {
      profile_id: profileId,
      name: transformedData.name,
      description: transformedData.description,
      category: transformedData.category,
      tags: transformedData.tags,
      allow_recursion: transformedData.allow_recursion,
      max_recursion_depth: transformedData.max_recursion_depth,
      max_depth: transformedData.max_depth,
      max_tokens: transformedData.max_tokens,
      group_keys: transformedData.group_keys,
      extra: transformedData.extra,
      entries: transformedData.entries,
    };

    return {
      valid: true,
      errors: [],
      data: internalData,
      format: "v2",
    };
  }

  // 3. Unknown format
  return {
    valid: false,
    errors: [
      ...internalResult.errors,
      ...v2Validation.errors,
      "Unknown or unsupported lorebook file format. Only internal JSON and V2 formats are currently supported.",
    ],
    data: null,
    format: "unknown",
  };
}

/**
 * Process a lorebook file (V1 or V2) and import it into the database.
 * Assumes data has been validated and transformed by `validateAndTransformLorebookData`.
 * @param validatedData - The lorebook data validated by Zod schemas.
 * @returns The imported lorebook.
 * @throws If `validatedData` is null or invalid.
 */
export async function importLorebook(validatedData: z.infer<typeof internalLorebookImportSchema>): Promise<Lorebook> {
  // Create the lorebook using the validated data directly
  const lorebookData: CreateLorebookParams = {
    profile_id: validatedData.profile_id,
    name: validatedData.name,
    description: validatedData.description,
    category: validatedData.category,
    tags: validatedData.tags,
    allow_recursion: validatedData.allow_recursion,
    max_recursion_depth: validatedData.max_recursion_depth,
    max_depth: validatedData.max_depth,
    max_tokens: validatedData.max_tokens,
    group_keys: validatedData.group_keys,
    extra: validatedData.extra,
  };

  const lorebook = await createLorebook(lorebookData);

  // Create entries if present
  if (validatedData.entries && validatedData.entries.length > 0) {
    for (const entry of validatedData.entries) {
      const entryData: CreateLorebookEntryParams = {
        lorebook_id: lorebook.id,
        comment: entry.comment,
        content: entry.content,
        keywords: entry.keywords ?? [],
        enabled: entry.enabled ?? true,
        constant: entry.constant ?? false,
        case_sensitive: entry.case_sensitive ?? false,
        match_partial_words: entry.match_partial_words ?? true,
        priority: entry.priority ?? 100,
        depth: entry.depth ?? 1,
        group_key: entry.group_key || null,
        insertion_type: entry.insertion_type ?? "lorebook_top",
        trigger_chance: entry.trigger_chance ?? 100,
        min_chat_messages: entry.min_chat_messages ?? 1,
        extra: entry.extra ?? {},
      };

      await createLorebookEntry(entryData);
    }
  }

  return lorebook;
}

/**
 * Parse lorebook file content.
 * @param fileContent - The string content of the file.
 * @returns The parsed lorebook data (as generic 'any' before format detection).
 * @throws If JSON parsing fails.
 */
export function parseLorebookContent(fileContent: string): any {
  try {
    const data = JSON.parse(fileContent);
    // Basic check to ensure it's not null/undefined after parsing
    if (data === null || data === undefined) {
      throw new Error("Parsed JSON content is null or undefined.");
    }
    // Further validation happens in `validateAndTransformLorebookData`
    return data;
  } catch (error) {
    console.error("Parsing error:", error);
    // Provide a more specific error message if possible
    const message = error instanceof Error ? error.message : "Unknown JSON parsing error.";
    throw new Error(`Failed to parse file content as JSON: ${message}`);
  }
}

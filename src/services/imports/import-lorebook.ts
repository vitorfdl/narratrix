import { CreateLorebookEntryParams, CreateLorebookParams, Lorebook } from "@/schema/lorebook-schema";
import { createLorebook, createLorebookEntry } from "../lorebook-service";
import { LorebookSpecV2, transformLorebookSpecV2, validateLorebookSpecV2 } from "./formats/lorebook_spec_v2";

export interface LorebookImportFile {
  name: string;
  description?: string | null; // Allow null
  category?: "ruleset" | "character" | "world" | null;
  tags?: string[];
  entries?: {
    comment: string;
    content: string;
    keywords?: string[];
    enabled?: boolean;
    constant?: boolean;
    case_sensitive?: boolean;
    match_partial_words?: boolean;
    priority?: number;
    depth?: number;
    group_key?: string | null;
    // Add missing fields from CreateLorebookEntryParams needed after transformation
    insertion_type?: "lorebook_top" | "lorebook_bottom" | "user" | "assistant";
    trigger_chance?: number;
    min_chat_messages?: number;
    extra?: Record<string, any>;
  }[];
}

/**
 * Result type for validation and transformation.
 */
interface ValidationTransformationResult {
  valid: boolean;
  errors: string[];
  data: LorebookImportFile | null;
  format: "v1" | "v2" | "unknown";
}

/**
 * Validates a potential V1 lorebook import file format.
 * @param data - The parsed JSON data
 * @returns ValidationResult indicating if the file is valid and any error messages
 */
function validateInternalJSON(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    // Basic object check, differentiating from V2's root structure
    errors.push("Data is not a valid V1 object structure.");
    return { valid: false, errors };
  }

  // Check required fields for V1
  if (!data.name || typeof data.name !== "string") {
    errors.push("V1 format error: Missing or invalid lorebook name");
  }

  // Optional category validation for V1
  if (data.category && !["ruleset", "character", "world", null].includes(data.category)) {
    errors.push("V1 format error: Invalid category value");
  }

  // Validate entries if present for V1
  if (data.entries !== undefined) {
    if (!Array.isArray(data.entries)) {
      errors.push("V1 format error: 'entries' field must be an array.");
    } else {
      data.entries.forEach((entry: any, index: number) => {
        if (!entry || typeof entry !== "object") {
          errors.push(`Entry ${index + 1}: Invalid entry format.`);
          return;
        }
        if (!entry.comment || typeof entry.comment !== "string") {
          errors.push(`Entry ${index + 1}: Missing or invalid comment/title`);
        }
        if (!entry.content || typeof entry.content !== "string") {
          errors.push(`Entry ${index + 1}: Missing or invalid content`);
        }
        // Add more specific V1 entry field validations if necessary
      });
    }
  }

  // If no errors were found specifically indicating V1 structure is broken, assume it might be V1.
  // Stricter validation could check for the *absence* of V2-specific fields like top-level `entries` object key.
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Attempts to validate and transform the parsed lorebook data, detecting its format (V1 or V2).
 * @param data - The parsed JSON data from the file.
 * @param fileName - The name of the imported file.
 * @returns A result object containing the validation status, errors, transformed data (if valid), and detected format.
 */
export function validateAndTransformLorebookData(data: any, fileName: string): ValidationTransformationResult {
  // 1. Try validating as V1
  const v1Validation = validateInternalJSON(data);
  if (v1Validation.valid) {
    // Assume it's V1 if basic structure matches
    return {
      valid: true,
      errors: [],
      data: data as LorebookImportFile, // Cast as it passed V1 validation
      format: "v1",
    };
  }

  // 2. If not V1, try validating as V2
  const v2Validation = validateLorebookSpecV2(data);
  if (v2Validation.valid) {
    // If V2 validation passes, transform it
    const transformedData = transformLorebookSpecV2(data as LorebookSpecV2, fileName);
    return {
      valid: true,
      errors: [],
      data: transformedData,
      format: "v2",
    };
  }

  // 3. If neither validation passes, report combined errors (prioritize V1 errors if both failed)
  const combinedErrors = [...new Set([...v1Validation.errors, ...v2Validation.errors])]; // Simple combination
  return {
    valid: false,
    errors: combinedErrors.length > 0 ? combinedErrors : ["Unknown file format or invalid structure."],
    data: null,
    format: "unknown",
  };
}

/**
 * Process a lorebook file (V1 or V2) and import it into the database.
 * Assumes data has been validated and transformed by `validateAndTransformLorebookData`.
 * @param transformedData - The lorebook data in the internal `LorebookImportFile` format.
 * @param profileId - The profile ID to associate the lorebook with.
 * @returns The imported lorebook.
 * @throws If `transformedData` is null or invalid.
 */
export async function importLorebook(transformedData: LorebookImportFile, profileId: string): Promise<Lorebook> {
  // Create the lorebook
  const lorebookData: CreateLorebookParams = {
    profile_id: profileId,
    name: transformedData.name,
    description: transformedData.description || null,
    category: transformedData.category || null,
    tags: transformedData.tags || [],
    // Apply defaults from schema if not provided by transformed data
    allow_recursion: false,
    max_recursion_depth: 25,
    max_depth: 25,
    max_tokens: 1000,
    group_keys: [],
    extra: {},
  };

  const lorebook = await createLorebook(lorebookData);

  // Create entries if present
  if (transformedData.entries && transformedData.entries.length > 0) {
    for (const entry of transformedData.entries) {
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

import { LorebookEntry } from "@/schema/lorebook-schema";
import { z } from "zod";

// Import the schema from the main import file
import { createLorebookEntrySchema, createLorebookSchema } from "@/schema/lorebook-schema";
import { replaceSillytavernFunctions } from "./sillytavern_helper";

// Define the entry type without lorebook_id
type LorebookEntryImportType = Omit<z.infer<typeof createLorebookEntrySchema>, "lorebook_id">;

// Define the internal import schema type locally to avoid circular imports
type InternalLorebookImportType = z.infer<typeof createLorebookSchema> & {
  entries?: LorebookEntryImportType[];
};

/**
 * Interface representing a single entry in the Lorebook V2 specification.
 */
export interface LorebookSpecV2Entry {
  key: string[];
  keysecondary?: string[];
  comment: string;
  content: string;
  constant?: boolean;
  vectorized?: boolean;
  selective?: boolean;
  selectiveLogic?: number;
  addMemo?: boolean;
  order?: number;
  position?: number;
  disable?: boolean;
  excludeRecursion?: boolean;
  preventRecursion?: boolean;
  delayUntilRecursion?: boolean;
  probability?: number;
  useProbability?: boolean;
  depth?: number;
  group?: string;
  groupOverride?: boolean;
  groupWeight?: number;
  scanDepth?: number | null;
  caseSensitive?: boolean | null;
  matchWholeWords?: boolean | null;
  useGroupScoring?: boolean | null;
  automationId?: string;
  role?: string | null;
  sticky?: number;
  cooldown?: number;
  delay?: number;
  uid?: number;
  displayIndex?: number;
}

/**
 * Interface representing the structure of the Lorebook V2 specification file.
 * Entries are stored as an object with numerical string keys.
 */
export interface LorebookSpecV2 {
  entries: Record<string, LorebookSpecV2Entry>;
  // Other top-level properties might exist but are ignored for import.
  [key: string]: any;
}

/**
 * Validates if the provided data conforms to the Lorebook V2 specification.
 * @param data - The parsed JSON data.
 * @returns An object indicating if the data is valid and a list of errors.
 */
export function validateLorebookSpecV2(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    errors.push("Invalid V2 data: Input is not an object.");
    return { valid: false, errors };
  }

  if (!data.entries || typeof data.entries !== "object" || Array.isArray(data.entries)) {
    errors.push("Invalid V2 data: Missing or invalid 'entries' object.");
    return { valid: false, errors };
  }

  Object.entries(data.entries).forEach(([index, entry]: [string, any]) => {
    if (!entry || typeof entry !== "object") {
      errors.push(`Entry ${index}: Invalid entry format.`);
      return; // Skip further checks for this invalid entry
    }
    if (!entry.key || !Array.isArray(entry.key) || !entry.key.every((k: any) => typeof k === "string")) {
      errors.push(`Entry ${index}: Missing or invalid 'key' (must be an array of strings).`);
    }
    if (typeof entry.comment !== "string") {
      errors.push(`Entry ${index}: Missing or invalid 'comment' (must be a string).`);
    }
    if (typeof entry.content !== "string") {
      errors.push(`Entry ${index}: Missing or invalid 'content' (must be a string).`);
    }
    // Add checks for other fields if strict validation is needed (e.g., type checks for optional fields)
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Transforms data from Lorebook V2 format to the internal lorebook import format.
 * @param data - The validated Lorebook V2 data.
 * @param fileName - The original filename, used as the lorebook name.
 * @returns The transformed data in internal import format.
 */
export function transformLorebookSpecV2(data: LorebookSpecV2, fileName: string): Omit<InternalLorebookImportType, "profile_id"> {
  const lorebookName = fileName.replace(/\.json$/i, ""); // Remove .json extension for the name

  const transformedEntries: LorebookEntryImportType[] = Object.values(data.entries).map((entry) => {
    // --- Insertion Type Mapping ---
    let insertion_type: LorebookEntry["insertion_type"];
    switch (entry.position) {
      case 0:
      case 2:
      case 5:
        insertion_type = "lorebook_top";
        break;
      case 1:
      case 3:
      case 6:
        insertion_type = "lorebook_bottom";
        break;
      case 4:
        insertion_type = "user";
        break;
      default:
        insertion_type = "lorebook_top"; // Default if position is missing or invalid
    }

    // --- Inverse Boolean Mapping ---
    const enabled = entry.disable !== undefined ? !entry.disable : true; // Default to true if 'disable' is missing
    // Default to true if 'matchWholeWords' is missing or null, invert if present
    const match_partial_words = entry.matchWholeWords !== undefined && entry.matchWholeWords !== null ? !entry.matchWholeWords : true;

    return {
      comment: entry.comment,
      content: replaceSillytavernFunctions(entry.content),
      keywords: entry.key || [],
      enabled: enabled,
      constant: entry.constant ?? false,
      // V2 `caseSensitive` can be null, map null/undefined to false
      case_sensitive: entry.caseSensitive ?? false,
      match_partial_words: match_partial_words,
      priority: entry.order ?? 100, // Default priority
      depth: entry.depth ?? 1, // Default depth
      group_key: entry.group || null, // Map 'group' to 'group_key'
      insertion_type: insertion_type,
      // V2 `useProbability` must be true for probability to apply
      trigger_chance: entry.useProbability && entry.probability !== undefined ? entry.probability : 100, // Default chance
      // Add defaults for fields not in V2 spec
      min_chat_messages: 1,
      extra: {},
      vector_content: null,
    };
  });

  return {
    name: lorebookName,
    category: "world" as const, // Default category for V2 imports
    description: `Imported from ${fileName}`, // Optional: Add a default description
    tags: [], // No direct mapping for tags in V2 spec
    allow_recursion: false,
    max_recursion_depth: 25,
    max_depth: 25,
    max_tokens: 1000,
    group_keys: [],
    extra: {},
    entries: transformedEntries,
  };
}

import { ChatTemplate, chatTemplateSchema } from "@/schema/template-chat-schema";
import { SillyTavernChatTemplate, transformSillyTavernTemplate, validateSillyTavernTemplate } from "./formats/sillytavern_chat_template";

/**
 * Supported chat template import formats.
 */
export type ChatTemplateImportFormat = "internal_json" | "sillytavern" | "unknown";

/**
 * Result type for validation and transformation.
 */
interface ValidationTransformationResult {
  valid: boolean;
  errors: string[];
  data: Omit<ChatTemplate, "id" | "created_at" | "updated_at"> | null;
  format: ChatTemplateImportFormat;
}

/**
 * Detects and validates the internal JSON chat template format using Zod.
 * @param data - The parsed JSON data
 * @returns ValidationTransformationResult
 */
function validateInternalChatTemplateJSON(data: any): ValidationTransformationResult {
  // Create a schema for import that excludes auto-generated fields
  const importSchema = chatTemplateSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  const parseResult = importSchema.safeParse(data);
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
 * Attempts to validate and transform the parsed chat template data, detecting its format.
 * @param data - The parsed JSON data from the file.
 * @param profileId - The profile ID to associate the template with.
 * @returns A result object containing the validation status, errors, transformed data (if valid), and detected format.
 */
export function validateAndTransformChatTemplateData(data: any, profileId: string, fileName: string): ValidationTransformationResult {
  // 1. Try validating as internal JSON
  const internalResult = validateInternalChatTemplateJSON({ ...data, profile_id: profileId });
  if (internalResult.valid) {
    return internalResult;
  }

  // 2. Try validating as SillyTavern format
  const sillyTavernValidation = validateSillyTavernTemplate(data);
  if (sillyTavernValidation.valid) {
    const transformed = transformSillyTavernTemplate(data as SillyTavernChatTemplate, profileId, fileName);
    return {
      valid: true,
      errors: [],
      data: transformed.template,
      format: "sillytavern",
    };
  }

  // 3. Unknown format
  return {
    valid: false,
    errors: [
      ...internalResult.errors,
      ...sillyTavernValidation.errors,
      "Unknown or unsupported chat template file format. Only internal JSON and SillyTavern formats are currently supported.",
    ],
    data: null,
    format: "unknown",
  };
}

/**
 * Parse chat template file content (JSON only for now).
 * @param fileContent - The string content of the file.
 * @returns The parsed template data (as generic 'any' before format detection).
 * @throws If JSON parsing fails.
 */
export function parseChatTemplateContent(fileContent: string): any {
  try {
    const data = JSON.parse(fileContent);
    if (data === null || data === undefined) {
      throw new Error("Parsed JSON content is null or undefined.");
    }
    return data;
  } catch (error) {
    console.error("Parsing error:", error);
    const message = error instanceof Error ? error.message : "Unknown JSON parsing error.";
    throw new Error(`Failed to parse file content as JSON: ${message}`);
  }
}

import { FormatTemplate, formatTemplateSchema } from "@/schema/template-format-schema";
import { SillyTavernFormatTemplate, transformSillyTavernFormatTemplate, validateSillyTavernFormatTemplate } from "./formats/sillytavern_format_template";

/**
 * Supported format template import formats.
 */
export type FormatTemplateImportFormat = "internal_json" | "sillytavern" | "unknown";

/**
 * Result type for validation and transformation.
 */
interface ValidationTransformationResult {
  valid: boolean;
  errors: string[];
  data: Omit<FormatTemplate, "id" | "created_at" | "updated_at"> | null;
  format: FormatTemplateImportFormat;
}

/**
 * Detects and validates the internal JSON format template format using Zod.
 * @param data - The parsed JSON data
 * @returns ValidationTransformationResult
 */
function validateInternalFormatTemplateJSON(data: any): ValidationTransformationResult {
  // Create a schema for import that excludes auto-generated fields
  const importSchema = formatTemplateSchema.omit({
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
    errors: parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    data: null,
    format: "internal_json",
  };
}

/**
 * Attempts to validate and transform the parsed format template data, detecting its format.
 * @param data - The parsed JSON data from the file.
 * @param profileId - The profile ID to associate the template with.
 * @param fileName - The original file name for naming the template.
 * @returns A result object containing the validation status, errors, transformed data (if valid), and detected format.
 */
export function validateAndTransformFormatTemplateData(data: any, profileId: string, fileName: string): ValidationTransformationResult {
  // 1. Try validating as internal JSON
  const internalResult = validateInternalFormatTemplateJSON({ ...data, profile_id: profileId });
  if (internalResult.valid) {
    return internalResult;
  }

  // 2. Try validating as SillyTavern format
  const sillyTavernValidation = validateSillyTavernFormatTemplate(data);
  if (sillyTavernValidation.valid) {
    const transformed = transformSillyTavernFormatTemplate(data as SillyTavernFormatTemplate, profileId, fileName);
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
    errors: [...internalResult.errors, ...sillyTavernValidation.errors, "Unknown or unsupported format template file format. Only internal JSON and SillyTavern formats are currently supported."],
    data: null,
    format: "unknown",
  };
}

/**
 * Parse format template file content (JSON only for now).
 * @param fileContent - The string content of the file.
 * @returns The parsed template data (as generic 'any' before format detection).
 * @throws If JSON parsing fails.
 */
export function parseFormatTemplateContent(fileContent: string): any {
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

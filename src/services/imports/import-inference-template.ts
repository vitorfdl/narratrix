import { z } from "zod";
import { CreateInferenceTemplateParams, createInferenceTemplateSchema } from "@/schema/template-inferance-schema";
import { createInferenceTemplate } from "../template-inference-service";

/**
 * Supported inference template import formats.
 */
export type InferenceTemplateImportFormat = "internal_json" | "sillytavern" | "unknown";

/**
 * SillyTavern instruct template format schema
 */
const sillyTavernInstructSchema = z.object({
  instruct: z.object({
    input_sequence: z.string().default(""),
    output_sequence: z.string().default(""),
    last_output_sequence: z.string().default(""),
    system_sequence: z.string().default(""),
    stop_sequence: z.string().default(""),
    wrap: z.boolean().optional(),
    macro: z.boolean().optional(),
    activation_regex: z.string().optional(),
    system_sequence_prefix: z.string().default(""),
    system_sequence_suffix: z.string().default(""),
    first_output_sequence: z.string().optional(),
    skip_examples: z.boolean().optional(),
    output_suffix: z.string().default(""),
    input_suffix: z.string().default(""),
    system_suffix: z.string().default(""),
    user_alignment_message: z.string().optional(),
    system_same_as_user: z.boolean().optional(),
    last_system_sequence: z.string().optional(),
    first_input_sequence: z.string().optional(),
    last_input_sequence: z.string().optional(),
    names_behavior: z.string().optional(),
    names_force_groups: z.boolean().optional(),
    name: z.string(),
  }),
});

export type SillyTavernInstruct = z.infer<typeof sillyTavernInstructSchema>;

/**
 * Result type for validation and transformation.
 */
interface ValidationTransformationResult {
  valid: boolean;
  errors: string[];
  data: CreateInferenceTemplateParams | null;
  format: InferenceTemplateImportFormat;
}

/**
 * Detects and validates the internal JSON inference template format using Zod.
 * @param data - The parsed JSON data
 * @returns ValidationTransformationResult
 */
function validateInternalInferenceTemplateJSON(data: any): ValidationTransformationResult {
  const parseResult = createInferenceTemplateSchema.safeParse(data);
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
 * Validates SillyTavern instruct template format.
 * @param data - The parsed JSON data
 * @returns Validation result
 */
function validateSillyTavernInstruct(data: any): { valid: boolean; errors: string[] } {
  const parseResult = sillyTavernInstructSchema.safeParse(data);
  if (parseResult.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

/**
 * Transforms SillyTavern instruct template to internal format.
 * @param data - The validated SillyTavern data
 * @param profileId - The profile ID to associate the template with
 * @returns Transformed template data
 */
function transformSillyTavernInstruct(data: SillyTavernInstruct, profileId: string): CreateInferenceTemplateParams {
  const instruct = data.instruct;

  return {
    profile_id: profileId,
    name: instruct.name,
    favorite: false,
    config: {
      systemPromptFormatting: {
        prefix: instruct.system_sequence_prefix || instruct.system_sequence,
        suffix: instruct.system_sequence_suffix || instruct.system_suffix,
      },
      userMessageFormatting: {
        prefix: instruct.input_sequence,
        suffix: instruct.input_suffix,
      },
      assistantMessageFormatting: {
        prefix: instruct.output_sequence,
        suffix: instruct.output_suffix,
        prefill: instruct.last_output_sequence,
        prefillOnlyCharacters: false,
      },
      agentMessageFormatting: {
        prefix: "",
        suffix: "",
        useSameAsUser: true, // Always set to true
        useSameAsSystemPrompt: false,
      },
      customStopStrings: instruct.stop_sequence ? [instruct.stop_sequence] : [],
    },
  };
}

/**
 * Attempts to validate and transform the parsed inference template data, detecting its format.
 * @param data - The parsed JSON data from the file.
 * @param profileId - The profile ID to associate the template with.
 * @returns A result object containing the validation status, errors, transformed data (if valid), and detected format.
 */
export function validateAndTransformInferenceTemplateData(data: any, profileId: string): ValidationTransformationResult {
  // 1. Try validating as internal JSON
  const internalResult = validateInternalInferenceTemplateJSON({ ...data, profile_id: profileId });
  if (internalResult.valid) {
    return internalResult;
  }

  // 2. Try validating as SillyTavern instruct template
  const sillyTavernValidation = validateSillyTavernInstruct(data);
  if (sillyTavernValidation.valid) {
    const transformed = transformSillyTavernInstruct(data as SillyTavernInstruct, profileId);
    return {
      valid: true,
      errors: [],
      data: transformed,
      format: "sillytavern",
    };
  }

  // 3. Unknown format
  return {
    valid: false,
    errors: [
      ...internalResult.errors,
      ...sillyTavernValidation.errors,
      "Unknown or unsupported inference template file format. Only internal JSON and SillyTavern instruct templates are currently supported.",
    ],
    data: null,
    format: "unknown",
  };
}

/**
 * Imports an inference template into the database from validated and transformed data.
 * @param transformedData - The template data in the internal format.
 * @returns The imported template.
 * @throws If `transformedData` is null or invalid.
 */
export async function importInferenceTemplate(transformedData: CreateInferenceTemplateParams) {
  if (!transformedData) {
    throw new Error("No inference template data provided for import.");
  }

  // Use the service to create the template
  const template = await createInferenceTemplate(transformedData);
  return template;
}

/**
 * Parse inference template file content (JSON only for now).
 * @param fileContent - The string content of the file.
 * @returns The parsed template data (as generic 'any' before format detection).
 * @throws If JSON parsing fails.
 */
export function parseInferenceTemplateContent(fileContent: string): any {
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

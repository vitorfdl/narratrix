import { z } from "zod";
import { FormatTemplate, SYSTEM_PROMPT_DEFAULT_CONTENT, SystemPromptSection } from "@/schema/template-format-schema";
import { replaceSillytavernFunctions } from "./sillytavern_helper";

// Zod schema for SillyTavern instruct section
const SillyTavernInstructSchema = z.object({
  input_sequence: z.string().optional(),
  output_sequence: z.string().optional(),
  last_output_sequence: z.string().optional(),
  system_sequence: z.string().optional(),
  stop_sequence: z.string().optional(),
  wrap: z.boolean().optional(),
  macro: z.boolean().optional(),
  activation_regex: z.string().optional(),
  system_sequence_prefix: z.string().optional(),
  system_sequence_suffix: z.string().optional(),
  first_output_sequence: z.string().optional(),
  skip_examples: z.boolean().optional(),
  output_suffix: z.string().optional(),
  input_suffix: z.string().optional(),
  system_suffix: z.string().optional(),
  user_alignment_message: z.string().optional(),
  system_same_as_user: z.boolean().optional(),
  last_system_sequence: z.string().optional(),
  first_input_sequence: z.string().optional(),
  last_input_sequence: z.string().optional(),
  names_behavior: z.enum(["always", "force", "never"]).optional(),
  names_force_groups: z.boolean().optional(),
  name: z.string().optional(),
});

// Zod schema for SillyTavern context section
const SillyTavernContextSchema = z.object({
  story_string: z.string().optional(),
  example_separator: z.string().optional(),
  chat_start: z.string().optional(),
  use_stop_strings: z.boolean().optional(),
  names_as_stop_strings: z.boolean().optional(),
  always_force_name2: z.boolean().optional(),
  trim_sentences: z.boolean().optional(),
  single_line: z.boolean().optional(),
  name: z.string().optional(),
});

// Zod schema for SillyTavern sysprompt section
const SillyTavernSyspromptSchema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
});

// Zod schema for SillyTavern reasoning section
const SillyTavernReasoningSchema = z.object({
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  separator: z.string().optional(),
  name: z.string().optional(),
});

// Main SillyTavern format template schema
const SillyTavernFormatTemplateSchema = z.object({
  instruct: SillyTavernInstructSchema.optional(),
  context: SillyTavernContextSchema.optional(),
  sysprompt: SillyTavernSyspromptSchema.optional(),
  reasoning: SillyTavernReasoningSchema.optional(),
});

export type SillyTavernFormatTemplate = z.infer<typeof SillyTavernFormatTemplateSchema>;

export interface SillyTavernFormatTransformResult {
  template: Omit<FormatTemplate, "id" | "created_at" | "updated_at">;
}

/**
 * Validate if the input is a valid SillyTavern format template JSON.
 */
export function validateSillyTavernFormatTemplate(data: any): { valid: boolean; errors: string[] } {
  const result = SillyTavernFormatTemplateSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

/**
 * Parse the story_string to extract different prompt sections based on {{#if}} blocks.
 */
function parseStoryString(storyString: string): SystemPromptSection[] {
  const prompts: SystemPromptSection[] = [];

  // Default prompts if story_string is empty or undefined
  if (!storyString) {
    return [
      { type: "context", content: SYSTEM_PROMPT_DEFAULT_CONTENT.context, enabled: true },
      { type: "lorebook-top", content: SYSTEM_PROMPT_DEFAULT_CONTENT["lorebook-top"], enabled: true },
      { type: "chapter-context", content: SYSTEM_PROMPT_DEFAULT_CONTENT["chapter-context"], enabled: true },
      { type: "character-context", content: SYSTEM_PROMPT_DEFAULT_CONTENT["character-context"], enabled: true },
      { type: "user-context", content: SYSTEM_PROMPT_DEFAULT_CONTENT["user-context"], enabled: true },
      { type: "lorebook-bottom", content: SYSTEM_PROMPT_DEFAULT_CONTENT["lorebook-bottom"], enabled: true },
    ];
  }

  // Extract system prompt (everything before first {{#if}})
  const systemMatch = storyString.match(/^(.*?)(?:\{\{#if|$)/s);
  if (systemMatch?.[1]?.trim()) {
    prompts.push({
      type: "context",
      content: replaceSillytavernFunctions(systemMatch[1].trim()),
      enabled: true,
    });
  }

  // Extract wiBefore (lorebook-top)
  const wiBeforeMatch = storyString.match(/\{\{#if wiBefore\}\}(.*?)\{\{\/if\}\}/s);
  if (wiBeforeMatch) {
    prompts.push({
      type: "lorebook-top",
      content: replaceSillytavernFunctions(wiBeforeMatch[1].trim()),
      enabled: true,
    });
  }

  // Extract description (character-context)
  const descriptionMatch = storyString.match(/\{\{#if description\}\}(.*?)\{\{\/if\}\}/s);
  if (descriptionMatch) {
    prompts.push({
      type: "character-context",
      content: replaceSillytavernFunctions(descriptionMatch[1].trim()),
      enabled: true,
    });
  }

  // Extract personality
  const personalityMatch = storyString.match(/\{\{#if personality\}\}(.*?)\{\{\/if\}\}/s);
  if (personalityMatch) {
    // Add to character-context if it exists, otherwise create new
    const existingCharContext = prompts.find((p) => p.type === "character-context");
    if (existingCharContext) {
      existingCharContext.content += `\n${personalityMatch[1].trim()}`;
    } else {
      prompts.push({
        type: "character-context",
        content: replaceSillytavernFunctions(personalityMatch[1].trim()),
        enabled: true,
      });
    }
  }

  // Extract scenario (chapter-context)
  const scenarioMatch = storyString.match(/\{\{#if scenario\}\}(.*?)\{\{\/if\}\}/s);
  if (scenarioMatch) {
    prompts.push({
      type: "chapter-context",
      content: replaceSillytavernFunctions(scenarioMatch[1].trim()),
      enabled: true,
    });
  }

  // Extract wiAfter (lorebook-bottom)
  const wiAfterMatch = storyString.match(/\{\{#if wiAfter\}\}(.*?)\{\{\/if\}\}/s);
  if (wiAfterMatch) {
    prompts.push({
      type: "lorebook-bottom",
      content: replaceSillytavernFunctions(wiAfterMatch[1].trim()),
      enabled: true,
    });
  }

  // Extract persona (user-context)
  const personaMatch = storyString.match(/\{\{#if persona\}\}(.*?)\{\{\/if\}\}/s);
  if (personaMatch) {
    prompts.push({
      type: "user-context",
      content: replaceSillytavernFunctions(personaMatch[1].trim()),
      enabled: true,
    });
  }

  // If no prompts were extracted, return defaults
  if (prompts.length === 0) {
    return [
      { type: "context", content: replaceSillytavernFunctions(SYSTEM_PROMPT_DEFAULT_CONTENT.context), enabled: true },
      { type: "lorebook-top", content: replaceSillytavernFunctions(SYSTEM_PROMPT_DEFAULT_CONTENT["lorebook-top"]), enabled: true },
      { type: "chapter-context", content: replaceSillytavernFunctions(SYSTEM_PROMPT_DEFAULT_CONTENT["chapter-context"]), enabled: true },
      { type: "character-context", content: replaceSillytavernFunctions(SYSTEM_PROMPT_DEFAULT_CONTENT["character-context"]), enabled: true },
      { type: "user-context", content: replaceSillytavernFunctions(SYSTEM_PROMPT_DEFAULT_CONTENT["user-context"]), enabled: true },
      { type: "lorebook-bottom", content: replaceSillytavernFunctions(SYSTEM_PROMPT_DEFAULT_CONTENT["lorebook-bottom"]), enabled: true },
    ];
  }

  return prompts;
}

/**
 * Transform a SillyTavern format template JSON to the internal FormatTemplate format.
 */
export function transformSillyTavernFormatTemplate(data: SillyTavernFormatTemplate, profileId: string, fileName: string): SillyTavernFormatTransformResult {
  // Extract template name from context.name, instruct.name, or fileName
  const templateName = data.context?.name || data.instruct?.name || fileName.replace(/\.[^/.]+$/, "");

  // Map settings from context and instruct sections
  const settings = {
    trim_assistant_incomplete: data.context?.trim_sentences ?? false,
    trim_double_spaces: true, // Default value, not in SillyTavern
    collapse_consecutive_lines: data.context?.single_line === false,
    prefix_messages: mapNamesBeahvior(data.instruct?.names_behavior),
    apply_censorship: false, // Default value, not in SillyTavern
    merge_messages_on_user: false, // Default value, not in SillyTavern
    merge_subsequent_messages: true, // Default value, not in SillyTavern
  };

  // Map reasoning configuration
  const reasoning = {
    prefix: data.reasoning?.prefix ?? "",
    suffix: data.reasoning?.suffix ?? "",
  };

  // Map separators
  const contextSeparator = data.context?.example_separator ?? "\n\n";
  const lorebookSeparator = data.context?.example_separator ?? "\n---\n";

  // Parse story_string to extract prompts
  const prompts = parseStoryString(data.context?.story_string || "");

  // Create the template object
  const template: Omit<FormatTemplate, "id" | "created_at" | "updated_at"> = {
    profile_id: profileId,
    name: templateName,
    favorite: false,
    config: {
      settings,
      reasoning,
      context_separator: contextSeparator,
      lorebook_separator: lorebookSeparator,
    },
    prompts,
  };

  return { template };
}

/**
 * Map SillyTavern names_behavior to our prefix_messages setting.
 */
function mapNamesBeahvior(namesBehavior?: "always" | "force" | "never"): "never" | "always" | "characters" {
  switch (namesBehavior) {
    case "always":
      return "always";
    case "force":
      return "characters";
    default:
      return "never";
  }
}

import { z } from "zod";
import { ChatTemplate, ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { replaceSillytavernFunctions } from "./sillytavern_helper";

// Zod schema for SillyTavern prompt structure
const SillyTavernPromptSchema = z.object({
  identifier: z.string(),
  name: z.string(),
  system_prompt: z.boolean().optional(),
  enabled: z.boolean().optional(),
  marker: z.boolean().optional(),
  role: z.enum(["system", "user", "assistant"]).optional(),
  content: z.string().optional(),
  injection_position: z.number().optional(),
  injection_depth: z.number().optional(),
  forbid_overrides: z.boolean().optional(),
});

// Zod schema for SillyTavern prompt order
const SillyTavernPromptOrderSchema = z.object({
  character_id: z.number().optional(),
  order: z.array(
    z.object({
      identifier: z.string(),
      enabled: z.boolean(),
    }),
  ),
});

// Zod schema for SillyTavern chat template minimal validation
const SillyTavernChatTemplateSchema = z
  .object({
    // Inference parameters we care about
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    top_k: z.number().optional(),
    openai_max_context: z.number().optional(),
    openai_max_tokens: z.number().optional(),
    frequency_penalty: z.number().optional(),
    presence_penalty: z.number().optional(),
    top_a: z.number().optional(),
    min_p: z.number().optional(),
    repetition_penalty: z.number().optional(),
    seed: z.number().optional(),
    n: z.number().optional(),

    // Prompts array
    prompts: z.array(SillyTavernPromptSchema),

    // Prompt order array
    prompt_order: z.array(SillyTavernPromptOrderSchema).optional(),

    // Other fields we don't need but should allow
  })
  .passthrough();

export type SillyTavernChatTemplate = z.infer<typeof SillyTavernChatTemplateSchema>;

export interface SillyTavernTransformResult {
  template: Omit<ChatTemplate, "id" | "created_at" | "updated_at">;
}

/**
 * Validate if the input is a valid SillyTavern chat template JSON.
 */
export function validateSillyTavernTemplate(data: any): { valid: boolean; errors: string[] } {
  const result = SillyTavernChatTemplateSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

/**
 * Transform a SillyTavern chat template JSON to the internal ChatTemplate format.
 * - Maps inference parameters to config
 * - Converts prompts to custom_prompts with proper ordering and enabled state
 */
export function transformSillyTavernTemplate(data: SillyTavernChatTemplate, profileId: string, fileName: string): SillyTavernTransformResult {
  // Extract inference parameters and map to our config format
  const config: ChatTemplate["config"] = {
    max_tokens: data.openai_max_tokens || 1024,
    max_context: data.openai_max_context || 4096,
    max_depth: 100, // Default value since SillyTavern doesn't have this concept
  };

  // Map SillyTavern inference parameters to our config
  if (data.temperature !== undefined) {
    config.temperature = data.temperature;
  }
  if (data.top_p !== undefined) {
    config.top_p = data.top_p;
  }
  if (data.top_k !== undefined) {
    config.top_k = data.top_k;
  }
  if (data.frequency_penalty !== undefined) {
    config.frequency_penalty = data.frequency_penalty;
  }
  if (data.presence_penalty !== undefined) {
    config.presence_penalty = data.presence_penalty;
  }
  if (data.top_a !== undefined) {
    config.top_a = data.top_a;
  }
  if (data.min_p !== undefined) {
    config.min_p = data.min_p;
  }
  if (data.repetition_penalty !== undefined) {
    config.repetition_penalty = data.repetition_penalty;
  }
  if (data.seed !== undefined && data.seed !== -1) {
    config.seed = data.seed;
  }
  if (data.n !== undefined) {
    config.n = data.n;
  }

  // Filter prompts to only include those with 36-character identifiers (UUIDs)
  const customPrompts: ChatTemplateCustomPrompt[] = [];
  const promptOrderMap = new Map<string, { enabled: boolean; position: number }>();

  // Build prompt order map from the first prompt_order entry
  if (data.prompt_order && data.prompt_order.length > 0) {
    const firstOrder = data.prompt_order[0];
    firstOrder.order.forEach((orderItem, index) => {
      promptOrderMap.set(orderItem.identifier, {
        enabled: orderItem.enabled,
        position: index,
      });
    });
  }

  // Process prompts with 36-character identifiers
  const eligiblePrompts = data.prompts.filter((prompt) => prompt.identifier.length === 36);

  // biome-ignore lint/complexity/noForEach: should run quick enough
  eligiblePrompts.forEach((prompt) => {
    const orderInfo = promptOrderMap.get(prompt.identifier);

    // Determine role mapping
    let role: "user" | "character" | "system" = "system";
    if (prompt.role === "user") {
      role = "user";
    } else if (prompt.role === "assistant") {
      role = "character";
    } else {
      role = "system";
    }

    // Determine position mapping
    let position: "top" | "bottom" | "depth" = "depth";
    let depth = 1;

    if (prompt.injection_depth !== undefined) {
      depth = prompt.injection_depth;
    }

    // Map injection_position to our position system
    // if (prompt.injection_position === 0) {
    //   position = "top";
    // } else {
    position = "depth";
    // }

    // Transform prompt content placeholders
    const transformedContent = replaceSillytavernFunctions(prompt.content || "");

    const customPrompt: ChatTemplateCustomPrompt = {
      id: prompt.identifier,
      name: prompt.name,
      role,
      filter: {}, // SillyTavern doesn't have filters in the same way
      position,
      depth,
      prompt: transformedContent,
      enabled: orderInfo?.enabled ?? prompt.enabled ?? true,
    };

    customPrompts.push(customPrompt);
  });

  // Sort custom prompts by their position in the prompt order
  customPrompts.sort((a, b) => {
    const aOrder = promptOrderMap.get(a.id);
    const bOrder = promptOrderMap.get(b.id);

    if (aOrder && bOrder) {
      return aOrder.position - bOrder.position;
    }

    // If no order info, maintain original order
    return 0;
  });

  // Create the template object
  const template: Omit<ChatTemplate, "id" | "created_at" | "updated_at"> = {
    profile_id: profileId,
    favorite: false,
    // Remove file extension from fileName if present before assigning as template name
    name: fileName,
    model_id: null, // SillyTavern stores model info differently, we'll leave this null
    format_template_id: null,
    lorebook_list: [],
    config,
    custom_prompts: customPrompts,
  };

  return { template };
}

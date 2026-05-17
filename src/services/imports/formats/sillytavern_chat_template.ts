import { z } from "zod";
import { ChatTemplate, ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { replaceSillytavernFunctions } from "./sillytavern_helper";

// PromptManager.js `dummyId` — keys the default solo-chat prompt order in an exported preset.
const SILLYTAVERN_DEFAULT_CHARACTER_ID = 100000;

// Non-marker built-in prompts. SillyTavern ships these with empty `content` by default and
// expects the user to fill them in; we skip blank ones on import to avoid empty rows.
const BUILTIN_NON_MARKER_IDS = new Set(["main", "nsfw", "jailbreak", "enhanceDefinitions"]);

function stripTemplateExtension(fileName: string): string {
  return fileName.replace(/\.(json|jsonl)$/i, "");
}

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

  const customPrompts: ChatTemplateCustomPrompt[] = [];
  const promptOrderMap = new Map<string, { enabled: boolean; position: number }>();

  // SillyTavern stores the default solo-chat prompt ordering under character_id 100000 (the
  // PromptManager `dummyId`). 100001 is the default group-chat order. Per-character custom
  // orderings can also appear; prefer the dummy default, fall back to the first entry.
  let chatHistoryOrderIndex = -1;
  if (data.prompt_order && data.prompt_order.length > 0) {
    const defaultOrder = data.prompt_order.find((entry) => entry.character_id === SILLYTAVERN_DEFAULT_CHARACTER_ID) ?? data.prompt_order[0];
    defaultOrder.order.forEach((orderItem, index) => {
      promptOrderMap.set(orderItem.identifier, {
        enabled: orderItem.enabled,
        position: index,
      });
      if (orderItem.identifier === "chatHistory") {
        chatHistoryOrderIndex = index;
      }
    });
  }

  // Skip markers (chatHistory, charDescription, scenario, worldInfoBefore, etc.) — those are
  // SillyTavern context-manager placeholders without content; narratrix injects equivalent
  // data via its format template and chat structure, not via custom_prompts.
  const eligiblePrompts = data.prompts.filter((prompt) => !prompt.marker);

  // biome-ignore lint/complexity/noForEach: should run quick enough
  eligiblePrompts.forEach((prompt) => {
    const orderInfo = promptOrderMap.get(prompt.identifier);
    const transformedContent = replaceSillytavernFunctions(prompt.content || "");

    // Built-in identifiers ship empty by default in SillyTavern (the user is expected to fill
    // them in). Importing them as blank rows just adds noise — skip if there's nothing to
    // carry over. Custom (UUID) prompts are kept even when empty since the user authored them.
    if (BUILTIN_NON_MARKER_IDS.has(prompt.identifier) && transformedContent.trim() === "") {
      return;
    }

    let role: "user" | "character" | "system" = "system";
    if (prompt.role === "user") {
      role = "user";
    } else if (prompt.role === "assistant") {
      role = "character";
    }

    // injection_position 1 = absolute depth injection; 0/undefined = relative slot. For the
    // relative case, narratrix has no "in-line at this slot" position, so place the prompt
    // above or below chat history based on its order index relative to the chatHistory marker.
    let position: "top" | "bottom" | "depth";
    let depth = 1;
    if (prompt.injection_position === 1) {
      position = "depth";
      depth = prompt.injection_depth ?? 4;
    } else if (orderInfo && chatHistoryOrderIndex >= 0) {
      position = orderInfo.position < chatHistoryOrderIndex ? "top" : "bottom";
    } else {
      position = "top";
    }

    customPrompts.push({
      id: prompt.identifier,
      name: prompt.name,
      role,
      filter: {},
      position,
      depth,
      prompt: transformedContent,
      enabled: orderInfo?.enabled ?? prompt.enabled ?? false,
    });
  });

  customPrompts.sort((a, b) => {
    const aOrder = promptOrderMap.get(a.id);
    const bOrder = promptOrderMap.get(b.id);

    if (aOrder && bOrder) {
      return aOrder.position - bOrder.position;
    }
    return 0;
  });

  const template: Omit<ChatTemplate, "id" | "created_at" | "updated_at"> = {
    profile_id: profileId,
    favorite: false,
    name: stripTemplateExtension(fileName),
    model_id: null,
    format_template_id: null,
    lorebook_list: [],
    config,
    custom_prompts: customPrompts,
  };

  return { template };
}

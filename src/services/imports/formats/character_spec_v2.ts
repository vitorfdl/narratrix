import { z } from "zod";
import { CreateCharacterSchema } from "@/schema/characters-schema";
import { replaceSillytavernFunctions } from "./sillytavern_helper";

// Zod schema for chara_card_v2 minimal validation
const CharaCardV2Schema = z.object({
  spec: z.enum(["chara_card_v2", "chara_card_v3"]),
  // spec_version: z.string().regex(/^2\\.0$/),
  data: z.object({
    name: z.string(),
    description: z.string().optional(),
    personality: z.string().optional(),
    mes_example: z.string().optional(),
    first_mes: z.string().optional(),
    avatar: z.string().optional(),
    scenario: z.string().optional(),
    alternate_greetings: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    creator: z.string().optional(),
    character_version: z.string().optional(),
    extensions: z.record(z.unknown()).optional(),
    creator_notes: z.string().optional(),
    system_prompt: z.string().optional(),
    post_history_instructions: z.string().optional(),
    character_book: z.unknown().optional(),
  }),
});

export type CharaCardV2 = z.infer<typeof CharaCardV2Schema>;

export interface CharacterSpecV2TransformResult {
  character: z.infer<typeof CreateCharacterSchema>;
  chatFields?: {
    first_mes?: string;
    alternate_greetings?: string[];
    scenario?: string;
  };
}

/**
 * Validate if the input is a valid chara_card_v2 JSON.
 */
export function validateCharacterSpecV2(data: any): { valid: boolean; errors: string[] } {
  const result = CharaCardV2Schema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

/**
 * Transform a chara_card_v2 JSON to the internal CreateCharacterSchema format and extract chat fields.
 * - Joins personality, description, and mes_example (mes_example parsing stubbed for now).
 * - Extracts chat fields (first_mes, alternate_greetings, scenario).
 */
export function transformCharacterSpecV2(data: CharaCardV2, profileId: string): CharacterSpecV2TransformResult {
  const d = data.data;

  // Join personality, description, and mes_example
  const personalityParts: string[] = [];
  const insertPart = (content: string, title?: string) => {
    if (content) {
      if (title) {
        personalityParts.push(`## ${title}\n ${content}`);
      } else {
        personalityParts.push(content);
      }
    }
  };

  if (d.personality) {
    insertPart(d.personality);
  }
  if (d.description) {
    insertPart(d.description);
  }
  if (d.mes_example) {
    const parsedMesExamples = d.mes_example.replaceAll("<START>\r\n", "").replaceAll("<START>", "");
    insertPart(parsedMesExamples, "Example Messages");
  }
  const personalityJoined = replaceSillytavernFunctions(personalityParts.filter(Boolean).join("\n\n"));

  // Map to internal character schema
  const character: z.infer<typeof CreateCharacterSchema> = {
    type: "character",
    profile_id: profileId,
    name: d.name,
    tags: d.tags || [],
    avatar_path: d.avatar || null,
    lorebook_id: null,
    version: "1.0.0",
    external_update_link: null,
    auto_update: true,
    system_override: d.system_prompt || null,
    settings: d.creator ? { author: d.creator } : { author: "Unknown" },
    custom: { personality: personalityJoined },
    expressions: null,
    character_manifest_id: null,
  };

  // Extract chat fields
  // Only include chatFields if at least one field is present (not null/undefined/empty)
  const hasChatField =
    (typeof d.first_mes === "string" && d.first_mes.trim() !== "") ||
    (Array.isArray(d.alternate_greetings) && d.alternate_greetings.length > 0) ||
    (typeof d.scenario === "string" && d.scenario.trim() !== "");

  if (hasChatField) {
    const chatFields = {
      first_mes: d.first_mes,
      alternate_greetings: d.alternate_greetings,
      scenario: d.scenario,
    };
    return { character, chatFields };
  }

  return { character };
}

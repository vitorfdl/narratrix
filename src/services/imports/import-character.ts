import { Character, CreateCharacterSchema } from "@/schema/characters-schema";
import { z } from "zod";
import { createCharacter } from "../character-service";
import { createChatChapter } from "../chat-chapter-service";
import { createChat, updateChat } from "../chat-service";
import { CharaCardV2, CharacterSpecV2TransformResult, transformCharacterSpecV2, validateCharacterSpecV2 } from "./formats/character_spec_v2";

/**
 * Supported character import formats.
 */
export type CharacterImportFormat = "internal_json" | "chara_card_v2" | "jpg_metadata" | "yml" | "other_json" | "unknown";

/**
 * Result type for validation and transformation.
 * If format is chara_card_v2, chatFields will be present.
 */
interface ValidationTransformationResult {
  valid: boolean;
  errors: string[];
  data: z.infer<typeof CreateCharacterSchema> | null;
  chatFields?: CharacterSpecV2TransformResult["chatFields"];
  format: CharacterImportFormat;
}

/**
 * Detects and validates the internal JSON character format using Zod.
 * @param data - The parsed JSON data
 * @returns ValidationTransformationResult
 */
function validateInternalCharacterJSON(data: any): ValidationTransformationResult {
  const parseResult = CreateCharacterSchema.safeParse(data);
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
 * Attempts to validate and transform the parsed character data, detecting its format.
 * @param data - The parsed JSON data from the file.
 * @param profileId - The profile ID to associate the character with (required for chara_card_v2 transformation).
 * @returns A result object containing the validation status, errors, transformed data (if valid), and detected format.
 */
export function validateAndTransformCharacterData(data: any, profileId: string): ValidationTransformationResult {
  // 1. Try validating as internal JSON
  const internalResult = validateInternalCharacterJSON(data);
  if (internalResult.valid) {
    return internalResult;
  }

  // 2. Try validating as chara_card_v2
  const v2Validation = validateCharacterSpecV2(data);
  if (v2Validation.valid) {
    const transformed = transformCharacterSpecV2(data as CharaCardV2, profileId);
    return {
      valid: true,
      errors: [],
      data: transformed.character,
      chatFields: transformed.chatFields,
      format: "chara_card_v2",
    };
  }

  // 3. Future: Add detection/validation for other formats (jpg_metadata, yml, other_json)
  // ...

  // 4. Unknown format
  return {
    valid: false,
    errors: [
      ...internalResult.errors,
      ...v2Validation.errors,
      "Unknown or unsupported character file format. Only internal JSON and chara_card_v2 are currently supported.",
    ],
    data: null,
    format: "unknown",
  };
}

/**
 * Imports a character into the database from validated and transformed data.
 * @param transformedData - The character data in the internal format.
 * @returns The imported character.
 * @throws If `transformedData` is null or invalid.
 */
export async function importCharacter(
  transformedData: z.infer<typeof CreateCharacterSchema>,
  chatData?: CharacterSpecV2TransformResult["chatFields"],
): Promise<Character> {
  if (!transformedData) {
    throw new Error("No character data provided for import.");
  }
  // Use the service to create the character
  const character = await createCharacter(transformedData);
  // Type assertion: createCharacter returns CharacterUnion, but we expect type 'character' only here
  if (character.type !== "character") {
    throw new Error("Imported data is not a character type.");
  }

  if (chatData) {
    const chat = await createChat({
      name: `${character.name} Chat`,
      profile_id: character.profile_id,
      participants: [{ enabled: true, id: character.id, settings: {} }],
    });

    const chapters = [...(chatData.first_mes ? [chatData.first_mes] : []), ...(chatData.alternate_greetings || [])];
    if (!chapters.length) {
      chapters.push("");
    }

    for (const [index, chapter] of chapters.entries()) {
      const { id } = await createChatChapter({
        chat_id: chat.id,
        title: `Greetings ${index + 1}`,
        sequence: index + 1,
        start_message: chapter,
        scenario: chatData.scenario,
      });

      if (index === 0) {
        await updateChat(chat.id, {
          active_chapter_id: id,
        });
      }
    }
  }

  return character;
}

/**
 * Parse character file content (JSON only for now).
 * @param fileContent - The string content of the file.
 * @returns The parsed character data (as generic 'any' before format detection).
 * @throws If JSON parsing fails.
 */
export function parseCharacterContent(fileContent: string): any {
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

// Future: Add stubs for JPG (with metadata), YAML, and other JSON formats here.

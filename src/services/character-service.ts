import { z } from "zod";
import { parseBoolean } from "@/pages/agents/components/json-schema/schema-utils";
import { formatDateTime } from "@/utils/date-time";
import { Character, CharacterSchema, CreateCharacterSchema, UpdateCharacterSchema } from "../schema/characters-schema";
import { uuidUtils } from "../schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database";
import { removeDirectoryRecursive, removeFile } from "./file-system-service";

// Interface for filtering characters
export interface CharacterFilter {
  type?: "agent" | "character";
  name?: string;
  tags?: string[];
}

// Create a new character (either agent or character)
export async function createCharacter(characterData: z.infer<typeof CreateCharacterSchema>): Promise<Character> {
  const profileId = uuidUtils.uuid().parse(characterData.profile_id);
  const id = crypto.randomUUID();
  const now = formatDateTime();

  const baseData = {
    ...characterData,
    id,
    profile_id: profileId,
    created_at: new Date(now),
    updated_at: new Date(now),
  };

  // Validate based on type
  const validatedCharacter = CharacterSchema.parse(baseData);

  // Convert objects to JSON strings for database storage
  const settings = validatedCharacter.settings ? JSON.stringify(validatedCharacter.settings) : null;
  const custom = validatedCharacter.custom ? JSON.stringify(validatedCharacter.custom) : null;
  const expressions = validatedCharacter.type === "character" && validatedCharacter.expressions ? JSON.stringify(validatedCharacter.expressions) : null;
  const tags = validatedCharacter.tags ? JSON.stringify(validatedCharacter.tags) : JSON.stringify([]);

  await executeDBQuery(
    `INSERT INTO characters (
      id, profile_id, name, type, version, avatar_path, external_update_link, auto_update, system_override, settings, custom, expressions, character_manifest_id, lorebook_id,
      created_at, updated_at, tags
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      id,
      profileId,
      validatedCharacter.name,
      validatedCharacter.type,
      validatedCharacter.version,
      validatedCharacter.avatar_path,
      validatedCharacter.external_update_link,
      validatedCharacter.auto_update,
      validatedCharacter.system_override,
      settings,
      custom,
      expressions,
      validatedCharacter.type === "character" ? validatedCharacter.character_manifest_id : null,
      validatedCharacter.lorebook_id,
      now,
      now,
      tags,
    ],
  );

  return validatedCharacter;
}

// Get a character by ID
export async function getCharacterById(id: string): Promise<Character | null> {
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>("SELECT * FROM characters WHERE id = $1", [validId]);

  if (result.length === 0) {
    return null;
  }

  const character = result[0];

  // Parse JSON fields
  character.settings = character.settings ? JSON.parse(character.settings) : null;
  character.custom = character.custom ? JSON.parse(character.custom) : null;
  character.expressions = character.expressions ? JSON.parse(character.expressions) : null;
  character.tags = character.tags ? JSON.parse(character.tags) : [];

  character.auto_update = parseBoolean(character.auto_update);

  // Convert dates
  character.created_at = new Date(character.created_at);
  character.updated_at = new Date(character.updated_at);

  return CharacterSchema.parse(character);
}

// List characters with filtering
export async function listCharacters(profile_id: string, filter?: CharacterFilter): Promise<Character[]> {
  let query = "SELECT * FROM characters";
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  conditions.push(`profile_id = $${paramIndex}`);
  params.push(uuidUtils.uuid().parse(profile_id));
  paramIndex++;

  if (filter) {
    if (filter.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(filter.type);
      paramIndex++;
    }

    if (filter.name) {
      conditions.push(`name LIKE $${paramIndex}`);
      params.push(`%${filter.name}%`);
      paramIndex++;
    }

    if (filter.tags && filter.tags.length > 0) {
      const tagsJson = JSON.stringify(filter.tags);
      conditions.push(`tags @> $${paramIndex}::jsonb`);
      params.push(tagsJson);
      paramIndex++;
    }
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += " ORDER BY created_at DESC";

  const results = await selectDBQuery<any[]>(query, params);
  return results.map((character) => {
    // Parse JSON fields
    character.settings = character.settings ? JSON.parse(character.settings) : null;
    character.custom = character.custom ? JSON.parse(character.custom) : null;
    character.expressions = character.expressions ? JSON.parse(character.expressions) : null;
    character.tags = character.tags ? JSON.parse(character.tags) : [];

    character.auto_update = parseBoolean(character.auto_update);

    // Convert dates
    character.created_at = new Date(character.created_at);
    character.updated_at = new Date(character.updated_at);

    return CharacterSchema.parse(character);
  });
}

// Update a character
export async function updateCharacter(id: string, updateData: z.infer<typeof UpdateCharacterSchema>): Promise<Character | null> {
  const characterId = uuidUtils.uuid().parse(id);

  const currentCharacter = await getCharacterById(characterId);
  if (!currentCharacter) {
    return null;
  }

  // Define field transformations
  const fieldMapping = {
    settings: (value: any) => (value ? JSON.stringify(value) : null),
    custom: (value: any) => (value ? JSON.stringify(value) : null),
    expressions: (value: any) => (value ? JSON.stringify(value) : null),
    tags: (value: any) => (value ? JSON.stringify(value) : JSON.stringify([])),
  };

  // Use type assertion with the correct type based on current character
  const { updates, values, whereClause } = buildUpdateParams<typeof currentCharacter>(characterId, updateData as Partial<typeof currentCharacter>, fieldMapping);

  if (updates.length > 0) {
    await executeDBQuery(`UPDATE characters SET ${updates.join(", ")}${whereClause}`, values);
  }

  return getCharacterById(characterId);
}

// Delete a character
export async function deleteCharacter(id: string): Promise<boolean> {
  const characterId = uuidUtils.uuid().parse(id);
  // Fetch character details before deletion
  const character = await getCharacterById(characterId);
  if (!character) {
    return false;
  }
  // Delete from DB first
  const result = await executeDBQuery("DELETE FROM characters WHERE id = $1", [characterId]);
  if (result.rowsAffected > 0) {
    // Remove avatar file if present
    if (character.avatar_path) {
      try {
        await removeFile(character.avatar_path);
      } catch (err) {
        console.warn(`Failed to remove avatar for character ${character.id}:`, err);
      }
    }
    // Remove expression folder for type 'character'
    if (character.type === "character") {
      try {
        await removeDirectoryRecursive(`images/characters/${character.id}`);
      } catch (err) {
        console.warn(`Failed to remove expression folder for character ${character.id}:`, err);
      }
    }
    return true;
  }
  return false;
}

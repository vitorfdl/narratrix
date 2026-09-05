import { parseBoolean } from "@/pages/agents/components/json-schema/schema-utils";
import { CharacterSheetTemplate, characterSheetTemplateSchema, NewCharacterSheetTemplate } from "@/schema/template-character-sheet-schema";
import { uuidUtils } from "@/schema/utils-schema.ts";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "@/utils/database.ts";
import { formatDateTime } from "@/utils/date-time.ts";

function parseTemplateRow(row: any): CharacterSheetTemplate {
  if (typeof row.sections === "string") {
    row.sections = JSON.parse(row.sections);
  }
  row.favorite = parseBoolean(row.favorite);
  return characterSheetTemplateSchema.parse({
    ...row,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  });
}

export async function createCharacterSheetTemplate(templateData: NewCharacterSheetTemplate): Promise<CharacterSheetTemplate> {
  const profileId = uuidUtils.uuid().parse(templateData.profile_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  const validatedTemplate = characterSheetTemplateSchema.parse({
    id,
    profile_id: profileId,
    name: templateData.name,
    sections: templateData.sections || [],
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  await executeDBQuery(
    `INSERT INTO character_sheet_template (id, profile_id, name, sections, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [validatedTemplate.id, validatedTemplate.profile_id, validatedTemplate.name, JSON.stringify(validatedTemplate.sections), now, now],
  );

  return validatedTemplate;
}

export async function getCharacterSheetTemplateById(id: string): Promise<CharacterSheetTemplate | null> {
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>(
    `SELECT id, profile_id, name, sections, favorite, created_at, updated_at
     FROM character_sheet_template
     WHERE id = $1`,
    [validId],
  );

  if (result.length === 0) {
    return null;
  }

  return parseTemplateRow(result[0]);
}

export async function listCharacterSheetTemplates(profileID: string): Promise<CharacterSheetTemplate[]> {
  const validatedProfileID = uuidUtils.uuid().parse(profileID);

  const result = await selectDBQuery<any[]>(
    `SELECT id, profile_id, name, sections, favorite, created_at, updated_at
     FROM character_sheet_template
     WHERE profile_id = $1
     ORDER BY created_at DESC`,
    [validatedProfileID],
  );

  return result.map(parseTemplateRow);
}

export async function updateCharacterSheetTemplate(
  id: string,
  updateData: Partial<Omit<CharacterSheetTemplate, "id" | "profile_id" | "created_at" | "updated_at">>,
): Promise<CharacterSheetTemplate | null> {
  const validId = uuidUtils.uuid().parse(id);

  const currentTemplate = await getCharacterSheetTemplateById(validId);
  if (!currentTemplate) {
    return null;
  }

  const fieldMapping = {
    sections: (value: object) => JSON.stringify(value),
  };

  const queryBuilder = buildUpdateParams(validId, updateData, fieldMapping);

  if (queryBuilder.updates.length > 0) {
    await executeDBQuery(`UPDATE character_sheet_template SET ${queryBuilder.updates.join(", ")}${queryBuilder.whereClause}`, queryBuilder.values);
  }

  return getCharacterSheetTemplateById(validId);
}

export async function deleteCharacterSheetTemplate(id: string): Promise<boolean> {
  const validId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM character_sheet_template WHERE id = $1", [validId]);

  return result.rowsAffected > 0;
}

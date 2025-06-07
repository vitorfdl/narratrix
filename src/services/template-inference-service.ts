import { parseBoolean } from "@/pages/agents/components/json-schema/schema-utils.ts";
// src/services/inference-template-service.ts
import { formatDateTime } from "@/utils/date-time.ts";
import { CreateInferenceTemplateParams, InferenceTemplate, inferenceTemplateSchema } from "../schema/template-inferance-schema.ts";
import { uuidUtils } from "../schema/utils-schema.ts";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database.ts";

// Interface for filtering inference templates
export interface InferenceTemplateFilter {
  profile_id?: string;
}

// Create a new inference template
export async function createInferenceTemplate(templateData: CreateInferenceTemplateParams): Promise<InferenceTemplate> {
  // Validate profile_id is a valid UUID
  const profileId = uuidUtils.uuid().parse(templateData.profile_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the template data against schema
  const validatedTemplate = inferenceTemplateSchema.parse({
    id,
    profile_id: profileId,
    name: templateData.name,
    config: templateData.config,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  const configStr = JSON.stringify(validatedTemplate.config);

  await executeDBQuery(
    `INSERT INTO inference_template (id, profile_id, name, config, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [validatedTemplate.id, validatedTemplate.profile_id, validatedTemplate.name, configStr, now, now],
  );

  // Return the validated template
  return validatedTemplate;
}

// Get an inference template by ID
export async function getInferenceTemplateById(id: string): Promise<InferenceTemplate | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>(
    `SELECT 
      id, 
      profile_id, 
      name, 
      config,
      favorite,
      created_at, 
      updated_at
    FROM inference_template 
    WHERE id = $1`,
    [validId],
  );

  if (result.length === 0) {
    return null;
  }

  const template = result[0];

  // Parse the config JSON string
  template.config = JSON.parse(template.config);
  template.favorite = parseBoolean(template.favorite);

  // Convert date strings to Date objects
  template.created_at = new Date(template.created_at);
  template.updated_at = new Date(template.updated_at);

  return template as InferenceTemplate;
}

// List inference templates with optional filtering
export async function listInferenceTemplates(filter?: InferenceTemplateFilter): Promise<InferenceTemplate[]> {
  let query = `
    SELECT 
      id, 
      profile_id, 
      name, 
      config,
      favorite,
      created_at, 
      updated_at
    FROM inference_template
  `;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Add filter conditions if provided
  if (filter?.profile_id) {
    conditions.push(`profile_id = $${paramIndex}`);
    params.push(uuidUtils.uuid().parse(filter.profile_id));
    paramIndex++;
  }

  // Add WHERE clause if there are conditions
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  // Add order by to ensure consistent results
  query += " ORDER BY created_at DESC";

  const result = await selectDBQuery<any[]>(query, params);

  // Process results
  return result.map((template) => ({
    ...template,
    config: JSON.parse(template.config),
    favorite: parseBoolean(template.favorite),
    created_at: new Date(template.created_at),
    updated_at: new Date(template.updated_at),
  })) as InferenceTemplate[];
}

// Update an inference template
export async function updateInferenceTemplate(
  id: string,
  updateData: Partial<Omit<InferenceTemplate, "id" | "profile_id" | "created_at" | "updated_at">>,
): Promise<InferenceTemplate | null> {
  const validId = uuidUtils.uuid().parse(id);

  // Get the current template to ensure it exists
  const currentTemplate = await getInferenceTemplateById(validId);
  if (!currentTemplate) {
    return null;
  }

  // Define field mappings for special transformations
  const fieldMapping: Partial<Record<keyof InferenceTemplate, (value: any) => any>> = {
    config: (config: object | string) => (typeof config === "string" ? config : JSON.stringify(config)),
  };

  // Build update query using the utility function
  const { updates, values, whereClause } = buildUpdateParams(validId, updateData, fieldMapping);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE inference_template SET ${updates.join(", ")}${whereClause}`, values);
  }

  // Return the updated template
  return getInferenceTemplateById(validId);
}

// Delete an inference template
export async function deleteInferenceTemplate(id: string): Promise<boolean> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM inference_template WHERE id = $1", [validId]);

  // Return true if a row was affected (template was deleted)
  return result.rowsAffected > 0;
}

// Group inference templates by profile
export async function getInferenceTemplatesByProfile(profileId: string): Promise<InferenceTemplate[]> {
  const validProfileId = uuidUtils.uuid().parse(profileId);
  return listInferenceTemplates({ profile_id: validProfileId });
}

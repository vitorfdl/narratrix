import { formatDateTime } from "@/utils/date-time";
import { SystemPromptTemplate, systemPromptTemplateSchema } from "../schema/template-prompt-schema";
import { uuidUtils } from "../schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database";

// Interface for creating a new system prompt template
export interface NewSystemPromptTemplateParams {
  profile_id: string;
  name: string;
  config?: SystemPromptTemplate["config"];
}

// Interface for filtering templates
export interface TemplateFilter {
  profile_id?: string;
}

// Create a new system prompt template
export async function createSystemPromptTemplate(templateData: NewSystemPromptTemplateParams): Promise<SystemPromptTemplate> {
  const profileId = uuidUtils.uuid().parse(templateData.profile_id);
  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the template data against schema
  const validatedTemplate = systemPromptTemplateSchema.parse({
    id,
    profile_id: profileId,
    name: templateData.name,
    config: templateData.config,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });

  const configStr = JSON.stringify(validatedTemplate.config);

  await executeDBQuery(
    `INSERT INTO context_template (id, profile_id, name, config, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [validatedTemplate.id, validatedTemplate.profile_id, validatedTemplate.name, configStr, now, now],
  );

  return validatedTemplate;
}

// Get a system prompt template by ID
export async function getSystemPromptTemplateById(id: string): Promise<SystemPromptTemplate | null> {
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>(
    `SELECT 
      id, 
      profile_id, 
      name, 
      config,
      created_at as createdAt, 
      updated_at as updatedAt
    FROM context_template 
    WHERE id = $1`,
    [validId],
  );

  if (result.length === 0) {
    return null;
  }

  const template = result[0];

  // Parse the config JSON
  template.config = JSON.parse(template.config);

  // Convert date strings to Date objects
  template.createdAt = new Date(template.createdAt);
  template.updatedAt = new Date(template.updatedAt);

  return systemPromptTemplateSchema.parse(template);
}

// List system prompt templates with optional filtering
export async function listSystemPromptTemplates(filter?: TemplateFilter): Promise<SystemPromptTemplate[]> {
  let query = `
    SELECT 
      id, 
      profile_id, 
      name, 
      config,
      created_at as createdAt, 
      updated_at as updatedAt
    FROM context_template
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
  return result.map((template) => {
    // Parse the config JSON
    template.config = JSON.parse(template.config);

    // Convert date strings to Date objects
    return systemPromptTemplateSchema.parse({
      ...template,
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt),
    });
  });
}

// Update a system prompt template
export async function updateSystemPromptTemplate(
  id: string,
  updateData: Partial<Omit<SystemPromptTemplate, "id" | "profile_id" | "createdAt" | "updatedAt">>,
): Promise<SystemPromptTemplate | null> {
  const validId = uuidUtils.uuid().parse(id);

  // Get the current template to ensure it exists
  const currentTemplate = await getSystemPromptTemplateById(validId);
  if (!currentTemplate) {
    return null;
  }

  // Process the update data to handle special cases
  const processedUpdate = { ...updateData };
  if (updateData.config !== undefined) {
    // For partial config updates, merge with existing config
    processedUpdate.config = Array.isArray(updateData.config) ? updateData.config : [...currentTemplate.config];
  }

  const fieldMapping: Partial<Record<keyof SystemPromptTemplate, (value: any) => any>> = {
    config: (config: any[]) => JSON.stringify(config),
  };

  const { updates, values, whereClause } = buildUpdateParams(validId, processedUpdate, fieldMapping);

  if (updates.length > 0) {
    await executeDBQuery(`UPDATE context_template SET ${updates.join(", ")}${whereClause}`, values);
  }

  // Return the updated template
  return getSystemPromptTemplateById(validId);
}

// Delete a system prompt template
export async function deleteSystemPromptTemplate(id: string): Promise<boolean> {
  const validId = uuidUtils.uuid().parse(id);
  const result = await executeDBQuery("DELETE FROM context_template WHERE id = $1", [validId]);
  return result.rowsAffected > 0;
}

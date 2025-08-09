import { parseBoolean } from "@/pages/agents/components/json-schema/schema-utils";
import { FormatTemplate, NewFormatTemplate, formatTemplateSchema } from "@/schema/template-format-schema.ts";
import { uuidUtils } from "@/schema/utils-schema.ts";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "@/utils/database.ts";
import { formatDateTime } from "@/utils/date-time.ts";

// Interface for filtering format templates
export interface FormatTemplateFilter {
  profile_id?: string;
}

// Create a new format template
export async function createFormatTemplate(templateData: NewFormatTemplate): Promise<FormatTemplate> {
  // Validate profile_id is a valid UUID
  const profileId = uuidUtils.uuid().parse(templateData.profile_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the template data against schema
  const validatedTemplate = formatTemplateSchema.parse({
    id,
    profile_id: profileId,
    name: templateData.name,
    config: templateData.config || {},
    prompts: templateData.prompts || [],
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  const configStr = JSON.stringify(validatedTemplate.config);
  const promptsStr = JSON.stringify(validatedTemplate.prompts);

  await executeDBQuery(
    `INSERT INTO format_template (id, profile_id, name, config, prompts, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [validatedTemplate.id, validatedTemplate.profile_id, validatedTemplate.name, configStr, promptsStr, now, now],
  );

  // Return the validated template
  return validatedTemplate;
}

// Get a format template by ID
export async function getFormatTemplateById(id: string): Promise<FormatTemplate | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>(
    `SELECT 
      id, 
      profile_id, 
      name, 
      config,
      prompts,
      favorite,
      created_at, 
      updated_at
    FROM format_template 
    WHERE id = $1`,
    [validId],
  );

  if (result.length === 0) {
    return null;
  }

  const template = result[0];

  // Parse config from string to object
  if (typeof template.config === "string") {
    template.config = JSON.parse(template.config);
  }

  if (typeof template.prompts === "string") {
    template.prompts = JSON.parse(template.prompts);
  }

  template.favorite = parseBoolean(template.favorite);

  // Convert date strings to Date objects
  template.created_at = new Date(template.created_at);
  template.updated_at = new Date(template.updated_at);

  // Validate the template against the schema
  return formatTemplateSchema.parse(template);
}

// List format templates with optional filtering
export async function listFormatTemplates(profileID: string): Promise<FormatTemplate[]> {
  const validatedProfileID = uuidUtils.uuid().parse(profileID);

  const query = `
    SELECT 
      id, 
      profile_id, 
      name, 
      config,
      prompts,
      favorite,
      created_at, 
      updated_at
    FROM format_template
    WHERE profile_id = $1
    ORDER BY created_at DESC
  `;

  const result = await selectDBQuery<any[]>(query, [validatedProfileID]);

  // Process results
  return result.map((template) => {
    // Parse config from string to object if needed
    if (typeof template.config === "string") {
      template.config = JSON.parse(template.config);
    }

    if (typeof template.prompts === "string") {
      template.prompts = JSON.parse(template.prompts);
    }

    template.favorite = parseBoolean(template.favorite);

    // Convert date strings to Date objects
    return formatTemplateSchema.parse({
      ...template,
      created_at: new Date(template.created_at),
      updated_at: new Date(template.updated_at),
    });
  });
}

// Update a format template
export async function updateFormatTemplate(id: string, updateData: Partial<Omit<FormatTemplate, "id" | "profile_id" | "created_at" | "updated_at">>): Promise<FormatTemplate | null> {
  const validId = uuidUtils.uuid().parse(id);

  // Get the current template to ensure it exists
  const currentTemplate = await getFormatTemplateById(validId);
  if (!currentTemplate) {
    return null;
  }

  // Process config for update
  const processedData: Partial<FormatTemplate> = { ...updateData };

  if (updateData.config !== undefined) {
    let newConfig = updateData.config;

    // If we're doing a partial config update, merge with existing config
    if (typeof newConfig === "object" && !Array.isArray(newConfig) && newConfig !== null) {
      newConfig = {
        ...currentTemplate.config,
        ...newConfig,
        // Handle nested updates for settings and reasoning
        settings: updateData.config.settings ? { ...currentTemplate.config.settings, ...updateData.config.settings } : currentTemplate.config.settings,
        reasoning: updateData.config.reasoning ? { ...currentTemplate.config.reasoning, ...updateData.config.reasoning } : currentTemplate.config.reasoning,
      };
    }

    processedData.config = newConfig;
  }

  // Define field mappings for complex types
  const fieldMapping = {
    config: (value: object) => JSON.stringify(value),
    prompts: (value: object) => JSON.stringify(value),
  };

  // Build update query using the utility
  const queryBuilder = buildUpdateParams(validId, processedData, fieldMapping);

  // Execute update if there are fields to update
  if (queryBuilder.updates.length > 0) {
    await executeDBQuery(`UPDATE format_template SET ${queryBuilder.updates.join(", ")}${queryBuilder.whereClause}`, queryBuilder.values);
  }

  // Return the updated template
  return getFormatTemplateById(validId);
}

// Delete a format template
export async function deleteFormatTemplate(id: string): Promise<boolean> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM format_template WHERE id = $1", [validId]);

  // Return true if a row was affected (template was deleted)
  return result.rowsAffected > 0;
}

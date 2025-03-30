import { FormatTemplate, formatTemplateSchema } from "@/schema/template-format-schema.ts";
import { uuidUtils } from "@/schema/utils-schema.ts";
import { executeDBQuery, selectDBQuery } from "@/utils/database.ts";
import { formatDateTime } from "@/utils/date-time.ts";

// Interface for creating a new format template
export interface NewFormatTemplateParams {
  profile_id: string;
  name: string;
  inference_template_id?: string | null;
  prompt_template_id?: string | null;
  config?: {
    settings: Record<string, any>;
    reasoning: Record<string, any>;
    use_global_context: boolean;
  };
}

// Interface for filtering format templates
export interface FormatTemplateFilter {
  profile_id?: string;
  inference_template_id?: string;
  prompt_template_id?: string;
}

// Create a new format template
export async function createFormatTemplate(templateData: NewFormatTemplateParams): Promise<FormatTemplate> {
  // Validate profile_id is a valid UUID
  const profileId = uuidUtils.uuid().parse(templateData.profile_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the template data against schema
  const validatedTemplate = formatTemplateSchema.parse({
    id,
    profile_id: profileId,
    name: templateData.name,
    inference_template_id: templateData.inference_template_id,
    prompt_template_id: templateData.prompt_template_id,
    config: templateData.config || {},
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  const configStr = JSON.stringify(validatedTemplate.config);

  await executeDBQuery(
    `INSERT INTO format_template (id, profile_id, name, inference_template_id, prompt_template_id, config, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      validatedTemplate.id,
      validatedTemplate.profile_id,
      validatedTemplate.name,
      validatedTemplate.inference_template_id,
      validatedTemplate.prompt_template_id,
      configStr,
      now,
      now,
    ],
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
      inference_template_id, 
      prompt_template_id, 
      config,
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

  // Convert date strings to Date objects
  template.created_at = new Date(template.created_at);
  template.updated_at = new Date(template.updated_at);

  // Validate the template against the schema
  return formatTemplateSchema.parse(template);
}

// List format templates with optional filtering
export async function listFormatTemplates(filter?: FormatTemplateFilter): Promise<FormatTemplate[]> {
  let query = `
    SELECT 
      id, 
      profile_id, 
      name, 
      inference_template_id, 
      prompt_template_id, 
      config,
      created_at, 
      updated_at
    FROM format_template
  `;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Add filter conditions if provided
  if (filter) {
    if (filter.profile_id) {
      conditions.push(`profile_id = $${paramIndex}`);
      params.push(uuidUtils.uuid().parse(filter.profile_id));
      paramIndex++;
    }

    if (filter.inference_template_id) {
      conditions.push(`inference_template_id = $${paramIndex}`);
      params.push(filter.inference_template_id);
      paramIndex++;
    }

    if (filter.prompt_template_id) {
      conditions.push(`prompt_template_id = $${paramIndex}`);
      params.push(filter.prompt_template_id);
      paramIndex++;
    }
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
    // Parse config from string to object if needed
    if (typeof template.config === "string") {
      template.config = JSON.parse(template.config);
    }

    // Convert date strings to Date objects
    return formatTemplateSchema.parse({
      ...template,
      created_at: new Date(template.created_at),
      updated_at: new Date(template.updated_at),
    });
  });
}

// Update a format template
export async function updateFormatTemplate(
  id: string,
  updateData: Partial<Omit<FormatTemplate, "id" | "profile_id" | "created_at" | "updated_at">>,
): Promise<FormatTemplate | null> {
  const validId = uuidUtils.uuid().parse(id);

  // Get the current template to ensure it exists
  const currentTemplate = await getFormatTemplateById(validId);
  if (!currentTemplate) {
    return null;
  }

  // Build query parts
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updateData.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    values.push(updateData.name);
    paramIndex++;
  }

  if (updateData.inference_template_id !== undefined) {
    updates.push(`inference_template_id = $${paramIndex}`);
    values.push(updateData.inference_template_id);
    paramIndex++;
  }

  if (updateData.prompt_template_id !== undefined) {
    updates.push(`prompt_template_id = $${paramIndex}`);
    values.push(updateData.prompt_template_id);
    paramIndex++;
  }

  if (updateData.config !== undefined) {
    let newConfig = updateData.config;

    // If we're doing a partial config update, merge with existing config
    if (typeof newConfig === "object" && !Array.isArray(newConfig) && newConfig !== null) {
      newConfig = {
        ...currentTemplate.config,
        ...newConfig,
        // Handle nested updates for settings and reasoning
        settings: updateData.config.settings
          ? { ...currentTemplate.config.settings, ...updateData.config.settings }
          : currentTemplate.config.settings,
        reasoning: updateData.config.reasoning
          ? { ...currentTemplate.config.reasoning, ...updateData.config.reasoning }
          : currentTemplate.config.reasoning,
      };
    }

    const configStr = JSON.stringify(newConfig);
    updates.push(`config = $${paramIndex}`);
    values.push(configStr);
    paramIndex++;
  }

  // Always update the updated_at timestamp
  const now = formatDateTime();
  updates.push(`updated_at = $${paramIndex}`);
  values.push(now);
  paramIndex++;

  // Add the ID for the WHERE clause
  values.push(validId);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE format_template SET ${updates.join(", ")} WHERE id = $${paramIndex}`, values);
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

// Get templates by profile ID
export async function getFormatTemplatesByProfile(profileId: string): Promise<FormatTemplate[]> {
  const validProfileId = uuidUtils.uuid().parse(profileId);
  return listFormatTemplates({ profile_id: validProfileId });
}

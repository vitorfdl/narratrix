import { ChatTemplate, chatTemplateSchema } from "@/schema/template-chat-schema";
import { uuidUtils } from "@/schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "@/utils/database";
import { formatDateTime } from "@/utils/date-time";

// Interface for creating a new chat template
export interface NewChatTemplateParams {
  profile_id: string;
  name: string;
  chat_id: string;
  agent_model_id?: string | null;
  character_model_id?: string | null;
  config?: Record<string, any>;
}

// Interface for filtering chat templates
export interface ChatTemplateFilter {
  profile_id?: string;
  chat_id?: string;
  agent_model_id?: string;
  character_model_id?: string;
}

// Create a new chat template
export async function createChatTemplate(templateData: NewChatTemplateParams): Promise<ChatTemplate> {
  // Validate profile_id is a valid UUID
  const profileId = uuidUtils.uuid().parse(templateData.profile_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the template data against schema
  const validatedTemplate = chatTemplateSchema.parse({
    id,
    profile_id: profileId,
    name: templateData.name,
    chat_id: templateData.chat_id,
    agent_model_id: templateData.agent_model_id,
    character_model_id: templateData.character_model_id,
    config: templateData.config || {},
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  const configStr = JSON.stringify(validatedTemplate.config);

  await executeDBQuery(
    `INSERT INTO chat_template (id, profile_id, name, chat_id, agent_model_id, character_model_id, config, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      validatedTemplate.id,
      validatedTemplate.profile_id,
      validatedTemplate.name,
      validatedTemplate.chat_id,
      validatedTemplate.agent_model_id,
      validatedTemplate.character_model_id,
      configStr,
      now,
      now,
    ],
  );

  // Return the validated template
  return validatedTemplate;
}

// Get a chat template by ID
export async function getChatTemplateById(id: string): Promise<ChatTemplate | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>(
    `SELECT 
      id, 
      profile_id, 
      name, 
      chat_id, 
      agent_model_id, 
      character_model_id, 
      config,
      created_at as created_at, 
      updated_at as updated_at
    FROM chat_template 
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
  return chatTemplateSchema.parse(template);
}

// List chat templates with optional filtering
export async function listChatTemplates(filter?: ChatTemplateFilter): Promise<ChatTemplate[]> {
  let query = `
    SELECT 
      id, 
      profile_id, 
      name, 
      chat_id, 
      agent_model_id, 
      character_model_id, 
      config,
      created_at, 
      updated_at
    FROM chat_template
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

    if (filter.chat_id) {
      conditions.push(`chat_id = $${paramIndex}`);
      params.push(filter.chat_id);
      paramIndex++;
    }

    if (filter.agent_model_id) {
      conditions.push(`agent_model_id = $${paramIndex}`);
      params.push(filter.agent_model_id);
      paramIndex++;
    }

    if (filter.character_model_id) {
      conditions.push(`character_model_id = $${paramIndex}`);
      params.push(filter.character_model_id);
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
    return chatTemplateSchema.parse({
      ...template,
      created_at: new Date(template.created_at),
      updated_at: new Date(template.updated_at),
    });
  });
}

// Update a chat template
export async function updateChatTemplate(
  id: string,
  updateData: Partial<Omit<ChatTemplate, "id" | "profile_id" | "created_at" | "updated_at">>,
): Promise<ChatTemplate | null> {
  const validId = uuidUtils.uuid().parse(id);

  // Get the current template to ensure it exists
  const currentTemplate = await getChatTemplateById(validId);
  if (!currentTemplate) {
    return null;
  }

  // Define field mappings for special transformations
  const fieldMapping = {
    config: (value: any) => JSON.stringify(value),
  };

  // Build query parts using the utility function
  const queryBuilder = buildUpdateParams(validId, updateData, fieldMapping);

  // Execute update if there are fields to update
  if (queryBuilder.updates.length > 0) {
    const query = `UPDATE chat_template SET ${queryBuilder.updates.join(", ")}${queryBuilder.whereClause}`;
    await executeDBQuery(query, queryBuilder.values);
  }

  // Return the updated template
  return getChatTemplateById(validId);
}

// Delete a chat template
export async function deleteChatTemplate(id: string): Promise<boolean> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM chat_template WHERE id = $1", [validId]);

  // Return true if a row was affected (template was deleted)
  return result.rowsAffected > 0;
}

// Get templates by profile ID
export async function getChatTemplatesByProfile(profileId: string): Promise<ChatTemplate[]> {
  const validProfileId = uuidUtils.uuid().parse(profileId);
  return listChatTemplates({ profile_id: validProfileId });
}

// Get templates by chat ID
export async function getChatTemplatesByChat(chatId: string): Promise<ChatTemplate[]> {
  return listChatTemplates({ chat_id: chatId });
}

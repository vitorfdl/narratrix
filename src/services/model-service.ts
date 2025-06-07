import { encryptApiKey } from "@/commands/security.ts";
import { formatDateTime } from "@/utils/date-time.ts";
import { Model, ModelSchema, ModelType } from "../schema/models-schema.ts";
import { uuidUtils } from "../schema/utils-schema.ts";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database.ts";
import { getModelManifestById } from "./manifest-service.ts";

// Interface for creating a new model
export interface NewModelParams {
  profile_id: string;
  name: string;
  type: ModelType;
  config: Record<string, any>;
  manifest_id: string;
  inference_template_id?: string;
}

// Interface for filtering models
export interface ModelFilter {
  profile_id?: string;
  type?: ModelType;
}

// Create a new model
export async function createModel(modelData: NewModelParams, disableEncryption?: boolean): Promise<Model> {
  // Validate profile_id is a valid UUID
  const profileId = uuidUtils.uuid().parse(modelData.profile_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  const modelManifest = await getModelManifestById(modelData.manifest_id)!;

  // Process and encrypt any secret fields in the config
  if (modelManifest && modelData.config) {
    const secretFields = modelManifest.fields.filter((field) => field.field_type === "secret").map((field) => field.key);

    // Create a new config object to avoid mutating the original
    const processedConfig = { ...modelData.config };

    // Encrypt each secret field
    if (!disableEncryption) {
      for (const key of secretFields) {
        if (processedConfig[key]) {
          try {
            // Encrypt the secret value
            processedConfig[key] = await encryptApiKey(processedConfig[key]);
          } catch (error) {
            console.error(`Failed to encrypt secret field ${key}:`, error);
            throw new Error(`Failed to encrypt secret field ${key}: ${error}`);
          }
        }
      }
    }

    // Replace the original config with the processed one
    modelData.config = processedConfig;
  }

  // Ensure config is stored as a string

  // Validate the model data against schema
  const validatedModel = ModelSchema.parse({
    id,
    profile_id: profileId,
    name: modelData.name,
    type: modelData.type,
    manifest_id: modelData.manifest_id,
    config: modelData.config,
    inference_template_id: modelData.inference_template_id,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  const configStr = JSON.stringify(validatedModel.config);

  await executeDBQuery(
    `INSERT INTO models (id, profile_id, name, type, config, manifest_id, max_concurrency, inference_template_id, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      validatedModel.id,
      validatedModel.profile_id,
      validatedModel.name,
      validatedModel.type,
      configStr,
      validatedModel.manifest_id,
      validatedModel.max_concurrency,
      validatedModel.inference_template_id,
      now,
      now,
    ],
  );

  // Return the validated model
  return validatedModel;
}

// Get a model by ID
export async function getModelById(id: string): Promise<Model | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>(
    `SELECT 
      id, 
      profile_id, 
      name, 
      type, 
      config,
      manifest_id,
      inference_template_id,
      max_concurrency,
      favorite,
      created_at, 
      updated_at
    FROM models 
    WHERE id = $1`,
    [validId],
  );

  if (result.length === 0) {
    return null;
  }

  const model = result[0];

  model.config = JSON.parse(model.config || "{}");
  // Convert date strings to Date objects
  model.created_at = new Date(model.created_at);
  model.updated_at = new Date(model.updated_at);

  return model as Model;
}

// List models with optional filtering
export async function listModels(filter?: ModelFilter): Promise<Model[]> {
  let query = `
    SELECT 
      id, 
      profile_id, 
      name, 
      type, 
      config,
      manifest_id,
      inference_template_id,
      max_concurrency,
      favorite,
      created_at, 
      updated_at
    FROM models
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

    if (filter.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(filter.type);
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
  return result.map((model) => ({
    ...model,
    config: JSON.parse(model.config || "{}"),
    favorite: model.favorite || false,
    created_at: new Date(model.created_at),
    updated_at: new Date(model.updated_at),
  })) as Model[];
}

// Update a model
export async function updateModel(
  id: string,
  updateData: Partial<Omit<Model, "id" | "profile_id" | "created_at" | "updated_at">>,
): Promise<Model | null> {
  const modelId = uuidUtils.uuid().parse(id);

  // Get the current model to ensure it exists
  const currentModel = await getModelById(modelId);
  if (!currentModel) {
    return null;
  }

  // Define field transformations
  const fieldMapping = {
    config: (value: any) => (typeof value === "string" ? value : JSON.stringify(value)),
  };

  // Build update parameters
  const { updates, values, whereClause } = buildUpdateParams(modelId, updateData, fieldMapping);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE models SET ${updates.join(", ")}${whereClause}`, values);
  }

  // Return the updated model
  return getModelById(modelId);
}

// Delete a model
export async function deleteModel(id: string): Promise<boolean> {
  // Validate ID input
  const modelId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM models WHERE id = $1", [modelId]);

  // Return true if a row was affected (model was deleted)
  return result.rowsAffected > 0;
}

// Group models by type
export async function getModelsByProfileGroupedByType(profileId: string): Promise<Record<ModelType, Model[]>> {
  const validProfileId = uuidUtils.uuid().parse(profileId);

  const models = await listModels({ profile_id: validProfileId });

  // Group models by type
  return models.reduce(
    (grouped, model) => {
      if (!grouped[model.type]) {
        grouped[model.type] = [];
      }
      grouped[model.type].push(model);
      return grouped;
    },
    {} as Record<ModelType, Model[]>,
  );
}

// Export type definitions
export type { Model, ModelType };


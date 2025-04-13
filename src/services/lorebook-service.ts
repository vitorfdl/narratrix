import {
  CreateLorebookEntryParams,
  CreateLorebookParams,
  Lorebook,
  LorebookEntry,
  UpdateLorebookEntryParams,
  UpdateLorebookParams,
  createLorebookEntrySchema,
  createLorebookSchema,
  lorebookEntrySchema,
  lorebookSchema,
} from "@/schema/lorebook-schema";
import { formatDateTime } from "@/utils/date-time";
import { uuidUtils } from "../schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database";

const parseBoolean = (value: any) => value === 1 || value === true || value === "true";
// Helper to parse JSON fields from DB results
function parseLorebookJsonFields(lorebook: any): Lorebook {
  return {
    ...lorebook,
    tags: JSON.parse(lorebook.tags || "[]"),
    group_keys: JSON.parse(lorebook.group_keys || "[]"),
    extra: JSON.parse(lorebook.extra || "{}"),
    created_at: new Date(lorebook.created_at),
    updated_at: new Date(lorebook.updated_at),
    favorite: parseBoolean(lorebook.favorite),
  };
}

// Helper to parse JSON and boolean fields from DB results for LorebookEntry
function parseLorebookEntryJsonFields(entry: any): LorebookEntry {
  // SQLite stores booleans as 0 or 1

  return {
    ...entry,
    keywords: JSON.parse(entry.keywords || "[]"),
    extra: JSON.parse(entry.extra || "{}"),
    enabled: parseBoolean(entry.enabled),
    constant: parseBoolean(entry.constant),
    case_sensitive: parseBoolean(entry.case_sensitive),
    match_partial_words: parseBoolean(entry.match_partial_words),
    created_at: new Date(entry.created_at),
    updated_at: new Date(entry.updated_at),
  };
}

// Interface for filtering lorebooks
export interface LorebookFilter {
  profile_id: string;
}

// Interface for filtering lorebook entries
export interface LorebookEntryFilter {
  lorebook_id?: string;
  enabled?: boolean;
  group_key?: string | null;
  constant?: boolean;
}

// --- Lorebook CRUD ---

// Create a new lorebook
export async function createLorebook(lorebookData: CreateLorebookParams): Promise<Lorebook> {
  const profileId = uuidUtils.uuid().parse(lorebookData.profile_id);
  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Use the schema's default values by parsing the input
  const validatedInput = createLorebookSchema.parse(lorebookData);

  const validatedLorebook = lorebookSchema.parse({
    ...validatedInput,
    id,
    profile_id: profileId,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  // Convert JSON fields to strings for storage
  const tagsStr = JSON.stringify(validatedLorebook.tags);
  const groupKeysStr = JSON.stringify(validatedLorebook.group_keys);
  const extraStr = JSON.stringify(validatedLorebook.extra);

  await executeDBQuery(
    `INSERT INTO lorebooks (
      id, profile_id, name, description, category, tags,
      allow_recursion, max_recursion_depth, favorite, max_depth, max_tokens,
      group_keys, extra, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      validatedLorebook.id,
      validatedLorebook.profile_id,
      validatedLorebook.name,
      validatedLorebook.description,
      validatedLorebook.category,
      tagsStr,
      validatedLorebook.allow_recursion,
      validatedLorebook.max_recursion_depth,
      validatedLorebook.favorite,
      validatedLorebook.max_depth,
      validatedLorebook.max_tokens,
      groupKeysStr,
      extraStr,
      now,
      now,
    ],
  );

  return validatedLorebook;
}

// Get a lorebook by ID
export async function getLorebookById<T extends boolean = false>(
  id: string,
  includeEntries: T = false as T,
): Promise<T extends true ? (Lorebook & { entries: LorebookEntry[] }) | null : Lorebook | null> {
  const validId = uuidUtils.uuid().parse(id);
  const result = await selectDBQuery<any[]>("SELECT * FROM lorebooks WHERE id = $1", [validId]);

  if (result.length === 0) {
    return null;
  }

  const lorebook = parseLorebookJsonFields(result[0]);

  if (includeEntries) {
    // Fetch entries for this lorebook when requested
    const entries = await listLorebookEntries(lorebook.profile_id, { lorebook_id: lorebook.id });
    return { ...lorebook, entries } as T extends true ? Lorebook & { entries: LorebookEntry[] } : Lorebook;
  }

  return lorebook as T extends true ? Lorebook & { entries: LorebookEntry[] } : Lorebook;
}

// List lorebooks with optional filtering
export async function listLorebooks(filter: LorebookFilter): Promise<Lorebook[]> {
  let query = "SELECT * FROM lorebooks";
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // profile_id is now mandatory
  conditions.push(`profile_id = $${paramIndex}`);
  params.push(uuidUtils.uuid().parse(filter.profile_id));
  paramIndex++;

  // No need to check if conditions.length > 0, as profile_id is always present
  query += ` WHERE ${conditions.join(" AND ")}`;

  query += " ORDER BY name ASC"; // Default ordering

  const result = await selectDBQuery<any[]>(query, params);
  return result.map(parseLorebookJsonFields);
}

// Update a lorebook
export async function updateLorebook(id: string, updateData: UpdateLorebookParams): Promise<Lorebook | null> {
  const lorebookId = uuidUtils.uuid().parse(id);
  // Fetch using profileId to ensure ownership before update
  const currentLorebook = await getLorebookById(lorebookId);
  if (!currentLorebook) {
    // Return null if not found or doesn't belong to the profile
    return null;
  }

  const now = formatDateTime();

  // Define field transformations for JSON fields
  const fieldMapping = {
    tags: (value: string[]) => JSON.stringify(value),
    group_keys: (value: string[]) => JSON.stringify(value),
    extra: (value: Record<string, any>) => JSON.stringify(value),
  };

  // buildUpdateParams now only needs the primary key 'id' for the WHERE clause
  const { updates, values, whereClause } = buildUpdateParams(lorebookId, updateData, fieldMapping);
  if (updates.length === 0) {
    return currentLorebook; // No changes
  }

  updates.push(`updated_at = $${values.length + 1}`);
  values.push(now);

  // The WHERE clause from buildUpdateParams is sufficient (WHERE id = $1)
  // No need to add profile_id here as ownership was already verified.
  await executeDBQuery(`UPDATE lorebooks SET ${updates.join(", ")}${whereClause}`, values);

  // Fetch again using profileId to return the updated object
  return getLorebookById(lorebookId);
}

// Delete a lorebook
export async function deleteLorebook(id: string): Promise<boolean> {
  const lorebookId = uuidUtils.uuid().parse(id);
  // Add profile_id to the WHERE clause
  const result = await executeDBQuery("DELETE FROM lorebooks WHERE id = $1", [lorebookId]);
  return result.rowsAffected > 0;
}

// --- Lorebook Entry CRUD ---

// Create a new lorebook entry
export async function createLorebookEntry(entryData: CreateLorebookEntryParams): Promise<LorebookEntry> {
  const lorebookId = uuidUtils.uuid().parse(entryData.lorebook_id);
  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Use the schema's default values
  const validatedInput = createLorebookEntrySchema.parse(entryData);

  const validatedEntry = lorebookEntrySchema.parse({
    ...validatedInput,
    id,
    lorebook_id: lorebookId,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  const keywordsStr = JSON.stringify(validatedEntry.keywords);
  const extraStr = JSON.stringify(validatedEntry.extra);

  await executeDBQuery(
    `INSERT INTO lorebook_entries (
      id, lorebook_id, enabled, comment, content, vector_content, group_key,
      insertion_type, depth, trigger_chance, priority, constant, keywords,
      case_sensitive, match_partial_words, min_chat_messages, extra,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
      $18, $19
    )`,
    [
      validatedEntry.id,
      validatedEntry.lorebook_id,
      validatedEntry.enabled,
      validatedEntry.comment,
      validatedEntry.content,
      validatedEntry.vector_content,
      validatedEntry.group_key,
      validatedEntry.insertion_type,
      validatedEntry.depth,
      validatedEntry.trigger_chance,
      validatedEntry.priority,
      validatedEntry.constant,
      keywordsStr,
      validatedEntry.case_sensitive,
      validatedEntry.match_partial_words,
      validatedEntry.min_chat_messages,
      extraStr,
      now,
      now,
    ],
  );

  return validatedEntry;
}

// Get a lorebook entry by ID
export async function getLorebookEntryById(id: string): Promise<LorebookEntry | null> {
  const validId = uuidUtils.uuid().parse(id);

  // Join with lorebooks table to check profile_id
  const query = `
    SELECT le.*
    FROM lorebook_entries le
    JOIN lorebooks l ON le.lorebook_id = l.id
    WHERE le.id = $1
  `;

  const result = await selectDBQuery<any[]>(query, [validId]);

  if (result.length === 0) {
    return null;
  }

  return parseLorebookEntryJsonFields(result[0]);
}

// List lorebook entries with optional filtering
export async function listLorebookEntries(profile_id: string, filter: LorebookEntryFilter): Promise<LorebookEntry[]> {
  const validProfileId = uuidUtils.uuid().parse(profile_id);

  // Base query joining with lorebooks to filter by profile_id
  let query = `
    SELECT le.*
    FROM lorebook_entries le
    JOIN lorebooks l ON le.lorebook_id = l.id
  `;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // profile_id is now mandatory
  conditions.push(`l.profile_id = $${paramIndex}`);
  params.push(validProfileId);
  paramIndex++;

  // Optional filter: lorebook_id
  if (filter?.lorebook_id) {
    // No need to validate profile_id again if lorebook_id is given,
    // as the main profile_id check already handles authorization.
    conditions.push(`le.lorebook_id = $${paramIndex}`);
    params.push(uuidUtils.uuid().parse(filter.lorebook_id));
    paramIndex++;
  }

  // Optional filter: enabled
  if (filter?.enabled !== undefined) {
    conditions.push(`le.enabled = $${paramIndex}`);
    params.push(filter.enabled);
    paramIndex++;
  }

  // Optional filter: group_key
  if (filter?.group_key !== undefined) {
    if (filter.group_key === null) {
      conditions.push("le.group_key IS NULL");
    } else {
      conditions.push(`le.group_key = $${paramIndex}`);
      params.push(filter.group_key);
      paramIndex++;
    }
  }

  // Optional filter: constant
  if (filter?.constant !== undefined) {
    conditions.push(`le.constant = $${paramIndex}`);
    params.push(filter.constant);
    paramIndex++;
  }

  // Append WHERE clause
  query += ` WHERE ${conditions.join(" AND ")}`;

  // Default ordering by priority, then comment (title)
  query += " ORDER BY le.priority DESC, le.comment ASC";

  const result = await selectDBQuery<any[]>(query, params);
  return result.map(parseLorebookEntryJsonFields);
}

// Update a lorebook entry
export async function updateLorebookEntry(id: string, updateData: UpdateLorebookEntryParams): Promise<LorebookEntry | null> {
  const entryId = uuidUtils.uuid().parse(id);

  // Fetch the entry using profileId to ensure ownership before update
  const currentEntry = await getLorebookEntryById(entryId);
  if (!currentEntry) {
    // Return null if not found or doesn't belong to the profile
    return null;
  }

  const now = formatDateTime();

  const fieldMapping = {
    keywords: (value: string[]) => JSON.stringify(value),
    extra: (value: Record<string, any>) => JSON.stringify(value),
  };

  // buildUpdateParams needs only the primary key 'id' for the WHERE clause
  const { updates, values, whereClause } = buildUpdateParams(entryId, updateData, fieldMapping);
  if (updates.length === 0) {
    return currentEntry; // No changes
  }

  updates.push(`updated_at = $${values.length + 1}`);
  values.push(now);

  // The WHERE clause from buildUpdateParams is sufficient (WHERE id = $1)
  // Ownership verified by the initial getLorebookEntryById call.
  await executeDBQuery(`UPDATE lorebook_entries SET ${updates.join(", ")}${whereClause}`, values);

  // Fetch again using profileId to return the updated object
  return getLorebookEntryById(entryId);
}

// Delete a lorebook entry
export async function deleteLorebookEntry(id: string, profileId: string): Promise<boolean> {
  const entryId = uuidUtils.uuid().parse(id);
  const validProfileId = uuidUtils.uuid().parse(profileId);

  // Use a subquery or join to ensure the entry belongs to the correct profile before deleting
  const query = `
    DELETE FROM lorebook_entries
    WHERE id = $1 AND lorebook_id IN (
      SELECT id FROM lorebooks WHERE profile_id = $2
    )
  `;

  const result = await executeDBQuery(query, [entryId, validProfileId]);
  return result.rowsAffected > 0;
}

// Get lorebook entries by lorebook ID
export async function getLorebookEntriesByLorebookId(lorebookId: string, profileId: string): Promise<LorebookEntry[]> {
  const validLorebookId = uuidUtils.uuid().parse(lorebookId);
  const validProfileId = uuidUtils.uuid().parse(profileId); // Validate profileId as well

  // Pass both lorebook_id and profile_id to listLorebookEntries
  return listLorebookEntries(validProfileId, { lorebook_id: validLorebookId });
}

// Export types
export type { CreateLorebookEntryParams, CreateLorebookParams, Lorebook, LorebookEntry, UpdateLorebookEntryParams, UpdateLorebookParams };

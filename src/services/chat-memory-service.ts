import { ChatMemory, CreateChatMemoryParams, chatMemorySchema, UpdateChatMemoryParams } from "@/schema/chat-memory-schema";
import { formatDateTime } from "@/utils/date-time";
import { uuidUtils } from "../schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database";

// Interface for filtering chat memories
export interface ChatMemoryFilter {
  chat_id?: string;
  chapter_id?: string | null;
  character_id?: string | null;
}

// Create a new chat memory
export async function createChatMemory(memoryData: CreateChatMemoryParams): Promise<ChatMemory> {
  // Validate chat_id is a valid UUID
  const chatId = uuidUtils.uuid().parse(memoryData.chat_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the chat memory data against schema
  const validatedMemory = chatMemorySchema.parse({
    id,
    chat_id: chatId,
    chapter_id: memoryData.chapter_id || null,
    character_id: memoryData.character_id || null,
    content: memoryData.content,
    metadata: memoryData.metadata || null,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  // Convert metadata object to JSON string for storage
  const metadataStr = validatedMemory.metadata ? JSON.stringify(validatedMemory.metadata) : null;

  await executeDBQuery("INSERT INTO chat_memories (id, chat_id, chapter_id, character_id, content, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [
    validatedMemory.id,
    validatedMemory.chat_id,
    validatedMemory.chapter_id,
    validatedMemory.character_id,
    validatedMemory.content,
    metadataStr,
    now,
    now,
  ]);

  return validatedMemory;
}

// Get a chat memory by ID
export async function getChatMemoryById(id: string): Promise<ChatMemory | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>("SELECT id, chat_id, chapter_id, character_id, content, metadata, created_at, updated_at FROM chat_memories WHERE id = $1", [validId]);

  if (result.length === 0) {
    return null;
  }

  const memory = result[0];

  // Parse JSON string back to object if not null
  if (memory.metadata) {
    memory.metadata = JSON.parse(memory.metadata);
  }

  // Convert date strings to Date objects
  memory.created_at = new Date(memory.created_at);
  memory.updated_at = new Date(memory.updated_at);

  return memory as ChatMemory;
}

// List chat memories with optional filtering
export async function listChatMemories(filter?: ChatMemoryFilter): Promise<ChatMemory[]> {
  let query = "SELECT id, chat_id, chapter_id, character_id, content, metadata, created_at, updated_at FROM chat_memories";

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Add filter conditions if provided
  if (filter) {
    if (filter.chat_id) {
      conditions.push(`chat_id = $${paramIndex}`);
      params.push(uuidUtils.uuid().parse(filter.chat_id));
      paramIndex++;
    }

    if (filter.chapter_id !== undefined) {
      if (filter.chapter_id === null) {
        conditions.push("chapter_id IS NULL");
      } else {
        conditions.push(`chapter_id = $${paramIndex}`);
        params.push(uuidUtils.uuid().parse(filter.chapter_id));
        paramIndex++;
      }
    }

    if (filter.character_id !== undefined) {
      if (filter.character_id === null) {
        conditions.push("character_id IS NULL");
      } else {
        conditions.push(`character_id = $${paramIndex}`);
        params.push(uuidUtils.uuid().parse(filter.character_id));
        paramIndex++;
      }
    }
  }

  // Add WHERE clause if there are conditions
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  // Add order by to ensure consistent results (most recent first)
  query += " ORDER BY created_at DESC";

  const result = await selectDBQuery<any[]>(query, params);

  // Process results
  return result.map((memory) => {
    // Parse metadata JSON if it exists
    if (memory.metadata) {
      memory.metadata = JSON.parse(memory.metadata);
    }

    return {
      ...memory,
      created_at: new Date(memory.created_at),
      updated_at: new Date(memory.updated_at),
    };
  }) as ChatMemory[];
}

// Update a chat memory
export async function updateChatMemory(id: string, updateData: UpdateChatMemoryParams): Promise<ChatMemory | null> {
  const memoryId = uuidUtils.uuid().parse(id);

  // Get the current memory to ensure it exists
  const currentMemory = await getChatMemoryById(memoryId);
  if (!currentMemory) {
    return null;
  }

  // Extend UpdateChatMemoryParams with metadata field for the field mapping
  type ExtendedUpdateParams = UpdateChatMemoryParams & { metadata?: any };

  // Define field transformations for the extended type
  const fieldMapping: Partial<Record<keyof ExtendedUpdateParams, (value: any) => any>> = {
    metadata: (value: any) => (value ? JSON.stringify(value) : null),
  };

  // Build update parameters
  const { updates, values, whereClause } = buildUpdateParams(memoryId, updateData, fieldMapping);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE chat_memories SET ${updates.join(", ")}${whereClause}`, values);
  }

  // Return the updated memory
  return getChatMemoryById(memoryId);
}

// Delete a chat memory
export async function deleteChatMemory(id: string): Promise<boolean> {
  // Validate ID input
  const memoryId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM chat_memories WHERE id = $1", [memoryId]);

  // Return true if a row was affected (memory was deleted)
  return result.rowsAffected > 0;
}

// Get all memories by chat ID
export async function getMemoriesByChatId(chatId: string): Promise<ChatMemory[]> {
  const validChatId = uuidUtils.uuid().parse(chatId);
  return listChatMemories({ chat_id: validChatId });
}

// Get long-term memories (chapter_id is NULL)
export async function getLongTermMemories(chatId: string, characterId?: string | null): Promise<ChatMemory[]> {
  const validChatId = uuidUtils.uuid().parse(chatId);
  const filter: ChatMemoryFilter = {
    chat_id: validChatId,
    chapter_id: null,
  };

  if (characterId !== undefined) {
    filter.character_id = characterId;
  }

  return listChatMemories(filter);
}

// Get short-term memories (chapter_id is set)
export async function getShortTermMemories(chatId: string, chapterId: string, characterId?: string | null): Promise<ChatMemory[]> {
  const validChatId = uuidUtils.uuid().parse(chatId);
  const validChapterId = uuidUtils.uuid().parse(chapterId);

  const filter: ChatMemoryFilter = {
    chat_id: validChatId,
    chapter_id: validChapterId,
  };

  if (characterId !== undefined) {
    filter.character_id = characterId;
  }

  return listChatMemories(filter);
}

// Export type definitions
export type { ChatMemory, CreateChatMemoryParams, UpdateChatMemoryParams };

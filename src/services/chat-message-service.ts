import { ChatMessage, ChatMessageType, CreateChatMessageParams, UpdateChatMessageParams, chatMessageSchema } from "@/schema/chat-message-schema";
import { formatDateTime } from "@/utils/date-time";
import { uuidUtils } from "../schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database";

// Interface for filtering chat messages
export interface ChatMessageFilter {
  chat_id?: string;
  character_id?: string | null;
  type?: ChatMessageType;
  chapter_id?: string;
  disabled?: boolean;
}

// Create a new chat message
export async function createChatMessage(messageData: CreateChatMessageParams): Promise<ChatMessage> {
  // Validate chat_id is a valid UUID
  const chatId = uuidUtils.uuid().parse(messageData.chat_id);
  // Validate chapter_id is a valid UUID
  const chapterId = uuidUtils.uuid().parse(messageData.chapter_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the message data against schema
  const validatedMessage = chatMessageSchema.parse({
    id,
    chat_id: chatId,
    chapter_id: chapterId,
    character_id: messageData.character_id,
    type: messageData.type,
    position: messageData.position,
    messages: messageData.messages,
    message_index: messageData.message_index,
    disabled: messageData.disabled ?? false,
    tokens: messageData.tokens,
    extra: messageData.extra,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  // Convert messages array to JSON string for storage
  const messagesStr = JSON.stringify(validatedMessage.messages);

  await executeDBQuery(
    `INSERT INTO chat_messages (
      id, 
      chat_id,
      chapter_id,
      character_id, 
      type, 
      position, 
      messages, 
      message_index,
      disabled, 
      tokens,
      extra,
      created_at, 
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      validatedMessage.id,
      validatedMessage.chat_id,
      validatedMessage.chapter_id,
      validatedMessage.character_id,
      validatedMessage.type,
      validatedMessage.position,
      messagesStr,
      validatedMessage.message_index,
      validatedMessage.disabled,
      validatedMessage.tokens,
      validatedMessage.extra,
      now,
      now,
    ],
  );

  return validatedMessage;
}

// Get a chat message by ID
export async function getChatMessageById(id: string): Promise<ChatMessage | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>(
    `SELECT 
      id, 
      chat_id,
      chapter_id,
      character_id, 
      type, 
      position, 
      messages, 
      message_index,
      disabled, 
      tokens,
      extra,
      created_at, 
      updated_at
    FROM chat_messages 
    WHERE id = $1`,
    [validId],
  );

  if (result.length === 0) {
    return null;
  }

  const message = result[0];

  // Parse JSON string back to array
  message.messages = JSON.parse(message.messages || "[]");
  message.extra = JSON.parse(message.extra || "{}");

  // Convert date strings to Date objects
  message.created_at = new Date(message.created_at);
  message.updated_at = new Date(message.updated_at);

  // Convert disabled to boolean if it's a string or number
  if (typeof message.disabled === "string") {
    message.disabled = message.disabled.toLowerCase() === "true" || message.disabled === "1";
  }

  return message as ChatMessage;
}

// List chat messages with optional filtering
export async function listChatMessages(filter?: ChatMessageFilter): Promise<ChatMessage[]> {
  let query = `
    SELECT 
      id, 
      chat_id,
      chapter_id,
      character_id, 
      type, 
      position, 
      messages, 
      message_index,
      disabled, 
      tokens,
      extra,
      created_at, 
      updated_at
    FROM chat_messages
  `;

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

    if (filter.chapter_id) {
      conditions.push(`chapter_id = $${paramIndex}`);
      params.push(uuidUtils.uuid().parse(filter.chapter_id));
      paramIndex++;
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

    if (filter.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(filter.type);
      paramIndex++;
    }

    if (filter.disabled !== undefined) {
      conditions.push(`disabled = $${paramIndex}`);
      params.push(filter.disabled);
      paramIndex++;
    }
  }

  // Add WHERE clause if there are conditions
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  // Add order by to ensure consistent results (ordered by position)
  query += " ORDER BY position ASC";

  const result = await selectDBQuery<any[]>(query, params);

  // Process results
  return result.map((message) => ({
    ...message,
    messages: JSON.parse(message.messages || "[]"),
    extra: JSON.parse(message.extra || "{}"),
    disabled: message.disabled === "true" || message.disabled === 1,
    created_at: new Date(message.created_at),
    updated_at: new Date(message.updated_at),
  })) as ChatMessage[];
}

// Update a chat message
export async function updateChatMessage(id: string, updateData: UpdateChatMessageParams): Promise<ChatMessage | null> {
  const messageId = uuidUtils.uuid().parse(id);

  // Get the current message to ensure it exists
  const currentMessage = await getChatMessageById(messageId);
  if (!currentMessage) {
    return null;
  }

  // Get current timestamp for update
  const now = formatDateTime();

  // Define field transformations
  const fieldMapping = {
    messages: (value: string[]) => JSON.stringify(value),
    extra: (value: Record<string, any>) => JSON.stringify(value),
  };

  // Build update parameters
  const { updates, values, whereClause } = buildUpdateParams(messageId, updateData, fieldMapping);
  // Add updated_at field to the update
  updates.push(`updated_at = $${values.length + 1}`);
  values.push(now);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE chat_messages SET ${updates.join(", ")}${whereClause}`, values);
  }

  // Return the updated message
  return getChatMessageById(messageId);
}

// Delete a chat message
export async function deleteChatMessage(id: string): Promise<boolean> {
  // Validate ID input
  const messageId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM chat_messages WHERE id = $1", [messageId]);

  // Return true if a row was affected (message was deleted)
  return result.rowsAffected > 0;
}

// Get chat messages by chat ID
export async function getChatMessagesByChatId(chatId: string, chapterId: string): Promise<ChatMessage[]> {
  const validChatId = uuidUtils.uuid().parse(chatId);
  return listChatMessages({ chat_id: validChatId, chapter_id: chapterId });
}

// Get the latest position for a chat to add a new message
export async function getNextMessagePosition(chatId: string, chapterId: string): Promise<number> {
  const validChatId = uuidUtils.uuid().parse(chatId);
  const validChapterId = chapterId ? uuidUtils.uuid().parse(chapterId) : null;

  const result = await selectDBQuery<{ max_position: number | null }[]>(
    "SELECT MAX(position) as max_position FROM chat_messages WHERE chat_id = $1 AND chapter_id = $2",
    [validChatId, validChapterId],
  );

  // If no messages yet, start at 100, otherwise add 100 to the last position
  const lastPosition = result[0]?.max_position || 0;
  return lastPosition + 100;
}

// Export type definitions
export type { ChatMessage, ChatMessageType };

// Disable all messages from a specific character in a chat and chapter, except the last one
export async function disableCharacterMessagesExceptLast(chatId: string, chapterId: string, characterId: string): Promise<number> {
  const validChatId = uuidUtils.uuid().parse(chatId);
  const validChapterId = uuidUtils.uuid().parse(chapterId);
  const validCharacterId = uuidUtils.uuid().parse(characterId);
  const now = formatDateTime();

  const result = await executeDBQuery(
    `UPDATE chat_messages
     SET disabled = true, updated_at = $4
     WHERE chat_id = $1 
       AND chapter_id = $2 
       AND character_id = $3 
       AND position < (SELECT MAX(position) FROM chat_messages WHERE chat_id = $1 AND chapter_id = $2 AND character_id = $3)`,
    [validChatId, validChapterId, validCharacterId, now],
  );

  return result.rowsAffected;
}

// Filter interface with position comparison operators
export interface ChatMessageFilterWithComparison extends ChatMessageFilter {
  position_gt?: number;
  position_lt?: number;
  position_gte?: number;
  position_lte?: number;
  not_type?: ChatMessageType;
}

/**
 * Delete chat messages based on a flexible filter
 *
 * @param filter Object containing filter criteria for deletion
 * @returns Number of affected rows
 */
export async function deleteChatMessagesByFilter(filter: ChatMessageFilterWithComparison): Promise<number> {
  // Ensure we have at least one filter condition to prevent deleting all messages
  if (Object.keys(filter).length === 0) {
    throw new Error("At least one filter condition must be provided");
  }

  const { conditions, params } = buildFilterConditions(filter);
  const query = `DELETE FROM chat_messages WHERE ${conditions.join(" AND ")}`;
  const result = await executeDBQuery(query, params);

  return result.rowsAffected;
}

/**
 * Disable chat messages based on a flexible filter
 *
 * @param filter Object containing filter criteria for messages to disable
 * @returns Number of affected rows
 */
export async function disableChatMessagesByFilter(filter: ChatMessageFilterWithComparison): Promise<number> {
  // Ensure we have at least one filter condition to prevent disabling all messages
  if (Object.keys(filter).length === 0) {
    throw new Error("At least one filter condition must be provided");
  }

  const { conditions, params } = buildFilterConditions(filter);

  // Get current timestamp for update
  const now = formatDateTime();

  // Add updated_at to params
  params.push(now);
  const paramIndex = params.length;

  const query = `UPDATE chat_messages SET disabled = true, updated_at = $${paramIndex} WHERE ${conditions.join(" AND ")}`;
  const result = await executeDBQuery(query, params);

  return result.rowsAffected;
}

/**
 * Helper function to build filter conditions for SQL queries
 *
 * @param filter Filter object with comparison operators
 * @returns Object containing conditions array and params array
 */
function buildFilterConditions(filter: ChatMessageFilterWithComparison): { conditions: string[]; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Build filter conditions dynamically
  if (filter.chat_id) {
    conditions.push(`chat_id = $${paramIndex}`);
    params.push(uuidUtils.uuid().parse(filter.chat_id));
    paramIndex++;
  }

  if (filter.chapter_id) {
    conditions.push(`chapter_id = $${paramIndex}`);
    params.push(uuidUtils.uuid().parse(filter.chapter_id));
    paramIndex++;
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

  if (filter.type) {
    conditions.push(`type = $${paramIndex}`);
    params.push(filter.type);
    paramIndex++;
  }

  if (filter.not_type) {
    conditions.push(`type != $${paramIndex}`);
    params.push(filter.not_type);
    paramIndex++;
  }

  if (filter.disabled !== undefined) {
    conditions.push(`disabled = $${paramIndex}`);
    params.push(filter.disabled);
    paramIndex++;
  }

  // Position operators
  if (filter.position_gt !== undefined) {
    conditions.push(`position > $${paramIndex}`);
    params.push(filter.position_gt);
    paramIndex++;
  }

  if (filter.position_lt !== undefined) {
    conditions.push(`position < $${paramIndex}`);
    params.push(filter.position_lt);
    paramIndex++;
  }

  if (filter.position_gte !== undefined) {
    conditions.push(`position >= $${paramIndex}`);
    params.push(filter.position_gte);
    paramIndex++;
  }

  if (filter.position_lte !== undefined) {
    conditions.push(`position <= $${paramIndex}`);
    params.push(filter.position_lte);
    paramIndex++;
  }

  return { conditions, params };
}

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
      created_at, 
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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

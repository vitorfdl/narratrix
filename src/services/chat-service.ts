import { Chat, ChatParticipant, ChatUserSettings, CreateChatParams, chatSchema } from "@/schema/chat-schema";
import { formatDateTime } from "@/utils/date-time";
import { uuidUtils } from "../schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database";

// Interface for filtering chats
export interface ChatFilter {
  profile_id?: string;
  user_character_id?: string;
}

// Create a new chat
export async function createChat(chatData: CreateChatParams): Promise<Chat> {
  // Validate profile_id is a valid UUID
  const profileId = uuidUtils.uuid().parse(chatData.profile_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the chat data against schema
  const validatedChat = chatSchema.parse({
    id,
    profile_id: profileId,
    name: chatData.name,
    chat_template_id: chatData.chat_template_id,
    participants: chatData.participants || [],
    user_character_id: chatData.user_character_id,
    user_character_settings: chatData.user_character_settings || [],
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  // Convert arrays to JSON strings for storage
  const participantsStr = JSON.stringify(validatedChat.participants);
  const userCharacterSettingsStr = JSON.stringify(validatedChat.user_character_settings);

  await executeDBQuery(
    `INSERT INTO chats (
      id, 
      profile_id, 
      name, 
      chat_template_id, 
      participants, 
      user_character_id, 
      user_character_settings, 
      active_chapter_id,
      created_at, 
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      validatedChat.id,
      validatedChat.profile_id,
      validatedChat.name,
      validatedChat.chat_template_id,
      participantsStr,
      validatedChat.user_character_id,
      userCharacterSettingsStr,
      validatedChat.active_chapter_id,
      now,
      now,
    ],
  );

  return validatedChat;
}

// Get a chat by ID
export async function getChatById(id: string, profileId?: string): Promise<Chat | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  // Build query and parameters based on whether profileId is provided
  let query = `
    SELECT 
      id, 
      profile_id, 
      name, 
      chat_template_id,
      active_chapter_id,
      participants,
      user_character_id,
      user_character_settings,
      created_at, 
      updated_at
    FROM chats 
    WHERE id = $1
  `;
  const params: any[] = [validId];

  if (profileId) {
    query += " AND profile_id = $2";
    params.push(profileId);
  }

  const result = await selectDBQuery<any[]>(query, params);

  if (result.length === 0) {
    return null;
  }

  const chat = result[0];

  // Parse JSON strings back to arrays
  chat.participants = JSON.parse(chat.participants || "[]");
  chat.user_character_settings = JSON.parse(chat.user_character_settings || "[]");

  // Convert date strings to Date objects
  chat.created_at = new Date(chat.created_at);
  chat.updated_at = new Date(chat.updated_at);

  return chat as Chat;
}

// List chats with optional filtering
export async function listChats(filter?: ChatFilter): Promise<Chat[]> {
  let query = `
    SELECT 
      id, 
      profile_id, 
      name, 
      chat_template_id,
      active_chapter_id,
      participants,
      user_character_id,
      user_character_settings,
      created_at, 
      updated_at
    FROM chats
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

    if (filter.user_character_id) {
      conditions.push(`user_character_id = $${paramIndex}`);
      params.push(filter.user_character_id);
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
  return result.map((chat) => ({
    ...chat,
    participants: JSON.parse(chat.participants || "[]"),
    user_character_settings: JSON.parse(chat.user_character_settings || "[]"),
    created_at: new Date(chat.created_at),
    updated_at: new Date(chat.updated_at),
  })) as Chat[];
}

// Update a chat
export async function updateChat(id: string, updateData: Partial<Omit<Chat, "id" | "profile_id" | "created_at" | "updated_at">>): Promise<Chat | null> {
  const chatId = uuidUtils.uuid().parse(id);

  // Get the current chat to ensure it exists
  const currentChat = await getChatById(chatId);
  if (!currentChat) {
    return null;
  }

  // Define field transformations
  const fieldMapping = {
    participants: (value: ChatParticipant[]) => JSON.stringify(value),
    user_character_settings: (value: ChatUserSettings[]) => JSON.stringify(value),
  };

  // Build update parameters
  const { updates, values, whereClause } = buildUpdateParams(chatId, updateData, fieldMapping);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE chats SET ${updates.join(", ")}${whereClause}`, values);
  }

  // Return the updated chat
  return getChatById(chatId);
}

// Delete a chat
export async function deleteChat(id: string): Promise<boolean> {
  // Validate ID input
  const chatId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM chats WHERE id = $1", [chatId]);

  // Return true if a row was affected (chat was deleted)
  return result.rowsAffected > 0;
}

// Get chats by profile ID
export async function getChatsByProfileId(profileId: string): Promise<Chat[]> {
  const validProfileId = uuidUtils.uuid().parse(profileId);
  return listChats({ profile_id: validProfileId });
}

// Export type definitions
export type { Chat, ChatParticipant, ChatUserSettings };

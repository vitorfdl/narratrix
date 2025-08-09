import { ChatChapter, CreateChatChapterParams, chatChapterSchema, UpdateChatChapterParams } from "@/schema/chat-chapter-schema";
import { formatDateTime } from "@/utils/date-time";
import { uuidUtils } from "../schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database";

// Interface for filtering chat chapters
export interface ChatChapterFilter {
  chat_id?: string;
}

// Create a new chat chapter
export async function createChatChapter(chapterData: CreateChatChapterParams): Promise<ChatChapter> {
  // Validate chat_id is a valid UUID
  const chatId = uuidUtils.uuid().parse(chapterData.chat_id);

  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Validate the chat chapter data against schema
  const validatedChapter = chatChapterSchema.parse({
    id,
    chat_id: chatId,
    title: chapterData.title,
    sequence: chapterData.sequence,
    scenario: chapterData.scenario || null,
    instructions: chapterData.instructions || null,
    start_message: chapterData.start_message || null,
    custom: chapterData.custom || null,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  // Convert custom object to JSON string for storage
  const customStr = validatedChapter.custom ? JSON.stringify(validatedChapter.custom) : null;

  await executeDBQuery(
    "INSERT INTO chat_chapters (id, chat_id, title, sequence, scenario, instructions, start_message, custom, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    [
      validatedChapter.id,
      validatedChapter.chat_id,
      validatedChapter.title,
      validatedChapter.sequence,
      validatedChapter.scenario,
      validatedChapter.instructions,
      validatedChapter.start_message,
      customStr,
      now,
      now,
    ],
  );

  return validatedChapter;
}

// Get a chat chapter by ID
export async function getChatChapterById(id: string): Promise<ChatChapter | null> {
  // Validate ID input
  const validId = uuidUtils.uuid().parse(id);

  const result = await selectDBQuery<any[]>("SELECT id, chat_id, title, sequence, scenario, instructions, start_message, custom, created_at, updated_at FROM chat_chapters WHERE id = $1", [validId]);

  if (result.length === 0) {
    return null;
  }

  const chapter = result[0];

  // Parse JSON string back to object if not null
  if (chapter.custom) {
    chapter.custom = JSON.parse(chapter.custom);
  }

  // Convert date strings to Date objects
  chapter.created_at = new Date(chapter.created_at);
  chapter.updated_at = new Date(chapter.updated_at);

  return chapter as ChatChapter;
}

// List chat chapters with optional filtering
export async function listChatChapters(filter?: ChatChapterFilter): Promise<ChatChapter[]> {
  let query = "SELECT id, chat_id, title, sequence, scenario, instructions, start_message, custom, created_at, updated_at FROM chat_chapters";

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
  }

  // Add WHERE clause if there are conditions
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  // Add order by to ensure consistent results (by sequence for chapters)
  query += " ORDER BY sequence ASC";

  const result = await selectDBQuery<any[]>(query, params);

  // Process results
  return result.map((chapter) => {
    // Parse custom JSON if it exists
    if (chapter.custom) {
      chapter.custom = JSON.parse(chapter.custom);
    }

    return {
      ...chapter,
      created_at: new Date(chapter.created_at),
      updated_at: new Date(chapter.updated_at),
    };
  }) as ChatChapter[];
}

// Update a chat chapter
export async function updateChatChapter(id: string, updateData: UpdateChatChapterParams): Promise<ChatChapter | null> {
  const chapterId = uuidUtils.uuid().parse(id);

  // Get the current chapter to ensure it exists
  const currentChapter = await getChatChapterById(chapterId);
  if (!currentChapter) {
    return null;
  }

  // Extend UpdateChatChapterParams with custom field for the field mapping
  type ExtendedUpdateParams = UpdateChatChapterParams & { custom?: any };

  // Define field transformations for the extended type
  const fieldMapping: Partial<Record<keyof ExtendedUpdateParams, (value: any) => any>> = {
    custom: (value: any) => (value ? JSON.stringify(value) : null),
  };

  // Build update parameters
  const { updates, values, whereClause } = buildUpdateParams(chapterId, updateData, fieldMapping);

  // Execute update if there are fields to update
  if (updates.length > 0) {
    await executeDBQuery(`UPDATE chat_chapters SET ${updates.join(", ")}${whereClause}`, values);
  }

  // Return the updated chapter
  return getChatChapterById(chapterId);
}

// Delete a chat chapter
export async function deleteChatChapter(id: string): Promise<boolean> {
  // Validate ID input
  const chapterId = uuidUtils.uuid().parse(id);

  const result = await executeDBQuery("DELETE FROM chat_chapters WHERE id = $1", [chapterId]);

  // Return true if a row was affected (chapter was deleted)
  return result.rowsAffected > 0;
}

// Get chapters by chat ID
export async function getChaptersByChatId(chatId: string): Promise<ChatChapter[]> {
  const validChatId = uuidUtils.uuid().parse(chatId);
  return listChatChapters({ chat_id: validChatId });
}

// Get the next sequence number for a chat
export async function getNextChapterSequence(chatId: string): Promise<number> {
  const validChatId = uuidUtils.uuid().parse(chatId);

  const result = await selectDBQuery<any[]>("SELECT MAX(sequence) as max_sequence FROM chat_chapters WHERE chat_id = $1", [validChatId]);

  // If there are no chapters yet, start with 1
  const maxSequence = result[0]?.max_sequence || 0;
  return maxSequence + 1;
}

// Export type definitions
export type { ChatChapter, CreateChatChapterParams, UpdateChatChapterParams };

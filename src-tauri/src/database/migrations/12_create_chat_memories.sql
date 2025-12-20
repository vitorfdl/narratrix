-- Migration: Create chat_memories table
-- This table stores both short-term (chapter-specific) and long-term (chat-wide) memories
-- for characters and users in chats

CREATE TABLE IF NOT EXISTS chat_memories (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    chapter_id TEXT, -- NULL for long-term memory, non-NULL for short-term (chapter-specific) memory
    character_id TEXT, -- NULL for user memory, non-NULL for character memory
    content TEXT NOT NULL, -- The large text block containing the memory
    metadata TEXT, -- JSON string for future extensibility
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chat_chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Composite index for finding memories by chat and chapter (useful for short-term memories)
CREATE INDEX idx_chat_memories_chat_chapter ON chat_memories(chat_id, chapter_id);

-- Composite index for finding character-specific memories in a chat
CREATE INDEX idx_chat_memories_chat_character ON chat_memories(chat_id, character_id);


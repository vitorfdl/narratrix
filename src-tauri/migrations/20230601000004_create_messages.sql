CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    character_id TEXT, -- NULL for user messages
    type TEXT NOT NULL CHECK (type IN ('user', 'character', 'system')),
    expression TEXT,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
);

-- Index on chat_id for efficient lookups of messages by chat
CREATE INDEX idx_messages_chat_id ON messages(chat_id);

-- Index on character_id for filtering messages by character
CREATE INDEX idx_messages_character_id ON messages(character_id);

-- Index on type for filtering messages by type
CREATE INDEX idx_messages_type ON messages(type);

-- Index on created_at for sorting messages chronologically
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Composite index for finding messages of a specific type in a chat
CREATE INDEX idx_messages_chat_type ON messages(chat_id, type);

-- Composite index for finding messages from a specific character in a chat
CREATE INDEX idx_messages_chat_character ON messages(chat_id, character_id); 
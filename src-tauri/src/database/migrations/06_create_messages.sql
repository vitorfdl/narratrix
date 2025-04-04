CREATE TABLE IF NOT EXISTS chat_chapters (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    title TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    scenario TEXT,
    instructions TEXT,
    start_message TEXT,
    custom TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    UNIQUE (chat_id, title)
);

CREATE INDEX idx_chat_chapters_chat_id ON chat_chapters(chat_id, sequence);


CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    character_id TEXT, -- NULL for user messages
    type TEXT NOT NULL CHECK (type IN ('user', 'character', 'system')),
    position INTEGER NOT NULL,  -- Use 100, 200, 300 instead of 1,2,3
    messages TEXT NOT NULL, -- JSON Array of messages ["message", "message", "message"]
    message_index INTEGER NOT NULL, -- Use 0, 1, 2, 3... Refer to which message in the messages array this is
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chat_chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL,
    UNIQUE (chat_id, chapter_id, position)
);

-- Index for getting messages by chat_id ordered by position
CREATE INDEX idx_messages_chat_position ON chat_messages(chat_id, position);

-- Index for getting messages by chat_id and character_id ordered by position
CREATE INDEX idx_messages_chat_character_position ON chat_messages(chat_id, character_id, position);

-- Index on character_id for filtering messages by character
CREATE INDEX idx_messages_character_id ON chat_messages(character_id);

-- Composite index for finding messages of a specific type in a chat
CREATE INDEX idx_messages_chat_type ON chat_messages(chat_id, type);

-- Composite index for finding messages from a specific character in a chat
CREATE INDEX idx_messages_chat_character ON chat_messages(chat_id, character_id); 

CREATE TABLE IF NOT EXISTS chat_message_summaries (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    range_start INTEGER NOT NULL,
    range_end INTEGER NOT NULL,
    summary TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chat_chapters(id) ON DELETE CASCADE
);

create index idx_chat_message_summaries_chat_id on chat_message_summaries(chat_id, chapter_id);




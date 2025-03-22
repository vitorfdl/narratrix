CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    title TEXT NOT NULL,
    participants TEXT NOT NULL, -- JSON array of character ids
    inference_settings TEXT, -- JSON string for settings
    chapters TEXT, -- JSON array of chapter settings
    user_character_id TEXT,
    user_character_settings TEXT,
    chat_template_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_template_id) REFERENCES chat_template(id) ON DELETE SET NULL,
    FOREIGN KEY (user_character_id) REFERENCES characters(id) ON DELETE SET NULL
); 

-- Index on profile_id for efficient lookups of chats by profile
CREATE INDEX idx_chats_profile_id ON chats(profile_id);

-- Index on created_at for sorting chats chronologically
CREATE INDEX idx_chats_created_at ON chats(created_at);

-- Index on updated_at for finding recently active chats
CREATE INDEX idx_chats_updated_at ON chats(updated_at); 

CREATE TABLE IF NOT EXISTS chat_template (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    name TEXT NOT NULL,
    format_template_id TEXT,
    config TEXT NOT NULL, -- JSON string for configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (format_template_id) REFERENCES format_template(id) ON DELETE SET NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
); 

-- Index on profile_id for efficient lookups of templates by profile
CREATE INDEX idx_chat_template_profile_id ON chat_template(profile_id);

-- Index on chat_id for efficient lookups of templates by chat
CREATE INDEX idx_chat_template_chat_id ON chat_template(chat_id);

-- Index on format_template_id for relationship lookups
CREATE INDEX idx_chat_template_format_template ON chat_template(format_template_id);

-- Index on name for searching/filtering by template name
CREATE INDEX idx_chat_template_name ON chat_template(name);

-- Composite index for finding templates for a specific chat in a profile
CREATE INDEX idx_chat_template_profile_chat ON chat_template(profile_id, chat_id);

-- Index on created_at for chronological sorting
CREATE INDEX idx_chat_template_created_at ON chat_template(created_at);


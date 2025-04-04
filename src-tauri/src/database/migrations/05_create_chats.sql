CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    participants TEXT NOT NULL, -- JSON array of character references [{ id: string, settings: { [key: string]: any } }]
    active_chapter_id TEXT, -- foreign key to chat_chapters table
    chat_template_id TEXT, -- foreign key to chat_template table
    user_character_id TEXT, -- foreign key to characters table
    user_character_settings TEXT, -- JSON string for settings [{ [key: string]: any }]
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_template_id) REFERENCES chat_template(id) ON DELETE SET NULL,
    FOREIGN KEY (user_character_id) REFERENCES characters(id) ON DELETE SET NULL,
    FOREIGN KEY (active_chapter_id) REFERENCES chat_chapters(id) ON DELETE SET NULL
); 

-- Index on profile_id for efficient lookups of chats by profile
CREATE INDEX idx_chats_profile_id ON chats(profile_id);

-- Index on created_at for sorting chats chronologically
CREATE INDEX idx_chats_created_at ON chats(created_at);

-- Index on updated_at for finding recently active chats
CREATE INDEX idx_chats_updated_at ON chats(updated_at);

/**
 * Chat Templates
 */
CREATE TABLE IF NOT EXISTS chat_template (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    model_id TEXT, -- foreign key to models table
    custom_prompts TEXT, -- JSON string for custom prompts [{ [key: string]: any }]
    config TEXT NOT NULL, -- JSON string for configuration { [key: string]: any }
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL
); 

-- Index on profile_id for efficient lookups of templates by profile
CREATE INDEX idx_chat_template_profile_id ON chat_template(profile_id);

-- Index on created_at for chronological sorting
CREATE INDEX idx_chat_template_created_at ON chat_template(created_at);

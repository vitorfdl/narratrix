CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    title TEXT NOT NULL,
    participants TEXT NOT NULL, -- JSON array of character ids
    inference_settings TEXT, -- JSON string for settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
); 

-- Index on profile_id for efficient lookups of chats by profile
CREATE INDEX idx_chats_profile_id ON chats(profile_id);

-- Index on created_at for sorting chats chronologically
CREATE INDEX idx_chats_created_at ON chats(created_at);

-- Index on updated_at for finding recently active chats
CREATE INDEX idx_chats_updated_at ON chats(updated_at); 
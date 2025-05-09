-- Used for both agents and characters
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version TEXT NOT NULL, -- 1.0.0 format
    avatar_path TEXT, -- optional
    tags TEXT, -- JSON array of tags ["tag1", "tag2", "tag3"]
    external_update_link TEXT, -- optional
    auto_update BOOLEAN NOT NULL DEFAULT TRUE, -- only used if external_update_link is provided
    type TEXT NOT NULL CHECK (type IN ('agent', 'character')),
    character_manifest_id TEXT, -- future use for character manifest
    expressions TEXT, -- JSON array of expressions [{id: string, name: string, image_path: string }]
    system_override TEXT,
    settings TEXT, -- JSON object { [key: string]: any }
    custom TEXT, -- JSON object { [key: string]: any }
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
); 

-- Index on profile_id for efficient lookups of characters by profile
CREATE INDEX idx_characters_profile_id ON characters(profile_id);

-- Index on character type for filtering
CREATE INDEX idx_characters_type ON characters(type);

-- Composite index for finding characters of specific type for a profile
CREATE INDEX idx_characters_profile_type ON characters(profile_id, type);

-- Index on name for searching/filtering by character name
CREATE INDEX idx_characters_name ON characters(name); 
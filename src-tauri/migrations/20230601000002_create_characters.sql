CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('agent', 'character')),
    avatar_path TEXT,
    expressions TEXT, -- JSON array of paths
    personality TEXT,
    system_override TEXT,
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
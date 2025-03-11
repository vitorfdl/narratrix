CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    avatar_path TEXT,
    settings TEXT NOT NULL DEFAULT '{}', -- JSON string for configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
); 

-- Index on name is automatically created due to UNIQUE constraint
-- Add index on created_at for efficient sorting/filtering by creation date
CREATE INDEX idx_profiles_created_at ON profiles(created_at); 
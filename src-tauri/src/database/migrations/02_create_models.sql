CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    model_origin TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'audio', 'image')),
    config TEXT NOT NULL, -- JSON string for configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
); 

-- Index on profile_id for efficient lookups of models by profile
CREATE INDEX idx_models_profile_id ON models(profile_id);

-- Composite index for finding models of specific type for a profile
CREATE INDEX idx_models_profile_type ON models(profile_id, type);

-- Index on type for filtering models by type
CREATE INDEX idx_models_type ON models(type); 
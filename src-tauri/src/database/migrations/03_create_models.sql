CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('llm', 'audio', 'image', 'embedding', 'database')),
    manifest_id TEXT NOT NULL,
    config TEXT NOT NULL, -- JSON string for configuration
    max_concurrency INTEGER NOT NULL DEFAULT 1,
    format_template_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (format_template_id) REFERENCES format_template(id) ON DELETE SET NULL
); 

-- Index on profile_id for efficient lookups of models by profile
CREATE INDEX idx_models_profile_id ON models(profile_id);

-- Composite index for finding models of specific type for a profile
CREATE INDEX idx_models_profile_type ON models(profile_id, type);

-- Index on type for filtering models by type
CREATE INDEX idx_models_type ON models(type); 
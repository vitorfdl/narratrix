CREATE TABLE IF NOT EXISTS format_template (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL, -- JSON string for configuration
    prompts TEXT NOT NULL, -- JSON string for prompts
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
); 

CREATE TABLE IF NOT EXISTS inference_template (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL, -- JSON string for configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
); 

CREATE INDEX idx_format_template_profile_id ON format_template(profile_id);

CREATE INDEX idx_inference_template_profile_id ON inference_template(profile_id);


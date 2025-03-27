CREATE TABLE IF NOT EXISTS format_template (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    inference_template_id TEXT,
    prompt_template_id TEXT,
    config TEXT NOT NULL, -- JSON string for configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (inference_template_id) REFERENCES inference_template(id) ON DELETE SET NULL,
    FOREIGN KEY (prompt_template_id) REFERENCES context_template(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS context_template (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL, -- JSON string for configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_format_template_profile_id ON format_template(profile_id);
CREATE INDEX idx_format_template_inference ON format_template(inference_template_id);
CREATE INDEX idx_format_template_context ON format_template(prompt_template_id);

CREATE INDEX idx_inference_template_profile_id ON inference_template(profile_id);

CREATE INDEX idx_context_template_profile_id ON context_template(profile_id);

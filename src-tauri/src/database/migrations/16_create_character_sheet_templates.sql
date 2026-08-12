CREATE TABLE IF NOT EXISTS character_sheet_template (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    favorite BOOLEAN NOT NULL DEFAULT 0,
    sections TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_character_sheet_template_profile_id ON character_sheet_template(profile_id);




CREATE TABLE IF NOT EXISTS lorebooks (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- single category for the lorebook
    tags TEXT DEFAULT '[]', -- array of tags

    allow_recursion BOOLEAN NOT NULL DEFAULT FALSE, -- Whether the lorebook allows entries to trigger other entries recursively
    max_recursion_depth INTEGER NOT NULL DEFAULT 25, -- Maximum depth of recursive scans

    max_depth INTEGER NOT NULL DEFAULT 25, -- Maximum depth of messages
    max_tokens INTEGER NOT NULL DEFAULT 1000, -- Maximum token limit of the lorebook response. 0 = infinite

    group_keys TEXT DEFAULT '[]', -- array of groups

    extra TEXT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_lorebooks_profile_id ON lorebooks(profile_id);

CREATE TABLE IF NOT EXISTS lorebook_entries (
    id TEXT PRIMARY KEY,
    lorebook_id TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    comment TEXT NOT NULL, -- A.k.a. "title"
    content TEXT NOT NULL DEFAULT '',
    vector_content TEXT NULL, -- vectorized content for semantic search
    group_key TEXT, -- A.k.a. "category"

    insertion_type TEXT NOT NULL DEFAULT 'lorebook_top', -- lorebook_top, lorebook_bottom, user, assistant (lorebook disables depth)
    depth INTEGER NOT NULL DEFAULT 1, -- Depth of the entry
    trigger_chance INTEGER NOT NULL DEFAULT 100, -- Chance of the entry to be triggered
    priority INTEGER NOT NULL DEFAULT 100, -- Priority of the entry

    constant BOOLEAN NOT NULL DEFAULT FALSE, -- Whether the entry is constant or not, disables keywords, depth and min_chat_messages
    keywords TEXT DEFAULT '[]', -- array of keywords triggers
    case_sensitive BOOLEAN NOT NULL DEFAULT FALSE, -- Whether the keywords are case sensitive
    match_partial_words BOOLEAN NOT NULL DEFAULT TRUE, -- Whether the keywords can match partial words ex: "Gray" matches "Grayish"
    min_chat_messages INTEGER NOT NULL DEFAULT 1, -- Minimum number of chat messages before the entry can be triggered
    
    extra TEXT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);

-- need indexes for the queries with the following filters: group_key, priority, enabled, lorebook_id
CREATE INDEX idx_lorebook_entries_group_key ON lorebook_entries(lorebook_id, group_key);
CREATE INDEX idx_lorebook_entries_priority ON lorebook_entries(lorebook_id, priority);
CREATE INDEX idx_lorebook_entries_enabled ON lorebook_entries(lorebook_id, enabled);
CREATE INDEX idx_lorebook_entries_lorebook_id ON lorebook_entries(lorebook_id);

-- Add lorebook_id foreign key to characters table
ALTER TABLE characters ADD COLUMN lorebook_id TEXT NULL REFERENCES lorebooks(id) ON DELETE SET NULL;

-- Add lorebook_list to chat_templates
ALTER TABLE chat_template ADD COLUMN lorebook_list TEXT NULL

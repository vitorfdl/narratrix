/**
 * Agents Table
 * Stores agent workflows with their node graph configuration
 */
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    tags TEXT DEFAULT '[]', -- JSON array of tags
    
    -- Workflow configuration
    nodes TEXT NOT NULL DEFAULT '[]', -- JSON array of nodes
    edges TEXT NOT NULL DEFAULT '[]', -- JSON array of edges
    settings TEXT NOT NULL DEFAULT '{}', -- JSON object for workflow settings
    
    -- Metadata
    category TEXT, -- Category for organization
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX idx_agents_profile_id ON agents(profile_id);
CREATE INDEX idx_agents_favorite ON agents(profile_id, favorite);
CREATE INDEX idx_agents_category ON agents(profile_id, category);
CREATE INDEX idx_agents_created_at ON agents(created_at);
CREATE INDEX idx_agents_updated_at ON agents(updated_at);

/**
 * Custom Nodes Table
 * Stores reusable custom node definitions that can be used in agent workflows
 */
CREATE TABLE IF NOT EXISTS custom_nodes (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    
    -- Node definition
    node_type TEXT NOT NULL, -- The type identifier for this custom node
    tags TEXT DEFAULT '[]', -- JSON array of tags
    
    -- Node configuration schema
    default_config TEXT NOT NULL DEFAULT '{}', -- Default configuration values
    
    -- Metadata
    extra TEXT NULL DEFAULT '{}', -- Additional metadata
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX idx_custom_nodes_profile_id ON custom_nodes(profile_id);
CREATE INDEX idx_custom_nodes_node_type ON custom_nodes(node_type);
CREATE INDEX idx_custom_nodes_favorite ON custom_nodes(profile_id, favorite);
CREATE INDEX idx_custom_nodes_created_at ON custom_nodes(created_at);
CREATE INDEX idx_custom_nodes_updated_at ON custom_nodes(updated_at);

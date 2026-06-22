-- Add tools column to chat_template table.
-- Stores a JSON array of tool references the chat LLM can call:
-- [{ "agent_id": "...", "node_id": "..." }] (node_id optional).
ALTER TABLE chat_template ADD COLUMN tools TEXT NULL DEFAULT '[]';

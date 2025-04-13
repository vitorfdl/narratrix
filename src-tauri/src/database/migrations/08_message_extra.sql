-- Add extra column to chat_messages table
ALTER TABLE chat_messages ADD COLUMN extra TEXT NULL DEFAULT '{}';
ALTER TABLE chat_messages ADD COLUMN messages_vector TEXT NULL;
ALTER TABLE chat_messages ADD COLUMN tokens INTEGER NULL;
ALTER TABLE profiles ADD COLUMN version INTEGER NULL;

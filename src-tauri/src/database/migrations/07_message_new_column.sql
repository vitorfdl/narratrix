ALTER TABLE chat_messages ADD COLUMN tokens INTEGER NULL DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN extra TEXT NULL DEFAULT '{}';

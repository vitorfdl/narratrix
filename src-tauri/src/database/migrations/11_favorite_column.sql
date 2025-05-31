-- Migration: Add favorite column to templates, models, characters, and chats
-- This migration adds a boolean favorite column with default value FALSE to all relevant tables

-- Add favorite column to format_template table
ALTER TABLE format_template ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add favorite column to inference_template table  
ALTER TABLE inference_template ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add favorite column to models table
ALTER TABLE models ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add favorite column to characters table
ALTER TABLE characters ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add favorite column to chats table
ALTER TABLE chats ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add favorite column to chat_template table
ALTER TABLE chat_template ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;
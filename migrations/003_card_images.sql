-- Migration: Add card_images table for storing images attached to cards
-- Date: 2025-09-15
-- Purpose: Enable users to attach images to their solution cards for visual reference

-- Create card_images table
CREATE TABLE IF NOT EXISTS card_images (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    image_path TEXT NOT NULL, -- Relative path like 'images/cards/card_123/uuid.png'
    caption TEXT,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_card_images_card_id ON card_images(card_id);
CREATE INDEX IF NOT EXISTS idx_card_images_position ON card_images(position);
-- Migration: Add updated_at to problems table
-- Author: Claude Assistant
-- Date: 2025-01-15
-- Description: Adds updated_at column to problems table for comprehensive update tracking
-- Version: 1.2.0
-- 
-- This migration adds an updated_at timestamp to the problems table to track
-- when problem metadata (title, description, difficulty, etc.) is modified.
-- This will be used alongside card.last_modified for accurate dashboard sorting.

BEGIN TRANSACTION;

-- Add updated_at column to problems table
-- Initialize to created_at for existing problems to maintain consistency
ALTER TABLE problems ADD COLUMN updated_at DATETIME;

-- Set initial updated_at values to created_at for existing problems
UPDATE problems SET updated_at = created_at WHERE updated_at IS NULL;

-- Add NOT NULL constraint and default for new problems
-- Note: SQLite doesn't support modifying column constraints directly,
-- but we'll handle this in the application code by ensuring the field is always set

-- Add index for efficient sorting by updated_at
CREATE INDEX idx_problems_updated_at ON problems(updated_at DESC);

-- Add index for combined sorting scenarios
CREATE INDEX idx_problems_created_updated ON problems(created_at DESC, updated_at DESC);

COMMIT;

-- Rollback Instructions:
-- To rollback this migration, run the following commands:
-- 
-- BEGIN TRANSACTION;
-- DROP INDEX idx_problems_updated_at;
-- DROP INDEX idx_problems_created_updated;
-- -- Note: SQLite doesn't support DROP COLUMN directly in older versions.
-- -- You would need to recreate the table without the updated_at column
-- COMMIT;

-- Verification Queries:
-- Check if the column was added successfully:
-- PRAGMA table_info(problems);
-- 
-- Check if the indexes were created:
-- PRAGMA index_list(problems);
-- 
-- Verify data integrity:
-- SELECT id, title, created_at, updated_at FROM problems LIMIT 5;
-- 
-- Test updated_at is populated:
-- SELECT COUNT(*) as problems_with_updated_at FROM problems WHERE updated_at IS NOT NULL;
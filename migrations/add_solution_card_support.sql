-- Migration: Add Solution Card Support
-- Author: Claude Assistant
-- Date: 2025-08-26
-- Description: Adds is_solution flag to cards table for solution card feature
-- Version: 1.1.0
-- 
-- This migration adds support for solution cards - special cards that hold
-- the solution to a problem. These cards don't count in normal card navigation
-- and are accessed via Shift+Click on the next card button.

BEGIN TRANSACTION;

-- Add is_solution column with clear default and constraints
-- Using INTEGER for SQLite boolean compatibility (0 = false, 1 = true)
ALTER TABLE cards ADD COLUMN is_solution INTEGER DEFAULT 0 CHECK(is_solution IN (0, 1));

-- Add index for efficient solution card queries
-- This will be used frequently to filter regular cards vs solution cards
CREATE INDEX idx_cards_solution ON cards(is_solution, problem_id);

-- Add comment to document the column purpose
-- Note: SQLite doesn't support column comments, but this serves as documentation

COMMIT;

-- Rollback Instructions:
-- To rollback this migration, run the following commands:
-- 
-- BEGIN TRANSACTION;
-- DROP INDEX idx_cards_solution;
-- ALTER TABLE cards DROP COLUMN is_solution;
-- COMMIT;
-- 
-- Note: SQLite doesn't support DROP COLUMN directly in older versions.
-- In that case, you would need to:
-- 1. CREATE TABLE cards_backup AS SELECT all_columns_except_is_solution FROM cards;
-- 2. DROP TABLE cards;
-- 3. ALTER TABLE cards_backup RENAME TO cards;
-- 4. Recreate all indexes and constraints

-- Verification Queries:
-- Check if the column was added successfully:
-- PRAGMA table_info(cards);
-- 
-- Check if the index was created:
-- PRAGMA index_list(cards);
-- 
-- Test the constraint:
-- INSERT INTO cards (id, problem_id, card_number, is_solution) VALUES ('test', 'prob1', 1, 2); -- Should fail
-- INSERT INTO cards (id, problem_id, card_number, is_solution) VALUES ('test', 'prob1', 1, 1); -- Should succeed
-- DELETE FROM cards WHERE id = 'test'; -- Cleanup
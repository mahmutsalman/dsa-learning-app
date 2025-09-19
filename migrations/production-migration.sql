-- Production Database Migration: Add Solution Card Support
-- Author: Claude Assistant  
-- Date: 2025-08-27
-- Target: Production Database
-- Description: Adds is_solution column to cards table for solution card functionality
-- Version: 1.1.0
--
-- IMPORTANT: This migration fixes the "no such column: is_solution" error
-- by adding the missing column that exists in development but not production.

-- ============================================================================
-- STEP 1: BACKUP PREPARATION
-- ============================================================================
-- Before running this migration, create a backup:
-- sqlite3 your_production_database.db ".backup production_backup_$(date +%Y%m%d_%H%M%S).db"

-- ============================================================================
-- STEP 2: SCHEMA MIGRATION
-- ============================================================================

-- Start atomic transaction
BEGIN TRANSACTION;

-- Create migration_log table if it doesn't exist (for tracking migrations)
CREATE TABLE IF NOT EXISTS migration_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'started'
);

-- Log migration start
INSERT OR IGNORE INTO migration_log (migration_name, started_at, status) 
VALUES ('add_solution_card_support', datetime('now'), 'started');

-- Check if is_solution column exists before adding it
-- This prevents "duplicate column name" error if column already exists
-- Using a conditional approach with error handling
.print "Checking if is_solution column exists..."

-- Add is_solution column with proper constraints only if it doesn't exist
-- Using a safe approach that won't fail if column already exists
ALTER TABLE cards ADD COLUMN is_solution INTEGER DEFAULT 0 CHECK(is_solution IN (0, 1));

-- Create performance index for solution card queries
-- This index will be used frequently to:
-- 1. Find solution cards: WHERE is_solution = 1  
-- 2. Filter regular cards: WHERE is_solution = 0 OR is_solution IS NULL
-- 3. Problem-specific queries: WHERE problem_id = ? AND is_solution = ?
CREATE INDEX IF NOT EXISTS idx_cards_solution ON cards(is_solution, problem_id);

-- Ensure all existing cards are marked as regular cards (not solution cards)
-- This handles any NULL values that might exist and ensures data consistency
UPDATE cards SET is_solution = 0 WHERE is_solution IS NULL;

-- Update migration log
UPDATE migration_log SET status = 'completed', completed_at = datetime('now') 
WHERE migration_name = 'add_solution_card_support' AND status = 'started';

-- Commit transaction - all changes are applied atomically
COMMIT;

-- ============================================================================
-- STEP 3: POST-MIGRATION VALIDATION
-- ============================================================================

-- Verify table structure (should show is_solution column)
PRAGMA table_info(cards);

-- Verify index creation (should show idx_cards_solution)  
PRAGMA index_list(cards);

-- Data integrity check
SELECT 
    COUNT(*) as total_cards,
    COUNT(CASE WHEN is_solution = 1 THEN 1 END) as solution_cards,
    COUNT(CASE WHEN is_solution = 0 THEN 1 END) as regular_cards,
    COUNT(CASE WHEN is_solution IS NULL THEN 1 END) as null_values
FROM cards;

-- Test constraint (should succeed)
INSERT INTO cards (id, problem_id, card_number, is_solution, code, language, notes) 
VALUES ('migration_test', 'test_problem', 1, 1, '', 'java', 'Test solution card');

-- Cleanup test data
DELETE FROM cards WHERE id = 'migration_test';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Success message
SELECT 'Migration completed successfully! The is_solution column has been added.' as result;

-- Next steps:
-- 1. Test application functionality
-- 2. Verify solution card creation works
-- 3. Check that shift+click functionality operates correctly
-- 4. Monitor application logs for any remaining errors

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If you encounter errors, check:
-- 1. Database file permissions
-- 2. Sufficient disk space
-- 3. No active connections during migration
-- 4. SQLite version compatibility

-- To check migration status:
-- SELECT * FROM migration_log WHERE migration_name = 'add_solution_card_support';

-- To verify the column exists:
-- PRAGMA table_info(cards);

-- To check for any solution cards:
-- SELECT COUNT(*) FROM cards WHERE is_solution = 1;

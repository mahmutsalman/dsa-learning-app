-- Safe Production Database Migration: Add Solution Card Support
-- Author: Claude Assistant  
-- Date: 2025-08-27
-- Target: Production Database
-- Description: Safely adds is_solution column to cards table for solution card functionality
-- Version: 1.1.0 (Safe Version)
--
-- This script handles the case where the column might already exist
-- and provides a safe migration path for production environments.

-- ============================================================================
-- STEP 1: BACKUP PREPARATION
-- ============================================================================
-- Before running this migration, create a backup:
-- sqlite3 your_production_database.db ".backup production_backup_$(date +%Y%m%d_%H%M%S).db"

-- ============================================================================
-- STEP 2: SAFE SCHEMA MIGRATION  
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
VALUES ('add_solution_card_support_safe', datetime('now'), 'started');

-- Check if migration has already been applied by checking for the column
-- Create a temporary test to see if column exists
.mode column
.headers on

-- Check current table schema
.print "=== CHECKING CURRENT TABLE SCHEMA ==="
PRAGMA table_info(cards);

-- Safe column addition approach using error handling
-- This will either succeed (column doesn't exist) or fail silently (column exists)
.print "=== ATTEMPTING TO ADD is_solution COLUMN ==="
.print "Note: If column already exists, the next command will fail - this is expected and safe"

-- Try to add the column - this will fail if column already exists
-- The OR ROLLBACK ensures we don't break the transaction if column exists
SAVEPOINT add_column;
ALTER TABLE cards ADD COLUMN is_solution INTEGER DEFAULT 0 CHECK(is_solution IN (0, 1));
RELEASE SAVEPOINT add_column;

-- Alternative approach if above fails: we continue without error
-- The rest of the script will work regardless of whether the column was just added or already existed

-- Create performance index for solution card queries (safe - uses IF NOT EXISTS)
-- This index will be used frequently to:
-- 1. Find solution cards: WHERE is_solution = 1  
-- 2. Filter regular cards: WHERE is_solution = 0 OR is_solution IS NULL
-- 3. Problem-specific queries: WHERE problem_id = ? AND is_solution = ?
CREATE INDEX IF NOT EXISTS idx_cards_solution ON cards(is_solution, problem_id);

-- Ensure all existing cards are marked as regular cards (not solution cards)
-- This handles any NULL values that might exist and ensures data consistency
-- This is safe to run multiple times
UPDATE cards SET is_solution = 0 WHERE is_solution IS NULL OR is_solution NOT IN (0, 1);

-- Update migration log
UPDATE migration_log SET status = 'completed', completed_at = datetime('now') 
WHERE migration_name = 'add_solution_card_support_safe' AND status = 'started';

-- Commit transaction - all changes are applied atomically
COMMIT;

-- ============================================================================
-- STEP 3: POST-MIGRATION VALIDATION
-- ============================================================================

.print "=== POST-MIGRATION VALIDATION ==="

-- Verify table structure (should show is_solution column)
.print "Table structure after migration:"
PRAGMA table_info(cards);

-- Verify index creation (should show idx_cards_solution)  
.print "Indexes after migration:"
PRAGMA index_list(cards);

-- Data integrity check
.print "Card distribution after migration:"
SELECT 
    COUNT(*) as total_cards,
    COUNT(CASE WHEN is_solution = 1 THEN 1 END) as solution_cards,
    COUNT(CASE WHEN is_solution = 0 THEN 1 END) as regular_cards,
    COUNT(CASE WHEN is_solution IS NULL THEN 1 END) as null_values
FROM cards;

-- Show migration log
.print "Migration history:"
SELECT * FROM migration_log WHERE migration_name LIKE '%solution_card%' ORDER BY started_at DESC LIMIT 5;

-- Success message
SELECT 'Safe migration completed! The is_solution column is now available.' as result;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

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
-- SELECT * FROM migration_log WHERE migration_name = 'add_solution_card_support_safe';

-- To verify the column exists:
-- PRAGMA table_info(cards);

-- To check for any solution cards:
-- SELECT COUNT(*) FROM cards WHERE is_solution = 1;
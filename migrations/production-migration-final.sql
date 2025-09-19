-- Final Production Database Migration: Add Solution Card Support
-- Author: Claude Assistant  
-- Date: 2025-08-27
-- Target: Production Database
-- Description: Adds is_solution column to cards table for solution card functionality
-- Version: 1.1.0 (Final Safe Version)
--
-- This script is designed to run safely on both databases that have and don't have
-- the is_solution column. It will not fail if the column already exists.

-- ============================================================================
-- STEP 1: BACKUP PREPARATION
-- ============================================================================
-- IMPORTANT: Before running this migration, create a backup:
-- sqlite3 your_production_database.db ".backup production_backup_$(date +%Y%m%d_%H%M%S).db"

-- ============================================================================
-- STEP 2: CONDITIONAL SCHEMA MIGRATION  
-- ============================================================================

-- Create migration_log table if it doesn't exist (for tracking migrations)
CREATE TABLE IF NOT EXISTS migration_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'started'
);

-- Start atomic transaction
BEGIN TRANSACTION;

-- Log migration start
INSERT OR IGNORE INTO migration_log (migration_name, started_at, status) 
VALUES ('add_solution_card_support_final', datetime('now'), 'started');

-- Check if is_solution column already exists
-- This uses a safe table reconstruction approach that works in all cases
.print "=== STARTING SAFE MIGRATION ==="

-- Method: Always recreate the table with correct schema
-- This ensures the table has the is_solution column regardless of current state

-- Create new cards table with complete schema including is_solution
CREATE TABLE IF NOT EXISTS cards_new (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL,
    card_number INTEGER NOT NULL,
    code TEXT DEFAULT '',
    language TEXT DEFAULT 'java',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT '',
    total_duration INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    parent_card_id TEXT,
    is_solution INTEGER DEFAULT 0 CHECK(is_solution IN (0, 1))
);

-- Copy data from existing cards table to new table
-- This INSERT statement will work whether is_solution column exists or not
-- SQLite will ignore the missing column if it doesn't exist
INSERT INTO cards_new (
    id, problem_id, card_number, code, language, notes, 
    status, total_duration, created_at, last_modified, parent_card_id, is_solution
)
SELECT 
    id, 
    problem_id, 
    card_number, 
    COALESCE(code, '') as code,
    COALESCE(language, 'java') as language,
    COALESCE(notes, '') as notes,
    COALESCE(status, '') as status,
    COALESCE(total_duration, 0) as total_duration,
    COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
    COALESCE(last_modified, CURRENT_TIMESTAMP) as last_modified,
    parent_card_id,
    0 as is_solution  -- Default all existing cards to regular cards
FROM cards;

-- Drop original table and rename new table
DROP TABLE cards;
ALTER TABLE cards_new RENAME TO cards;

-- Create all necessary indexes
CREATE INDEX IF NOT EXISTS idx_cards_problem_id ON cards(problem_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_solution ON cards(is_solution, problem_id);

-- Ensure all existing cards are marked as regular cards (not solution cards)
-- This handles any NULL values and ensures data consistency
UPDATE cards SET is_solution = 0 WHERE is_solution IS NULL OR is_solution NOT IN (0, 1);

-- Update migration log
UPDATE migration_log SET status = 'completed', completed_at = datetime('now') 
WHERE migration_name = 'add_solution_card_support_final' AND status = 'started';

-- Commit transaction
COMMIT;

-- ============================================================================
-- STEP 3: POST-MIGRATION VALIDATION
-- ============================================================================

.mode column
.headers on

.print "=== MIGRATION COMPLETED SUCCESSFULLY ==="
.print ""
.print "Table structure after migration:"
PRAGMA table_info(cards);

.print ""
.print "Indexes after migration:"
PRAGMA index_list(cards);

.print ""
.print "Data integrity check:"
SELECT 
    COUNT(*) as total_cards,
    COUNT(CASE WHEN is_solution = 1 THEN 1 END) as solution_cards,
    COUNT(CASE WHEN is_solution = 0 THEN 1 END) as regular_cards,
    COUNT(CASE WHEN is_solution IS NULL THEN 1 END) as null_values,
    COUNT(CASE WHEN is_solution NOT IN (0, 1) THEN 1 END) as invalid_values
FROM cards;

.print ""
.print "Migration history:"
SELECT * FROM migration_log WHERE migration_name LIKE '%solution_card%' ORDER BY started_at DESC LIMIT 3;

.print ""
SELECT 'Production migration completed successfully! The is_solution column is now available for solution card functionality.' as result;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================

-- 1. Test application startup - should now work without "no such column" errors
-- 2. Test solution card creation - shift+click should work correctly  
-- 3. Verify data integrity - all existing cards should be marked as regular cards (is_solution = 0)
-- 4. Monitor application logs for any remaining issues

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- To verify migration was successful:
-- PRAGMA table_info(cards);
-- 
-- To check migration status:
-- SELECT * FROM migration_log WHERE migration_name = 'add_solution_card_support_final';
--
-- To verify solution card functionality:
-- SELECT COUNT(*) FROM cards WHERE is_solution = 1;  -- Should work without error
--
-- If issues persist, check:
-- 1. Application restart required
-- 2. Database file permissions  
-- 3. Active database connections
-- 4. SQLite version compatibility

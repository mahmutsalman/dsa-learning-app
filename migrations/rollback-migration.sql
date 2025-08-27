-- Production Database Rollback Script
-- Author: Claude Assistant  
-- Date: 2025-08-27
-- Purpose: Emergency rollback for is_solution column migration
-- Version: 1.1.0
--
-- WARNING: This script will remove the is_solution column and all solution cards!
-- Only use this if the migration caused critical issues and immediate rollback is required.
-- 
-- IMPORTANT: Create a backup before running this rollback script!

-- ============================================================================
-- BACKUP REMINDER
-- ============================================================================
-- Before running this rollback, create a backup:
-- sqlite3 your_production_database.db ".backup rollback_backup_$(date +%Y%m%d_%H%M%S).db"

-- ============================================================================
-- PRE-ROLLBACK VERIFICATION
-- ============================================================================

-- Verify current state before rollback
SELECT 'PRE-ROLLBACK STATE VERIFICATION' as status;

-- Check current table structure
PRAGMA table_info(cards);

-- Check solution cards count (will be lost)
SELECT 
    COUNT(*) as total_cards,
    COUNT(CASE WHEN is_solution = 1 THEN 1 END) as solution_cards_to_lose
FROM cards;

-- List solution cards that will be permanently deleted
SELECT 
    id,
    problem_id, 
    card_number,
    LENGTH(code) as code_length,
    LENGTH(notes) as notes_length,
    created_at
FROM cards 
WHERE is_solution = 1
ORDER BY created_at DESC;

-- ============================================================================
-- ROLLBACK OPTIONS
-- ============================================================================

-- OPTION 1: SOFT ROLLBACK (Recommended)
-- This preserves solution cards but removes the column constraint
-- Solution cards will become regular cards

.print "=== OPTION 1: SOFT ROLLBACK ==="
.print "This will:"
.print "1. Remove the is_solution index"  
.print "2. Convert all solution cards to regular cards"
.print "3. Remove the is_solution column"
.print "4. Preserve all card data"
.print ""

-- Uncomment to execute Option 1:
/*
BEGIN TRANSACTION;

-- Log rollback start
INSERT OR IGNORE INTO migration_log (migration_name, started_at, status) 
VALUES ('rollback_solution_card_support', datetime('now'), 'started');

-- Remove index first
DROP INDEX IF EXISTS idx_cards_solution;

-- Convert all solution cards to regular cards (preserves data)
UPDATE cards SET is_solution = 0 WHERE is_solution = 1;

-- Method 1: Direct column drop (SQLite 3.35.0+)
-- ALTER TABLE cards DROP COLUMN is_solution;

-- Method 2: Table rebuild (for older SQLite versions)
-- Create temporary table without is_solution column
CREATE TABLE cards_rollback AS 
SELECT 
    id, problem_id, card_number, code, language, notes,
    status, total_duration, created_at, last_modified, parent_card_id
FROM cards;

-- Drop original table
DROP TABLE cards;

-- Rename temporary table
ALTER TABLE cards_rollback RENAME TO cards;

-- Recreate original indexes (excluding solution index)
CREATE INDEX IF NOT EXISTS idx_cards_problem_id ON cards(problem_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at);

-- Update migration log
UPDATE migration_log SET status = 'completed', completed_at = datetime('now') 
WHERE migration_name = 'rollback_solution_card_support' AND status = 'started';

COMMIT;
*/

-- ============================================================================

-- OPTION 2: HARD ROLLBACK (Data Loss Warning!)
-- This removes all solution cards permanently

.print "=== OPTION 2: HARD ROLLBACK (DESTRUCTIVE) ==="
.print "WARNING: This will PERMANENTLY DELETE all solution cards!"
.print "This will:"
.print "1. Delete all solution cards (is_solution = 1)" 
.print "2. Remove the is_solution index"
.print "3. Remove the is_solution column"
.print "4. Regular cards will be preserved"
.print ""

-- Uncomment to execute Option 2 (DANGEROUS):
/*
BEGIN TRANSACTION;

-- Log rollback start  
INSERT OR IGNORE INTO migration_log (migration_name, started_at, status) 
VALUES ('hard_rollback_solution_card_support', datetime('now'), 'started');

-- DELETE ALL SOLUTION CARDS (WARNING: PERMANENT DATA LOSS)
DELETE FROM cards WHERE is_solution = 1;

-- Remove index
DROP INDEX IF EXISTS idx_cards_solution;

-- Rebuild table without is_solution column
CREATE TABLE cards_rollback AS 
SELECT 
    id, problem_id, card_number, code, language, notes,
    status, total_duration, created_at, last_modified, parent_card_id
FROM cards;

DROP TABLE cards;
ALTER TABLE cards_rollback RENAME TO cards;

-- Recreate original indexes
CREATE INDEX IF NOT EXISTS idx_cards_problem_id ON cards(problem_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status); 
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at);

-- Update migration log
UPDATE migration_log SET status = 'completed', completed_at = datetime('now') 
WHERE migration_name = 'hard_rollback_solution_card_support' AND status = 'started';

COMMIT;
*/

-- ============================================================================
-- POST-ROLLBACK VERIFICATION
-- ============================================================================

-- After executing either rollback option, run these verification queries:

-- Check table structure (is_solution should be gone)
-- PRAGMA table_info(cards);

-- Verify index removal
-- PRAGMA index_list(cards);

-- Check data integrity
-- SELECT COUNT(*) as remaining_cards FROM cards;

-- Verify no solution-related columns remain
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='cards';

-- ============================================================================
-- RESTORATION PROCEDURE
-- ============================================================================

-- If you need to restore from backup after rollback:
-- 1. Stop the application
-- 2. Replace production database with backup:
--    cp database_backup_YYYYMMDD_HHMMSS.db production_database.db
-- 3. Restart application
-- 4. Verify functionality

-- ============================================================================
-- MANUAL VERIFICATION COMMANDS
-- ============================================================================

.print "=== MANUAL VERIFICATION ==="
.print "After rollback, manually verify:"
.print "1. Application starts without errors"
.print "2. Card creation works normally"  
.print "3. No solution card references in logs"
.print "4. Database integrity: PRAGMA integrity_check;"
.print "5. Backup rollback if issues persist"

-- Final verification
SELECT 'Rollback script prepared. Uncomment chosen option and execute.' as instruction;
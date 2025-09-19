-- Production Database Verification Script
-- Author: Claude Assistant
-- Date: 2025-08-27
-- Purpose: Verify successful migration of is_solution column to production database
--
-- Run this script after applying the production migration to ensure
-- the database schema matches development and the solution card feature works.

-- ============================================================================
-- SCHEMA VERIFICATION
-- ============================================================================

.echo on
.headers on
.mode column

-- Check SQLite version
SELECT sqlite_version() as sqlite_version;

-- ============================================================================
-- TABLE STRUCTURE VERIFICATION  
-- ============================================================================

-- Verify cards table structure (should include is_solution column)
.print "=== CARDS TABLE STRUCTURE ==="
PRAGMA table_info(cards);

-- Expected output should include:
-- 11|is_solution|INTEGER|0|0|0

-- ============================================================================
-- INDEX VERIFICATION
-- ============================================================================

-- Verify all indexes on cards table
.print "\n=== CARDS TABLE INDEXES ==="
PRAGMA index_list(cards);

-- Verify idx_cards_solution index details
.print "\n=== SOLUTION CARD INDEX DETAILS ==="
PRAGMA index_info(idx_cards_solution);

-- Expected: Index should exist with columns is_solution and problem_id

-- ============================================================================
-- DATA INTEGRITY VERIFICATION
-- ============================================================================

-- Check current card distribution
.print "\n=== CARD TYPE DISTRIBUTION ==="
SELECT 
    COUNT(*) as total_cards,
    COUNT(CASE WHEN is_solution = 1 THEN 1 END) as solution_cards,
    COUNT(CASE WHEN is_solution = 0 THEN 1 END) as regular_cards,
    COUNT(CASE WHEN is_solution IS NULL THEN 1 END) as null_values
FROM cards;

-- Verify no NULL values exist in is_solution column
.print "\n=== NULL VALUE CHECK ==="
SELECT COUNT(*) as null_count FROM cards WHERE is_solution IS NULL;
-- Expected: 0

-- Check constraint enforcement
.print "\n=== CONSTRAINT VERIFICATION ==="
-- This should show the CHECK constraint exists
SELECT sql FROM sqlite_master WHERE type='table' AND name='cards';

-- ============================================================================
-- FUNCTIONAL TESTING
-- ============================================================================

-- Test solution card creation (should work without errors)
.print "\n=== TESTING SOLUTION CARD CREATION ==="
BEGIN TRANSACTION;

-- Create test solution card
INSERT INTO cards (
    id, problem_id, card_number, code, language, notes, 
    status, is_solution, created_at, last_modified
) VALUES (
    'test_solution_' || datetime('now'),
    'test_problem_' || datetime('now'), 
    999,
    '// Test solution code\nclass Solution {\n    boolean solve() { return true; }\n}',
    'java',
    'Test solution notes',
    'Completed',
    1,  -- This is a solution card
    datetime('now'),
    datetime('now')
);

-- Verify solution card was created
SELECT COUNT(*) as created_solution_cards FROM cards WHERE is_solution = 1;

-- Test constraint violation (should fail and be caught)
.print "\n=== TESTING CONSTRAINT VIOLATION ==="
-- This should fail due to CHECK constraint
INSERT OR IGNORE INTO cards (
    id, problem_id, card_number, is_solution
) VALUES (
    'invalid_test',
    'test_problem',
    998,
    2  -- Invalid value, should be 0 or 1 only
);

-- Check if invalid insert was rejected
SELECT COUNT(*) as invalid_cards FROM cards WHERE is_solution NOT IN (0, 1);
-- Expected: 0

-- Cleanup test data
DELETE FROM cards WHERE id LIKE 'test_solution_%' OR id = 'invalid_test';

ROLLBACK;  -- Rollback test transaction

-- ============================================================================
-- QUERY PERFORMANCE TESTING
-- ============================================================================

-- Test index usage for solution card queries
.print "\n=== INDEX USAGE VERIFICATION ==="
EXPLAIN QUERY PLAN SELECT * FROM cards WHERE is_solution = 1;

-- Test compound index usage
EXPLAIN QUERY PLAN SELECT * FROM cards WHERE problem_id = 'some_problem' AND is_solution = 0;

-- ============================================================================
-- MIGRATION LOG VERIFICATION
-- ============================================================================

-- Check if migration was logged (if migration_log table exists)
.print "\n=== MIGRATION LOG CHECK ==="
SELECT name FROM sqlite_master WHERE type='table' AND name='migration_log';

-- If migration_log exists, show migration status
SELECT * FROM migration_log WHERE migration_name = 'add_solution_card_support' 
ORDER BY started_at DESC LIMIT 1;

-- ============================================================================
-- COMPARISON WITH DEVELOPMENT DATABASE
-- ============================================================================

-- Generate schema comparison data
.print "\n=== SCHEMA COMPARISON DATA ==="
SELECT 
    'cards' as table_name,
    COUNT(*) as column_count
FROM pragma_table_info('cards');

-- List all columns for manual comparison
SELECT 
    cid,
    name,
    type,
    "notnull",
    dflt_value
FROM pragma_table_info('cards')
ORDER BY cid;

-- ============================================================================
-- SUCCESS CRITERIA CHECKLIST
-- ============================================================================

.print "\n=== SUCCESS CRITERIA CHECKLIST ==="
.print "✓ Verify the following conditions are met:"
.print ""

-- 1. is_solution column exists
SELECT 
    CASE 
        WHEN EXISTS(SELECT 1 FROM pragma_table_info('cards') WHERE name = 'is_solution')
        THEN '✓ is_solution column exists'
        ELSE '✗ is_solution column missing'
    END as check_1;

-- 2. Index exists
SELECT 
    CASE 
        WHEN EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_cards_solution')
        THEN '✓ idx_cards_solution index exists' 
        ELSE '✗ idx_cards_solution index missing'
    END as check_2;

-- 3. No NULL values
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM cards WHERE is_solution IS NULL) = 0
        THEN '✓ No NULL values in is_solution column'
        ELSE '✗ Found NULL values in is_solution column'  
    END as check_3;

-- 4. Constraint working
SELECT 
    CASE
        WHEN (SELECT sql FROM sqlite_master WHERE type='table' AND name='cards') LIKE '%CHECK%is_solution%'
        THEN '✓ CHECK constraint exists'
        ELSE '✗ CHECK constraint missing'
    END as check_4;

.print "\n=== VERIFICATION COMPLETE ==="
.print "If all checks show ✓, the migration was successful!"
.print "If any checks show ✗, review the migration and fix issues."

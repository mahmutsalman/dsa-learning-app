-- Migration script to fix updated_at field for created vs updated problems
-- This will set updated_at to NULL for problems where created_at = updated_at
-- This allows proper differentiation between newly created vs actually updated problems

-- First, let's check what we're working with
SELECT 'Problems with same created_at and updated_at:' as info, COUNT(*) as count 
FROM problems 
WHERE created_at = updated_at;

SELECT 'Total problems:' as info, COUNT(*) as count FROM problems;

-- Show sample data before migration
SELECT 'Sample problems before migration:' as info;
SELECT id, title, created_at, updated_at, 
       CASE WHEN created_at = updated_at THEN 'SAME' ELSE 'DIFFERENT' END as status
FROM problems 
ORDER BY created_at DESC 
LIMIT 5;

-- Fix the data: Set updated_at to NULL where it equals created_at
-- This indicates the problem was never actually updated after creation
UPDATE problems 
SET updated_at = NULL 
WHERE created_at = updated_at;

-- Show results after migration
SELECT 'Problems updated (set updated_at to NULL):' as info, changes() as count;

SELECT 'Sample problems after migration:' as info;
SELECT id, title, created_at, updated_at,
       CASE 
         WHEN updated_at IS NULL THEN 'NEVER_UPDATED'
         WHEN created_at != updated_at THEN 'ACTUALLY_UPDATED' 
         ELSE 'ERROR'
       END as status
FROM problems 
ORDER BY created_at DESC 
LIMIT 10;

-- Summary statistics
SELECT 'Final statistics:' as info;
SELECT 
  COUNT(*) as total_problems,
  SUM(CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END) as never_updated,
  SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) as actually_updated
FROM problems;
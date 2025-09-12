-- Migration script to populate work_sessions table from existing time_sessions
-- This will migrate all historical session data to the new analytics table

-- First, let's check what we're working with
SELECT 'Existing time_sessions count:' as info, COUNT(*) as count FROM time_sessions;
SELECT 'Existing work_sessions count:' as info, COUNT(*) as count FROM work_sessions;

-- Insert all historical time_sessions data into work_sessions
INSERT OR IGNORE INTO work_sessions (
    id,
    problem_id,
    card_id,
    session_date,
    start_timestamp,
    end_timestamp,
    duration_seconds,
    hour_slot,
    created_at
)
SELECT 
    'migrated_' || ts.id as id,  -- Prefix to avoid conflicts with new sessions
    c.problem_id,
    ts.card_id,
    ts.date as session_date,
    ts.start_time as start_timestamp,
    ts.end_time as end_timestamp,
    COALESCE(ts.duration, 0) as duration_seconds,
    CAST(strftime('%H', ts.start_time) AS INTEGER) as hour_slot,
    COALESCE(ts.start_time, CURRENT_TIMESTAMP) as created_at
FROM time_sessions ts
JOIN cards c ON ts.card_id = c.id
WHERE ts.end_time IS NOT NULL  -- Only migrate completed sessions
    AND ts.duration IS NOT NULL 
    AND ts.duration > 0;  -- Only sessions with actual duration

-- Show results
SELECT 'Final work_sessions count:' as info, COUNT(*) as count FROM work_sessions;

-- Show some sample data to verify the migration
SELECT 'Sample migrated sessions:' as info;
SELECT 
    session_date,
    COUNT(*) as sessions,
    SUM(duration_seconds) as total_duration_seconds,
    COUNT(DISTINCT problem_id) as unique_problems
FROM work_sessions 
GROUP BY session_date 
ORDER BY session_date DESC 
LIMIT 10;
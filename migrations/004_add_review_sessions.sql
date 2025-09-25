-- Migration 004: Add Review Sessions Support
-- Author: Claude Assistant
-- Date: 2025-09-25
-- Description: Adds review_sessions table and review_duration column to cards for tracking review/restudy sessions
-- Version: 1.0.0

-- ============================================================================
-- STEP 1: BACKUP PREPARATION
-- ============================================================================
-- IMPORTANT: Before running this migration, create a backup:
-- sqlite3 your_database.db ".backup review_sessions_backup_$(date +%Y%m%d_%H%M%S).db"

-- ============================================================================
-- STEP 2: CREATE REVIEW SESSIONS TABLE
-- ============================================================================

BEGIN TRANSACTION;

-- Log migration start
INSERT OR IGNORE INTO migration_log (migration_name, started_at, status)
VALUES ('add_review_sessions_support', datetime('now'), 'started');

-- Create review_sessions table (parallel to time_sessions)
CREATE TABLE IF NOT EXISTS review_sessions (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    start_time TEXT NOT NULL,  -- ISO 8601 timestamp
    end_time TEXT,             -- ISO 8601 timestamp, NULL if active
    duration INTEGER,          -- in seconds, NULL if active
    date TEXT NOT NULL,        -- YYYY-MM-DD format
    is_active INTEGER DEFAULT 0 CHECK(is_active IN (0, 1)),
    notes TEXT,
    original_session_id TEXT,  -- Reference to original study session for context
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- ============================================================================
-- STEP 3: ADD REVIEW DURATION TO CARDS
-- ============================================================================

-- Add review_duration column to cards table if it doesn't exist
-- We'll use the safe table reconstruction approach
CREATE TABLE IF NOT EXISTS cards_with_review (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL,
    card_number INTEGER NOT NULL,
    code TEXT DEFAULT '',
    language TEXT DEFAULT 'java',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT '',
    total_duration INTEGER DEFAULT 0,
    review_duration INTEGER DEFAULT 0,  -- New column for review time tracking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    parent_card_id TEXT,
    is_solution INTEGER DEFAULT 0 CHECK(is_solution IN (0, 1)),
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- Copy existing data to new table
INSERT INTO cards_with_review (
    id, problem_id, card_number, code, language, notes,
    status, total_duration, review_duration, created_at, last_modified,
    parent_card_id, is_solution
)
SELECT
    id, problem_id, card_number,
    COALESCE(code, '') as code,
    COALESCE(language, 'java') as language,
    COALESCE(notes, '') as notes,
    COALESCE(status, '') as status,
    COALESCE(total_duration, 0) as total_duration,
    0 as review_duration,  -- Default all existing cards to 0 review duration
    COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
    COALESCE(last_modified, CURRENT_TIMESTAMP) as last_modified,
    parent_card_id,
    COALESCE(is_solution, 0) as is_solution
FROM cards;

-- Replace original table
DROP TABLE cards;
ALTER TABLE cards_with_review RENAME TO cards;

-- ============================================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for review_sessions table
CREATE INDEX IF NOT EXISTS idx_review_sessions_card_id ON review_sessions(card_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_date ON review_sessions(date);
CREATE INDEX IF NOT EXISTS idx_review_sessions_active ON review_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_review_sessions_created_at ON review_sessions(created_at);

-- Recreate existing indexes for cards table
CREATE INDEX IF NOT EXISTS idx_cards_problem_id ON cards(problem_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_solution ON cards(is_solution, problem_id);
CREATE INDEX IF NOT EXISTS idx_cards_review_duration ON cards(review_duration);

-- ============================================================================
-- STEP 5: CREATE REVIEW WORK SESSIONS TABLE
-- ============================================================================

-- Create review_work_sessions table (parallel to work_sessions for analytics)
CREATE TABLE IF NOT EXISTS review_work_sessions (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    session_date TEXT NOT NULL, -- YYYY-MM-DD format
    start_timestamp TEXT NOT NULL, -- ISO 8601 timestamp
    end_timestamp TEXT, -- ISO 8601 timestamp
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    hour_slot INTEGER NOT NULL, -- 0-23 hour of the day
    created_at TEXT DEFAULT (datetime('now')),
    original_work_session_id TEXT, -- Reference to original work session
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Indexes for review_work_sessions
CREATE INDEX IF NOT EXISTS idx_review_work_sessions_date ON review_work_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_review_work_sessions_problem ON review_work_sessions(problem_id);
CREATE INDEX IF NOT EXISTS idx_review_work_sessions_card ON review_work_sessions(card_id);
CREATE INDEX IF NOT EXISTS idx_review_work_sessions_hour ON review_work_sessions(hour_slot);

-- Update migration log
UPDATE migration_log SET status = 'completed', completed_at = datetime('now')
WHERE migration_name = 'add_review_sessions_support' AND status = 'started';

COMMIT;

-- ============================================================================
-- STEP 6: POST-MIGRATION VALIDATION
-- ============================================================================

.mode column
.headers on

.print "=== REVIEW SESSIONS MIGRATION COMPLETED ==="
.print ""
.print "Cards table structure after migration:"
PRAGMA table_info(cards);

.print ""
.print "Review sessions table structure:"
PRAGMA table_info(review_sessions);

.print ""
.print "Review work sessions table structure:"
PRAGMA table_info(review_work_sessions);

.print ""
.print "Data integrity check:"
SELECT
    COUNT(*) as total_cards,
    AVG(COALESCE(total_duration, 0)) as avg_study_duration,
    AVG(COALESCE(review_duration, 0)) as avg_review_duration,
    COUNT(CASE WHEN review_duration > 0 THEN 1 END) as cards_with_review_time
FROM cards;

.print ""
.print "Migration history:"
SELECT * FROM migration_log WHERE migration_name = 'add_review_sessions_support';

.print ""
SELECT 'Review sessions migration completed successfully! Review tracking is now available.' as result;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- To start tracking review sessions:
-- INSERT INTO review_sessions (id, card_id, start_time, date, is_active)
-- VALUES ('review_' || hex(randomblob(16)), 'card_id_here', datetime('now'), date('now'), 1);

-- To update card review_duration after review session:
-- UPDATE cards SET review_duration = review_duration + session_duration WHERE id = 'card_id';

-- To query combined study + review time:
-- SELECT id, total_duration + review_duration as combined_duration FROM cards;
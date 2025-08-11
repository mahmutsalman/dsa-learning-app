// Database schema SQL from the design document

pub const CREATE_TABLES_SQL: &str = r#"
-- Problems table
CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    difficulty TEXT CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
    topic TEXT,
    leetcode_url TEXT,
    constraints TEXT,
    examples TEXT, -- JSON string
    hints TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cards table (problem attempts)
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL,
    card_number INTEGER NOT NULL,
    code TEXT,
    language TEXT DEFAULT 'javascript',
    notes TEXT,
    status TEXT CHECK(status IN ('In Progress', 'Completed', 'Paused')),
    total_duration INTEGER DEFAULT 0, -- in seconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    parent_card_id TEXT,
    FOREIGN KEY (problem_id) REFERENCES problems(id),
    FOREIGN KEY (parent_card_id) REFERENCES cards(id)
);

-- Time sessions table
CREATE TABLE IF NOT EXISTS time_sessions (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INTEGER, -- in seconds
    date DATE,
    is_active INTEGER DEFAULT 0, -- SQLite uses 0/1 for boolean
    notes TEXT,
    FOREIGN KEY (card_id) REFERENCES cards(id)
);

-- Recordings table
CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    time_session_id TEXT,
    audio_url TEXT NOT NULL,
    duration INTEGER,
    transcript TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_size INTEGER,
    FOREIGN KEY (card_id) REFERENCES cards(id),
    FOREIGN KEY (time_session_id) REFERENCES time_sessions(id)
);

-- Connections table
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    source_card_id TEXT NOT NULL,
    target_card_id TEXT NOT NULL,
    connection_type TEXT CHECK(connection_type IN ('related', 'prerequisite', 'similar', 'builds-upon')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_card_id) REFERENCES cards(id),
    FOREIGN KEY (target_card_id) REFERENCES cards(id)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT,
    category TEXT CHECK(category IN ('algorithm', 'data-structure', 'pattern', 'custom'))
);

-- Junction tables
CREATE TABLE IF NOT EXISTS problem_tags (
    problem_id TEXT,
    tag_id TEXT,
    PRIMARY KEY (problem_id, tag_id),
    FOREIGN KEY (problem_id) REFERENCES problems(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS card_tags (
    card_id TEXT,
    tag_id TEXT,
    PRIMARY KEY (card_id, tag_id),
    FOREIGN KEY (card_id) REFERENCES cards(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- Problem images table
CREATE TABLE IF NOT EXISTS problem_images (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL,
    image_path TEXT NOT NULL, -- Relative path like 'images/problem_123/uuid.png'
    caption TEXT,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);
"#;

pub const CREATE_INDEXES_SQL: &str = r#"
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_problem_id ON cards(problem_id);
CREATE INDEX IF NOT EXISTS idx_time_sessions_card_id ON time_sessions(card_id);
CREATE INDEX IF NOT EXISTS idx_time_sessions_date ON time_sessions(date);
CREATE INDEX IF NOT EXISTS idx_recordings_card_id ON recordings(card_id);
CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_card_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_card_id);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at);
CREATE INDEX IF NOT EXISTS idx_problem_images_problem_id ON problem_images(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_images_position ON problem_images(position);
"#;
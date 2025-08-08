mod schema;

use rusqlite::{Connection, params};
use anyhow::Context;
use chrono::Utc;
use uuid::Uuid;
use crate::models::*;

pub struct DatabaseManager {
    connection: Connection,
}

impl DatabaseManager {
    pub async fn new() -> anyhow::Result<Self> {
        // Create database directory in user data directory
        let app_data_dir = std::env::current_dir()
            .context("Failed to get current directory")?
            .join("data");
        
        std::fs::create_dir_all(&app_data_dir)
            .context("Failed to create app data directory")?;
        
        let db_path = app_data_dir.join("database.db");
        
        let connection = Connection::open(&db_path)
            .context("Failed to open database connection")?;
        
        // Enable foreign keys and WAL mode (using query_row to handle potential return values)
        let _: i32 = connection.query_row("PRAGMA foreign_keys = ON", [], |row| row.get(0)).unwrap_or(0);
        let _: String = connection.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0)).unwrap_or_else(|_| "delete".to_string());
        
        let mut db_manager = Self { connection };
        
        // Initialize database schema
        db_manager.init_schema()
            .await
            .context("Failed to initialize database schema")?;
        
        Ok(db_manager)
    }
    
    pub async fn connect_existing() -> anyhow::Result<Self> {
        // Connect to existing database without initializing schema
        let app_data_dir = std::env::current_dir()
            .context("Failed to get current directory")?
            .join("data");
        
        let db_path = app_data_dir.join("database.db");
        
        // Check if database file exists
        if !db_path.exists() {
            return Err(anyhow::anyhow!("Database file does not exist. Run initialization first."));
        }
        
        let connection = Connection::open(&db_path)
            .context("Failed to open database connection")?;
        
        // Enable foreign keys and WAL mode (using query_row to handle potential return values)
        let _: i32 = connection.query_row("PRAGMA foreign_keys = ON", [], |row| row.get(0)).unwrap_or(0);
        let _: String = connection.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0)).unwrap_or_else(|_| "delete".to_string());
        
        let db_manager = Self { connection };
        
        Ok(db_manager)
    }
    
    async fn init_schema(&mut self) -> anyhow::Result<()> {
        // Start with just the essential tables first
        
        println!("Creating problems table...");
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS problems (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                difficulty TEXT,
                category TEXT,
                leetcode_url TEXT,
                constraints TEXT,
                examples TEXT,
                hints TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        println!("Creating cards table...");
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                problem_id TEXT NOT NULL,
                card_number INTEGER NOT NULL,
                code TEXT,
                language TEXT DEFAULT 'javascript',
                notes TEXT,
                status TEXT DEFAULT 'In Progress',
                total_duration INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
                parent_card_id TEXT
            )",
            [],
        )?;

        println!("Creating basic indexes...");
        self.connection.execute("CREATE INDEX IF NOT EXISTS idx_cards_problem_id ON cards(problem_id)", [])?;
        self.connection.execute("CREATE INDEX IF NOT EXISTS idx_cards_parent_id ON cards(parent_card_id)", [])?;
        
        println!("Database schema initialized successfully!");
        Ok(())
    }

    // Problem operations
    pub fn create_problem(&mut self, req: CreateProblemRequest) -> anyhow::Result<Problem> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        let category_json = serde_json::to_string(&req.category)?;
        let constraints_json = serde_json::to_string(&req.constraints)?;
        let examples_json = serde_json::to_string(&req.examples)?;
        let hints_json = serde_json::to_string(&req.hints)?;
        let leetcode_url = req.leetcode_url.as_ref().map(|s| s.as_str()).unwrap_or("");
        
        self.connection.execute(
            "INSERT INTO problems (id, title, description, difficulty, category, leetcode_url, constraints, examples, hints, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                &id,
                &req.title,
                &req.description,
                &req.difficulty,
                &category_json,
                leetcode_url,
                &constraints_json,
                &examples_json,
                &hints_json,
                &now.to_rfc3339(),
            ],
        )?;
        
        Ok(Problem {
            id,
            title: req.title,
            description: req.description,
            difficulty: req.difficulty,
            category: category_json,
            leetcode_url: req.leetcode_url,
            constraints: constraints_json,
            examples: examples_json,
            hints: hints_json,
            created_at: now,
        })
    }
    
    pub fn get_problems(&self) -> anyhow::Result<Vec<Problem>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, title, description, difficulty, category, leetcode_url, constraints, examples, hints, created_at FROM problems ORDER BY created_at DESC"
        )?;
        
        let problem_iter = stmt.query_map([], |row| {
            Ok(Problem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                difficulty: row.get(3)?,
                category: row.get(4)?,
                leetcode_url: row.get(5)?,
                constraints: row.get(6)?,
                examples: row.get(7)?,
                hints: row.get(8)?,
                created_at: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
            })
        })?;
        
        let mut problems = Vec::new();
        for problem in problem_iter {
            problems.push(problem?);
        }
        
        Ok(problems)
    }
    
    pub fn get_problem_by_id(&self, id: &str) -> anyhow::Result<Option<Problem>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, title, description, difficulty, category, leetcode_url, constraints, examples, hints, created_at FROM problems WHERE id = ?1"
        )?;
        
        let mut problem_iter = stmt.query_map([id], |row| {
            Ok(Problem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                difficulty: row.get(3)?,
                category: row.get(4)?,
                leetcode_url: row.get(5)?,
                constraints: row.get(6)?,
                examples: row.get(7)?,
                hints: row.get(8)?,
                created_at: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
            })
        })?;
        
        match problem_iter.next() {
            Some(problem) => Ok(Some(problem?)),
            None => Ok(None),
        }
    }

    // Card operations
    pub fn create_card(&mut self, req: CreateCardRequest) -> anyhow::Result<Card> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        // Get next card number for this problem
        let card_number: i32 = self.connection.query_row(
            "SELECT COALESCE(MAX(card_number), 0) + 1 FROM cards WHERE problem_id = ?1",
            [&req.problem_id],
            |row| row.get(0),
        ).unwrap_or(1);
        
        let language = req.language.as_ref().map(|s| s.as_str()).unwrap_or("javascript");
        let parent_card_id = req.parent_card_id.as_ref().map(|s| s.as_str()).unwrap_or("");
        
        self.connection.execute(
            "INSERT INTO cards (id, problem_id, card_number, language, status, total_duration, created_at, last_modified, parent_card_id)
             VALUES (?1, ?2, ?3, ?4, 'In Progress', 0, ?5, ?6, ?7)",
            params![
                &id,
                &req.problem_id,
                card_number,
                language,
                &now.to_rfc3339(),
                &now.to_rfc3339(),
                parent_card_id,
            ],
        )?;
        
        Ok(Card {
            id,
            problem_id: req.problem_id,
            card_number,
            code: None,
            language: language.to_string(),
            notes: None,
            status: "In Progress".to_string(),
            total_duration: 0,
            created_at: now,
            last_modified: now,
            parent_card_id: req.parent_card_id,
        })
    }
    
    pub fn get_cards_for_problem(&self, problem_id: &str) -> anyhow::Result<Vec<Card>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, problem_id, card_number, code, language, notes, status, total_duration, created_at, last_modified, parent_card_id 
             FROM cards WHERE problem_id = ?1 ORDER BY card_number"
        )?;
        
        let card_iter = stmt.query_map([problem_id], |row| {
            Ok(Card {
                id: row.get(0)?,
                problem_id: row.get(1)?,
                card_number: row.get(2)?,
                code: row.get(3)?,
                language: row.get(4)?,
                notes: row.get(5)?,
                status: row.get(6)?,
                total_duration: row.get(7)?,
                created_at: row.get::<_, String>(8)?.parse().unwrap_or_else(|_| Utc::now()),
                last_modified: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
                parent_card_id: row.get(10)?,
            })
        })?;
        
        let mut cards = Vec::new();
        for card in card_iter {
            cards.push(card?);
        }
        
        Ok(cards)
    }
    
    pub fn get_card_by_id(&self, card_id: &str) -> anyhow::Result<Option<Card>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, problem_id, card_number, code, language, notes, status, total_duration, created_at, last_modified, parent_card_id 
             FROM cards WHERE id = ?1"
        )?;
        
        let card_iter = stmt.query_map([card_id], |row| {
            Ok(Card {
                id: row.get(0)?,
                problem_id: row.get(1)?,
                card_number: row.get(2)?,
                code: row.get(3)?,
                language: row.get(4)?,
                notes: row.get(5)?,
                status: row.get(6)?,
                total_duration: row.get(7)?,
                created_at: row.get::<_, String>(8)?.parse().unwrap_or_else(|_| Utc::now()),
                last_modified: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
                parent_card_id: row.get(10)?,
            })
        })?;
        
        let mut cards = Vec::new();
        for card in card_iter {
            cards.push(card?);
        }
        
        Ok(cards.into_iter().next())
    }
    
    pub fn update_card(&mut self, req: UpdateCardRequest) -> anyhow::Result<Option<Card>> {
        let now = Utc::now();
        let now_str = now.to_rfc3339();
        
        // Build query to update only provided fields
        if let Some(ref code) = req.code {
            self.connection.execute(
                "UPDATE cards SET code = ?1, last_modified = ?2 WHERE id = ?3",
                params![code, &now_str, &req.id],
            )?;
        }
        
        if let Some(ref notes) = req.notes {
            self.connection.execute(
                "UPDATE cards SET notes = ?1, last_modified = ?2 WHERE id = ?3",
                params![notes, &now_str, &req.id],
            )?;
        }
        
        if let Some(ref language) = req.language {
            self.connection.execute(
                "UPDATE cards SET language = ?1, last_modified = ?2 WHERE id = ?3",
                params![language, &now_str, &req.id],
            )?;
        }
        
        if let Some(ref status) = req.status {
            self.connection.execute(
                "UPDATE cards SET status = ?1, last_modified = ?2 WHERE id = ?3",
                params![status, &now_str, &req.id],
            )?;
        }
        
        // Return the updated card
        self.get_card_by_id(&req.id)
    }

    // Timer session operations (disabled until time_sessions table is added)
    #[allow(dead_code)]
    pub fn start_timer_session(&mut self, card_id: &str) -> anyhow::Result<TimeSession> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let date = now.format("%Y-%m-%d").to_string();
        
        self.connection.execute(
            "INSERT INTO time_sessions (id, card_id, start_time, date, is_active)
             VALUES (?1, ?2, ?3, ?4, 1)",
            params![&id, card_id, &now.to_rfc3339(), &date],
        )?;
        
        Ok(TimeSession {
            id,
            card_id: card_id.to_string(),
            start_time: now,
            end_time: None,
            duration: None,
            date,
            is_active: true,
            notes: None,
        })
    }
    
    #[allow(dead_code)]
    pub fn end_timer_session(&mut self, session_id: &str) -> anyhow::Result<()> {
        let now = Utc::now();
        
        // Get session start time
        let start_time: String = self.connection.query_row(
            "SELECT start_time FROM time_sessions WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )?;
        
        let start_time = start_time.parse::<chrono::DateTime<Utc>>()?;
        let duration = (now - start_time).num_seconds() as i32;
        
        // Update session
        self.connection.execute(
            "UPDATE time_sessions SET end_time = ?1, duration = ?2, is_active = 0 WHERE id = ?3",
            params![&now.to_rfc3339(), duration, session_id],
        )?;
        
        // Update card total duration
        let card_id: String = self.connection.query_row(
            "SELECT card_id FROM time_sessions WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )?;
        
        self.connection.execute(
            "UPDATE cards SET total_duration = total_duration + ?1 WHERE id = ?2",
            params![duration, &card_id],
        )?;
        
        Ok(())
    }

    // Recording operations (disabled until recordings table is added)
    #[allow(dead_code)]
    pub fn save_recording(&mut self, card_id: &str, filename: &str, filepath: &str, duration: Option<i32>) -> anyhow::Result<Recording> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        // Get file size
        let file_size = std::fs::metadata(filepath)
            .map(|m| m.len() as i64)
            .ok();
        
        self.connection.execute(
            "INSERT INTO recordings (id, card_id, audio_url, filename, filepath, duration, file_size, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &id,
                card_id,
                filepath, // audio_url same as filepath for now
                filename,
                filepath,
                duration,
                file_size,
                &now.to_rfc3339(),
            ],
        )?;
        
        Ok(Recording {
            id,
            card_id: card_id.to_string(),
            time_session_id: None,
            audio_url: filepath.to_string(),
            duration,
            transcript: None,
            created_at: now,
            filename: filename.to_string(),
            filepath: filepath.to_string(),
            file_size,
        })
    }
    
    #[allow(dead_code)]
    pub fn get_recordings(&self) -> anyhow::Result<Vec<Recording>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, card_id, time_session_id, audio_url, duration, transcript, created_at, filename, filepath, file_size 
             FROM recordings ORDER BY created_at DESC"
        )?;
        
        let recording_iter = stmt.query_map([], |row| {
            Ok(Recording {
                id: row.get(0)?,
                card_id: row.get(1)?,
                time_session_id: row.get(2)?,
                audio_url: row.get(3)?,
                duration: row.get(4)?,
                transcript: row.get(5)?,
                created_at: row.get::<_, String>(6)?.parse().unwrap_or_else(|_| Utc::now()),
                filename: row.get(7)?,
                filepath: row.get(8)?,
                file_size: row.get(9)?,
            })
        })?;
        
        let mut recordings = Vec::new();
        for recording in recording_iter {
            recordings.push(recording?);
        }
        
        Ok(recordings)
    }

    // Database analysis functions
    pub fn get_database_stats(&self) -> anyhow::Result<DatabaseStats> {
        // Count problems
        let problem_count: i32 = self.connection.query_row(
            "SELECT COUNT(*) FROM problems",
            [],
            |row| row.get(0),
        )?;

        // Count total cards
        let total_cards: i32 = self.connection.query_row(
            "SELECT COUNT(*) FROM cards",
            [],
            |row| row.get(0),
        )?;

        // Count main cards (parent_card_id IS NULL)
        let main_cards: i32 = self.connection.query_row(
            "SELECT COUNT(*) FROM cards WHERE parent_card_id IS NULL OR parent_card_id = ''",
            [],
            |row| row.get(0),
        )?;

        // Count child cards (parent_card_id IS NOT NULL)
        let child_cards: i32 = self.connection.query_row(
            "SELECT COUNT(*) FROM cards WHERE parent_card_id IS NOT NULL AND parent_card_id != ''",
            [],
            |row| row.get(0),
        )?;

        Ok(DatabaseStats {
            problem_count,
            total_cards,
            main_cards,
            child_cards,
        })
    }

    pub fn get_card_hierarchy(&self) -> anyhow::Result<Vec<CardHierarchy>> {
        let mut stmt = self.connection.prepare(
            "SELECT 
                c.id, c.problem_id, c.card_number, c.parent_card_id,
                p.title as problem_title,
                (SELECT COUNT(*) FROM cards WHERE parent_card_id = c.id) as child_count
             FROM cards c
             JOIN problems p ON c.problem_id = p.id
             ORDER BY p.title, c.card_number"
        )?;

        let hierarchy_iter = stmt.query_map([], |row| {
            Ok(CardHierarchy {
                card_id: row.get(0)?,
                problem_id: row.get(1)?,
                problem_title: row.get(4)?,
                card_number: row.get(2)?,
                parent_card_id: row.get(3)?,
                child_count: row.get(5)?,
            })
        })?;

        let mut hierarchies = Vec::new();
        for hierarchy in hierarchy_iter {
            hierarchies.push(hierarchy?);
        }

        Ok(hierarchies)
    }

    pub fn get_cards_per_problem(&self) -> anyhow::Result<Vec<CardCountPerProblem>> {
        let mut stmt = self.connection.prepare(
            "SELECT 
                p.id, p.title,
                COUNT(c.id) as total_cards,
                COUNT(CASE WHEN c.parent_card_id IS NULL OR c.parent_card_id = '' THEN 1 END) as main_cards,
                COUNT(CASE WHEN c.parent_card_id IS NOT NULL AND c.parent_card_id != '' THEN 1 END) as child_cards
             FROM problems p
             LEFT JOIN cards c ON p.id = c.problem_id
             GROUP BY p.id, p.title
             ORDER BY p.title"
        )?;

        let count_iter = stmt.query_map([], |row| {
            Ok(CardCountPerProblem {
                problem_id: row.get(0)?,
                problem_title: row.get(1)?,
                total_cards: row.get(2)?,
                main_cards: row.get(3)?,
                child_cards: row.get(4)?,
            })
        })?;

        let mut counts = Vec::new();
        for count in count_iter {
            counts.push(count?);
        }

        Ok(counts)
    }
}
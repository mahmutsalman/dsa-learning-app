mod schema;

use rusqlite::{Connection, params};
use std::path::PathBuf;
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
        
        // Enable foreign keys and WAL mode
        connection.execute("PRAGMA foreign_keys = ON;", [])?;
        connection.execute("PRAGMA journal_mode = WAL;", [])?;
        
        let mut db_manager = Self { connection };
        
        // Initialize database schema
        db_manager.init_schema()
            .await
            .context("Failed to initialize database schema")?;
        
        Ok(db_manager)
    }
    
    async fn init_schema(&mut self) -> anyhow::Result<()> {
        // Execute schema creation SQL
        self.connection.execute_batch(schema::CREATE_TABLES_SQL)?;
        self.connection.execute_batch(schema::CREATE_INDEXES_SQL)?;
        
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
    
    pub fn update_card(&mut self, req: UpdateCardRequest) -> anyhow::Result<()> {
        let now = Utc::now();
        
        // Simple update - in a real implementation you'd build dynamic queries
        if let Some(code) = &req.code {
            self.connection.execute(
                "UPDATE cards SET code = ?1, last_modified = ?2 WHERE id = ?3",
                params![code, &now.to_rfc3339(), &req.id],
            )?;
        }
        
        Ok(())
    }

    // Timer session operations
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

    // Recording operations
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
}
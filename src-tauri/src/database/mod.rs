mod schema;

use rusqlite::{Connection, params, OptionalExtension};
use anyhow::Context;
use chrono::Utc;
use uuid::Uuid;
use crate::models::*;
use schema::{CREATE_TABLES_SQL, CREATE_INDEXES_SQL};

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
        println!("🔧 [Database] Attempting to connect to existing database...");
        
        let app_data_dir = std::env::current_dir()
            .context("Failed to get current directory")?
            .join("data");
        
        let db_path = app_data_dir.join("database.db");
        
        println!("🔧 [Database] Database path: {:?}", db_path);
        
        // Check if database file exists
        if !db_path.exists() {
            return Err(anyhow::anyhow!("Database file does not exist. Run initialization first."));
        }
        
        let connection = Connection::open(&db_path)
            .context("Failed to open database connection")?;
        
        // Enable foreign keys and WAL mode (using query_row to handle potential return values)
        let _: i32 = connection.query_row("PRAGMA foreign_keys = ON", [], |row| row.get(0)).unwrap_or(0);
        let _: String = connection.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0)).unwrap_or_else(|_| "delete".to_string());
        
        let mut db_manager = Self { connection };
        
        // CRITICAL: Always check and run migration for existing databases
        println!("🔧 [Database] Checking if migration is needed...");
        db_manager.init_schema()
            .await
            .context("Failed to initialize/migrate database schema")?;
        
        println!("🔧 [Database] Connected to existing database with schema validation complete");
        Ok(db_manager)
    }
    
    async fn init_schema(&mut self) -> anyhow::Result<()> {
        println!("🔧 [Database] Initializing comprehensive database schema...");
        
        // Check if this is a migration from old schema
        let needs_migration = self.check_migration_needed().await?;
        println!("🔧 [Database] Migration needed: {}", needs_migration);
        
        if needs_migration {
            println!("🔧 [Database] Existing database detected - performing safe migration...");
            self.migrate_database().await?;
        } else {
            println!("🔧 [Database] Creating fresh database with complete schema...");
            self.create_fresh_schema().await?;
        }
        
        // Verify time_sessions table exists after migration/creation
        let time_sessions_exists = self.verify_time_sessions_table().await?;
        println!("🔧 [Database] time_sessions table exists: {}", time_sessions_exists);
        
        if !time_sessions_exists {
            println!("❌ [Database] CRITICAL: time_sessions table missing after migration!");
            return Err(anyhow::anyhow!("time_sessions table was not created successfully"));
        }
        
        println!("✅ [Database] Schema initialization completed successfully!");
        Ok(())
    }
    
    async fn verify_time_sessions_table(&self) -> anyhow::Result<bool> {
        let count: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='time_sessions'",
            [],
            |row| row.get(0)
        )?;
        Ok(count > 0)
    }
    
    async fn check_migration_needed(&self) -> anyhow::Result<bool> {
        println!("🔍 [Database] Checking migration status...");
        
        // Check if problems table exists (indicates existing database)
        let problems_exists: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='problems'",
            [],
            |row| row.get(0)
        )?;
        println!("🔍 [Database] problems table exists: {}", problems_exists > 0);
        
        // Check if time_sessions table exists (indicates complete schema)
        let time_sessions_exists: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='time_sessions'",
            [],
            |row| row.get(0)
        )?;
        println!("🔍 [Database] time_sessions table exists: {}", time_sessions_exists > 0);
        
        // List all existing tables for debugging
        let tables: Vec<String> = self.connection.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")?
            .query_map([], |row| Ok(row.get::<_, String>(0)?))?
            .collect::<Result<Vec<String>, _>>()?;
        println!("🔍 [Database] Existing tables: {:?}", tables);
        
        // Migration needed if problems exist but time_sessions don't
        let migration_needed = problems_exists > 0 && time_sessions_exists == 0;
        println!("🔍 [Database] Migration logic: problems={} AND time_sessions_missing={} = migration_needed={}", 
                 problems_exists > 0, 
                 time_sessions_exists == 0, 
                 migration_needed);
        
        Ok(migration_needed)
    }
    
    async fn create_fresh_schema(&mut self) -> anyhow::Result<()> {
        println!("🏗️ [Database] Executing complete table creation...");
        
        // Execute all table creation statements
        match self.connection.execute_batch(CREATE_TABLES_SQL) {
            Ok(_) => println!("✅ [Database] Tables created successfully"),
            Err(e) => {
                println!("❌ [Database] Failed to create tables: {}", e);
                return Err(anyhow::anyhow!("Failed to create tables: {}", e));
            }
        }
        
        println!("🏗️ [Database] Creating performance indexes...");
        
        // Execute all index creation statements
        match self.connection.execute_batch(CREATE_INDEXES_SQL) {
            Ok(_) => println!("✅ [Database] Indexes created successfully"),
            Err(e) => {
                println!("❌ [Database] Failed to create indexes: {}", e);
                return Err(anyhow::anyhow!("Failed to create indexes: {}", e));
            }
        }
        
        println!("✅ [Database] Fresh schema creation completed");
        Ok(())
    }
    
    async fn migrate_database(&mut self) -> anyhow::Result<()> {
        println!("🔄 [Database Migration] Starting comprehensive migration process...");
        
        // First, verify what tables currently exist
        let existing_tables: Vec<String> = self.connection.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")?
            .query_map([], |row| Ok(row.get::<_, String>(0)?))
            .context("Failed to query existing tables")?
            .collect::<Result<Vec<String>, _>>()?;
        println!("🔄 [Database Migration] Current tables before migration: {:?}", existing_tables);
        
        // Add missing tables one by one with error handling
        let missing_tables = [
            ("time_sessions", "CREATE TABLE IF NOT EXISTS time_sessions (
                id TEXT PRIMARY KEY,
                card_id TEXT NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME,
                duration INTEGER,
                date DATE,
                is_active INTEGER DEFAULT 0,
                notes TEXT,
                FOREIGN KEY (card_id) REFERENCES cards(id)
            )"),
            ("recordings", "CREATE TABLE IF NOT EXISTS recordings (
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
            )"),
            ("connections", "CREATE TABLE IF NOT EXISTS connections (
                id TEXT PRIMARY KEY,
                source_card_id TEXT NOT NULL,
                target_card_id TEXT NOT NULL,
                connection_type TEXT CHECK(connection_type IN ('related', 'prerequisite', 'similar', 'builds-upon')),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (source_card_id) REFERENCES cards(id),
                FOREIGN KEY (target_card_id) REFERENCES cards(id)
            )"),
            ("tags", "CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                color TEXT,
                category TEXT CHECK(category IN ('algorithm', 'data-structure', 'pattern', 'custom'))
            )"),
            ("problem_tags", "CREATE TABLE IF NOT EXISTS problem_tags (
                problem_id TEXT,
                tag_id TEXT,
                PRIMARY KEY (problem_id, tag_id),
                FOREIGN KEY (problem_id) REFERENCES problems(id),
                FOREIGN KEY (tag_id) REFERENCES tags(id)
            )"),
            ("card_tags", "CREATE TABLE IF NOT EXISTS card_tags (
                card_id TEXT,
                tag_id TEXT,
                PRIMARY KEY (card_id, tag_id),
                FOREIGN KEY (card_id) REFERENCES cards(id),
                FOREIGN KEY (tag_id) REFERENCES tags(id)
            )")
        ];
        
        for (table_name, create_sql) in missing_tables.iter() {
            println!("🔄 [Database Migration] Processing table: {}", table_name);
            println!("🔄 [Database Migration] SQL: {}", create_sql.chars().take(100).collect::<String>() + "...");
            
            match self.connection.execute(create_sql, []) {
                Ok(rows_affected) => {
                    println!("✅ [Database Migration] Successfully processed table: {} (rows affected: {})", table_name, rows_affected);
                },
                Err(e) => {
                    println!("❌ [Database Migration] Failed to create table {}: {}", table_name, e);
                    return Err(anyhow::anyhow!("Migration failed for table {}: {}", table_name, e));
                }
            }
        }
        
        // Add missing indexes
        println!("🔄 [Database Migration] Adding performance indexes...");
        let missing_indexes = [
            "CREATE INDEX IF NOT EXISTS idx_time_sessions_card_id ON time_sessions(card_id)",
            "CREATE INDEX IF NOT EXISTS idx_time_sessions_date ON time_sessions(date)",
            "CREATE INDEX IF NOT EXISTS idx_recordings_card_id ON recordings(card_id)",
            "CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_card_id)",
            "CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_card_id)"
        ];
        
        for (i, index_sql) in missing_indexes.iter().enumerate() {
            println!("🔄 [Database Migration] Adding index {}/{}: {}", i+1, missing_indexes.len(), index_sql.chars().take(80).collect::<String>() + "...");
            match self.connection.execute(index_sql, []) {
                Ok(rows_affected) => println!("✅ [Database Migration] Index added successfully (rows affected: {})", rows_affected),
                Err(e) => {
                    println!("⚠️ [Database Migration] Index creation warning: {}", e);
                    // Don't fail on index errors, they might already exist
                }
            }
        }
        
        // Verify tables exist after migration
        let final_tables: Vec<String> = self.connection.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")?
            .query_map([], |row| Ok(row.get::<_, String>(0)?))
            .context("Failed to verify tables after migration")?
            .collect::<Result<Vec<String>, _>>()?;
        println!("🔄 [Database Migration] Tables after migration: {:?}", final_tables);
        
        // Check specifically for time_sessions table
        let time_sessions_count: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='time_sessions'",
            [],
            |row| row.get(0)
        )?;
        println!("🔄 [Database Migration] time_sessions table check: {} (should be 1)", time_sessions_count);
        
        if time_sessions_count == 0 {
            return Err(anyhow::anyhow!("CRITICAL: time_sessions table was not created during migration!"));
        }
        
        println!("✅ [Database Migration] Migration completed successfully!");
        Ok(())
    }

    // Problem operations
    pub fn create_problem(&mut self, req: CreateProblemRequest) -> anyhow::Result<Problem> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        let category_json = serde_json::to_string(&req.category)?;
        let constraints_json = serde_json::to_string(&req.constraints)?;
        let hints_json = serde_json::to_string(&req.hints)?;
        let leetcode_url = req.leetcode_url.as_ref().map(|s| s.as_str()).unwrap_or("");
        
        self.connection.execute(
            "INSERT INTO problems (id, title, description, difficulty, category, leetcode_url, constraints, hints, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &id,
                &req.title,
                &req.description,
                &req.difficulty,
                &category_json,
                leetcode_url,
                &constraints_json,
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
            hints: hints_json,
            created_at: now,
        })
    }
    
    pub fn get_problems(&self) -> anyhow::Result<Vec<Problem>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, title, description, difficulty, category, leetcode_url, constraints, hints, created_at FROM problems ORDER BY created_at DESC"
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
                hints: row.get(7)?,
                created_at: row.get::<_, String>(8)?.parse().unwrap_or_else(|_| Utc::now()),
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
            "SELECT id, title, description, difficulty, category, leetcode_url, constraints, hints, created_at FROM problems WHERE id = ?1"
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
                hints: row.get(7)?,
                created_at: row.get::<_, String>(8)?.parse().unwrap_or_else(|_| Utc::now()),
            })
        })?;
        
        match problem_iter.next() {
            Some(problem) => Ok(Some(problem?)),
            None => Ok(None),
        }
    }

    pub fn update_problem(&mut self, req: UpdateProblemRequest) -> anyhow::Result<Option<Problem>> {
        // First check if problem exists
        let existing_problem = self.get_problem_by_id(&req.id)?;
        if existing_problem.is_none() {
            return Err(anyhow::anyhow!("Problem with id '{}' not found", req.id));
        }

        // Build dynamic query to update only provided fields
        let mut update_fields = Vec::new();
        let mut update_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref title) = req.title {
            update_fields.push("title = ?");
            update_values.push(Box::new(title.clone()));
        }

        if let Some(ref description) = req.description {
            update_fields.push("description = ?");
            update_values.push(Box::new(description.clone()));
        }

        if let Some(ref difficulty) = req.difficulty {
            update_fields.push("difficulty = ?");
            update_values.push(Box::new(difficulty.clone()));
        }

        if let Some(ref category) = req.category {
            let category_json = serde_json::to_string(category)?;
            update_fields.push("category = ?");
            update_values.push(Box::new(category_json));
        }

        if let Some(ref leetcode_url) = req.leetcode_url {
            update_fields.push("leetcode_url = ?");
            update_values.push(Box::new(leetcode_url.clone()));
        }

        if let Some(ref constraints) = req.constraints {
            let constraints_json = serde_json::to_string(constraints)?;
            update_fields.push("constraints = ?");
            update_values.push(Box::new(constraints_json));
        }

        if let Some(ref hints) = req.hints {
            let hints_json = serde_json::to_string(hints)?;
            update_fields.push("hints = ?");
            update_values.push(Box::new(hints_json));
        }

        // If no fields to update, return the existing problem
        if update_fields.is_empty() {
            return Ok(existing_problem);
        }

        // Build the SQL query
        let sql = format!(
            "UPDATE problems SET {} WHERE id = ?",
            update_fields.join(", ")
        );
        
        // Add the id to the end of the values
        update_values.push(Box::new(req.id.clone()));

        // Execute the update
        let rows_affected = self.connection.execute(
            &sql,
            rusqlite::params_from_iter(update_values.iter().map(|v| v.as_ref()))
        )?;

        if rows_affected == 0 {
            return Err(anyhow::anyhow!("Failed to update problem - no rows affected"));
        }

        // Return the updated problem
        self.get_problem_by_id(&req.id)
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

    pub fn delete_card(&mut self, card_id: &str) -> anyhow::Result<()> {
        // First, verify the card exists
        let card = self.get_card_by_id(card_id)?;
        if card.is_none() {
            return Err(anyhow::anyhow!("Card with id '{}' not found", card_id));
        }

        let card = card.unwrap();

        // Safety check: Only allow deletion of child cards for now
        // (Main cards should be kept to preserve problem structure)
        if card.parent_card_id.is_none() || card.parent_card_id.as_ref().map_or(true, |s| s.is_empty()) {
            return Err(anyhow::anyhow!(
                "Cannot delete main cards. Only child cards can be deleted for safety."
            ));
        }

        // Begin transaction for atomic deletion
        let tx = self.connection.unchecked_transaction()?;

        // Delete associated data in correct order (child tables first)
        
        // 1. Delete any time sessions for this card
        // Note: These tables might not exist yet, so we use IF EXISTS
        tx.execute(
            "DELETE FROM time_sessions WHERE card_id = ?1",
            [card_id],
        ).unwrap_or(0); // Ignore errors if table doesn't exist
        
        // 2. Delete any recordings for this card
        tx.execute(
            "DELETE FROM recordings WHERE card_id = ?1", 
            [card_id],
        ).unwrap_or(0); // Ignore errors if table doesn't exist
        
        // 3. Delete any connections where this card is source or target
        tx.execute(
            "DELETE FROM connections WHERE source_card_id = ?1 OR target_card_id = ?1",
            [card_id],
        ).unwrap_or(0); // Ignore errors if table doesn't exist

        // 4. Finally, delete the card itself
        let rows_affected = tx.execute(
            "DELETE FROM cards WHERE id = ?1",
            [card_id],
        )?;

        if rows_affected == 0 {
            return Err(anyhow::anyhow!("Failed to delete card - no rows affected"));
        }

        // Commit the transaction
        tx.commit()?;

        println!("Successfully deleted card '{}' and associated data", card_id);
        Ok(())
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
    
    #[allow(dead_code)]
    pub fn get_sessions_for_card(&self, card_id: &str) -> anyhow::Result<Vec<TimeSession>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, card_id, start_time, end_time, duration, date, is_active, notes 
             FROM time_sessions WHERE card_id = ?1 ORDER BY start_time DESC"
        )?;
        
        let session_iter = stmt.query_map([card_id], |row| {
            let start_time_str: String = row.get(2)?;
            let end_time_str: Option<String> = row.get(3)?;
            
            Ok(TimeSession {
                id: row.get(0)?,
                card_id: row.get(1)?,
                start_time: start_time_str.parse().unwrap_or_else(|_| Utc::now()),
                end_time: end_time_str.and_then(|s| s.parse().ok()),
                duration: row.get(4)?,
                date: row.get(5)?,
                is_active: row.get::<_, i32>(6)? == 1,
                notes: row.get(7)?,
            })
        })?;
        
        let mut sessions = Vec::new();
        for session in session_iter {
            sessions.push(session?);
        }
        
        Ok(sessions)
    }
    
    #[allow(dead_code)]
    pub fn delete_time_session(&mut self, session_id: &str) -> anyhow::Result<()> {
        // First, get the session details to update the card's total duration
        let session: Option<(String, i32)> = self.connection.query_row(
            "SELECT card_id, duration FROM time_sessions WHERE id = ?1",
            [session_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
        ).optional()?;
        
        match session {
            Some((card_id, duration)) => {
                // Begin transaction for atomic operation
                let tx = self.connection.unchecked_transaction()?;
                
                // Delete the session
                let rows_affected = tx.execute(
                    "DELETE FROM time_sessions WHERE id = ?1",
                    [session_id]
                )?;
                
                if rows_affected == 0 {
                    return Err(anyhow::anyhow!("Session not found"));
                }
                
                // Update card's total duration (subtract the deleted session duration)
                tx.execute(
                    "UPDATE cards SET total_duration = total_duration - ?1 WHERE id = ?2",
                    params![duration, &card_id]
                )?;
                
                // Commit the transaction
                tx.commit()?;
                
                println!("Successfully deleted session '{}' and updated card total duration", session_id);
                Ok(())
            },
            None => Err(anyhow::anyhow!("Session with id '{}' not found", session_id))
        }
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

    // Image-related operations
    pub fn save_problem_image(&mut self, problem_id: &str, image_path: &str, caption: Option<String>, position: Option<i32>) -> anyhow::Result<ProblemImage> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        // Get the next position if not provided
        let position = match position {
            Some(pos) => pos,
            None => {
                let max_position: Option<i32> = self.connection.query_row(
                    "SELECT MAX(position) FROM problem_images WHERE problem_id = ?1",
                    [problem_id],
                    |row| row.get(0),
                ).optional()?.flatten();
                max_position.unwrap_or(-1) + 1
            }
        };
        
        self.connection.execute(
            "INSERT INTO problem_images (id, problem_id, image_path, caption, position, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                &id,
                problem_id,
                image_path,
                &caption,
                position,
                &now.to_rfc3339(),
            ],
        )?;
        
        Ok(ProblemImage {
            id,
            problem_id: problem_id.to_string(),
            image_path: image_path.to_string(),
            caption,
            position,
            created_at: now,
        })
    }
    
    pub fn get_problem_images(&self, problem_id: &str) -> anyhow::Result<Vec<ProblemImage>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, problem_id, image_path, caption, position, created_at 
             FROM problem_images WHERE problem_id = ?1 ORDER BY position"
        )?;
        
        let image_iter = stmt.query_map([problem_id], |row| {
            let created_at_str: String = row.get(5)?;
            
            Ok(ProblemImage {
                id: row.get(0)?,
                problem_id: row.get(1)?,
                image_path: row.get(2)?,
                caption: row.get(3)?,
                position: row.get(4)?,
                created_at: created_at_str.parse().unwrap_or_else(|_| Utc::now()),
            })
        })?;
        
        let mut images = Vec::new();
        for image in image_iter {
            images.push(image?);
        }
        
        Ok(images)
    }
    
    pub fn delete_problem_image(&mut self, image_id: &str) -> anyhow::Result<String> {
        // First get the image path so we can delete the file
        let image_path: String = self.connection.query_row(
            "SELECT image_path FROM problem_images WHERE id = ?1",
            [image_id],
            |row| row.get(0),
        )?;
        
        // Delete from database
        let rows_affected = self.connection.execute(
            "DELETE FROM problem_images WHERE id = ?1",
            [image_id]
        )?;
        
        if rows_affected == 0 {
            return Err(anyhow::anyhow!("Image not found"));
        }
        
        Ok(image_path)
    }
    
    pub fn update_image_positions(&mut self, updates: Vec<(String, i32)>) -> anyhow::Result<()> {
        let tx = self.connection.unchecked_transaction()?;
        
        for (image_id, position) in updates {
            tx.execute(
                "UPDATE problem_images SET position = ?1 WHERE id = ?2",
                params![position, &image_id]
            )?;
        }
        
        tx.commit()?;
        Ok(())
    }

    // Tag management operations
    pub fn get_problem_tags(&self, problem_id: &str) -> anyhow::Result<Vec<Tag>> {
        let mut stmt = self.connection.prepare(
            "SELECT t.id, t.name, t.color, t.category 
             FROM tags t 
             JOIN problem_tags pt ON t.id = pt.tag_id 
             WHERE pt.problem_id = ?1 
             ORDER BY t.name"
        )?;
        
        let tag_iter = stmt.query_map([problem_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                category: row.get(3)?,
            })
        })?;
        
        let mut tags = Vec::new();
        for tag in tag_iter {
            tags.push(tag?);
        }
        
        Ok(tags)
    }
    
    pub fn get_all_tags(&self) -> anyhow::Result<Vec<Tag>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, name, color, category FROM tags ORDER BY name"
        )?;
        
        let tag_iter = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                category: row.get(3)?,
            })
        })?;
        
        let mut tags = Vec::new();
        for tag in tag_iter {
            tags.push(tag?);
        }
        
        Ok(tags)
    }
    
    pub fn add_problem_tag(&mut self, req: AddProblemTagRequest) -> anyhow::Result<Tag> {
        // First, check if tag already exists
        let existing_tag: Option<Tag> = self.connection.query_row(
            "SELECT id, name, color, category FROM tags WHERE name = ?1",
            [&req.tag_name],
            |row| Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                category: row.get(3)?,
            })
        ).optional()?;
        
        let tag = match existing_tag {
            Some(tag) => tag,
            None => {
                // Create new tag
                let tag_id = Uuid::new_v4().to_string();
                let category = req.category.unwrap_or_else(|| "custom".to_string());
                
                self.connection.execute(
                    "INSERT INTO tags (id, name, color, category) VALUES (?1, ?2, ?3, ?4)",
                    params![&tag_id, &req.tag_name, &req.color, &category],
                )?;
                
                Tag {
                    id: tag_id,
                    name: req.tag_name.clone(),
                    color: req.color.clone(),
                    category,
                }
            }
        };
        
        // Check if the problem-tag relationship already exists
        let exists: i32 = self.connection.query_row(
            "SELECT COUNT(*) FROM problem_tags WHERE problem_id = ?1 AND tag_id = ?2",
            params![&req.problem_id, &tag.id],
            |row| row.get(0),
        )?;
        
        // Only add the relationship if it doesn't exist
        if exists == 0 {
            self.connection.execute(
                "INSERT INTO problem_tags (problem_id, tag_id) VALUES (?1, ?2)",
                params![&req.problem_id, &tag.id],
            )?;
        }
        
        Ok(tag)
    }
    
    pub fn remove_problem_tag(&mut self, req: RemoveProblemTagRequest) -> anyhow::Result<()> {
        let rows_affected = self.connection.execute(
            "DELETE FROM problem_tags WHERE problem_id = ?1 AND tag_id = ?2",
            params![&req.problem_id, &req.tag_id],
        )?;
        
        if rows_affected == 0 {
            return Err(anyhow::anyhow!("Tag relationship not found"));
        }
        
        Ok(())
    }
    
    pub fn get_tag_suggestions(&self, query: &str, limit: i32) -> anyhow::Result<Vec<String>> {
        let search_pattern = format!("%{}%", query);
        
        let mut stmt = self.connection.prepare(
            "SELECT DISTINCT name FROM tags 
             WHERE name LIKE ?1 
             ORDER BY name 
             LIMIT ?2"
        )?;
        
        let suggestions = stmt.query_map(params![search_pattern, limit], |row| {
            Ok(row.get::<_, String>(0)?)
        })?
        .collect::<Result<Vec<_>, _>>()?;
        
        Ok(suggestions)
    }
}
mod schema;

use rusqlite::{Connection, params, OptionalExtension};
use anyhow::Context;
use chrono::{Utc, DateTime, NaiveDateTime};
use uuid::Uuid;
use crate::models::*;
use schema::{CREATE_TABLES_SQL, CREATE_INDEXES_SQL};

// Helper functions for JSON parsing
fn parse_json_array(json_str: &str) -> Vec<String> {
    if json_str.is_empty() || json_str == "null" {
        return Vec::new();
    }
    
    match serde_json::from_str::<Vec<String>>(json_str) {
        Ok(array) => array,
        Err(_) => {
            // If parsing fails, try to handle as a single string or comma-separated values
            if json_str.starts_with('[') && json_str.ends_with(']') {
                // It looks like JSON but failed to parse, return empty
                Vec::new()
            } else {
                // Treat as comma-separated string
                json_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
            }
        }
    }
}

fn convert_problem_to_frontend(db_problem: Problem) -> FrontendProblem {
    let related_problem_ids = match db_problem.related_problem_ids {
        Some(ids_json) => parse_json_array(&ids_json),
        None => Vec::new()
    };
    
    FrontendProblem {
        id: db_problem.id,
        title: db_problem.title,
        description: db_problem.description,
        difficulty: db_problem.difficulty,
        topic: parse_json_array(&db_problem.topic),
        leetcode_url: db_problem.leetcode_url,
        constraints: parse_json_array(&db_problem.constraints),
        hints: parse_json_array(&db_problem.hints),
        related_problem_ids,
        created_at: db_problem.created_at,
        updated_at: db_problem.updated_at,
        tags: Vec::new(), // Will be populated separately if needed
    }
}

// Helper function to parse datetime strings with multiple format support
fn parse_datetime_flexible(datetime_str: &str) -> DateTime<Utc> {
    // Try parsing as RFC3339/ISO 8601 first (new format)
    if let Ok(dt) = datetime_str.parse::<DateTime<Utc>>() {
        return dt;
    }
    
    // Try parsing as simple datetime format (old format: "2025-08-07 19:10:58")
    if let Ok(naive_dt) = NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S") {
        return naive_dt.and_utc();
    }
    
    // If all parsing fails, return current time as fallback
    eprintln!("⚠️ Failed to parse datetime '{}', using current time as fallback", datetime_str);
    Utc::now()
}

pub struct DatabaseManager {
    connection: Connection,
}

impl DatabaseManager {
    pub async fn new() -> anyhow::Result<Self> {
        // Create database directory in proper app data directory
        let app_data_dir = if cfg!(debug_assertions) {
            // Development: use project data folder
            std::env::current_dir()
                .context("Failed to get current directory")?
                .join("data")
        } else {
            // Production: use proper app data directory
            dirs::data_dir()
                .context("Failed to get data directory")?
                .join("com.dsalearning.dsaapp")
        };
        
        std::fs::create_dir_all(&app_data_dir)
            .context("Failed to create app data directory")?;
            
        Self::new_with_path(app_data_dir).await
    }
    
    // New method that accepts a custom path for Tauri-resolved directories
    pub async fn new_with_path(app_data_dir: std::path::PathBuf) -> anyhow::Result<Self> {
        println!("🔧 [Database] Initializing database with path: {}", app_data_dir.display());
        
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
        
        let app_data_dir = if cfg!(debug_assertions) {
            // Development: use project data folder
            std::env::current_dir()
                .context("Failed to get current directory")?
                .join("data")
        } else {
            // Production: use proper app data directory
            dirs::data_dir()
                .context("Failed to get data directory")?
                .join("com.dsalearning.dsaapp")
        };
        
        Self::connect_existing_with_path(app_data_dir).await
    }
    
    // New method that accepts a custom path for Tauri-resolved directories
    pub async fn connect_existing_with_path(app_data_dir: std::path::PathBuf) -> anyhow::Result<Self> {
        println!("🔧 [Database] Attempting to connect to existing database with path: {}", app_data_dir.display());
        
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
        
        // Check if problems table has old 'category' column but no 'topic' column
        let has_category_column = if problems_exists > 0 {
            let column_info: Result<Vec<String>, _> = self.connection.prepare("PRAGMA table_info(problems)")?
                .query_map([], |row| Ok(row.get::<_, String>(1)?))?
                .collect();
            
            match column_info {
                Ok(columns) => {
                    println!("🔍 [Database] problems table columns: {:?}", columns);
                    let has_category = columns.contains(&"category".to_string());
                    let has_topic = columns.contains(&"topic".to_string());
                    println!("🔍 [Database] has_category: {}, has_topic: {}", has_category, has_topic);
                    has_category && !has_topic
                }
                Err(e) => {
                    println!("🔍 [Database] Failed to get column info: {}", e);
                    false
                }
            }
        } else {
            false
        };
        
        // List all existing tables for debugging
        let tables: Vec<String> = self.connection.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")?
            .query_map([], |row| Ok(row.get::<_, String>(0)?))?
            .collect::<Result<Vec<String>, _>>()?;
        println!("🔍 [Database] Existing tables: {:?}", tables);
        
        // Migration needed if:
        // 1. Problems exist but time_sessions don't (original migration)
        // 2. Problems table has 'category' column but no 'topic' column (new migration)
        let needs_table_migration = problems_exists > 0 && time_sessions_exists == 0;
        let needs_column_migration = has_category_column;
        let migration_needed = needs_table_migration || needs_column_migration;
        
        println!("🔍 [Database] Migration logic: table_migration={}, column_migration={}, total_needed={}", 
                 needs_table_migration,
                 needs_column_migration,
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
        
        // Check if we need to migrate category -> topic column
        let needs_column_migration = if existing_tables.contains(&"problems".to_string()) {
            let column_info: Result<Vec<String>, _> = self.connection.prepare("PRAGMA table_info(problems)")?
                .query_map([], |row| Ok(row.get::<_, String>(1)?))?
                .collect();
                
            match column_info {
                Ok(columns) => {
                    let has_category = columns.contains(&"category".to_string());
                    let has_topic = columns.contains(&"topic".to_string());
                    has_category && !has_topic
                }
                Err(_) => false
            }
        } else {
            false
        };
        
        // Perform category -> topic migration if needed
        if needs_column_migration {
            println!("🔄 [Database Migration] Migrating category column to topic...");
            self.migrate_category_to_topic().await?;
        }
        
        // Check if we need to add related_problem_ids column
        println!("🔍 [Database Migration] Checking if related_problem_ids column migration is needed...");
        let needs_related_problems_migration = if existing_tables.contains(&"problems".to_string()) {
            println!("🔍 [Database Migration] Problems table exists, checking columns...");
            let column_info: Result<Vec<String>, _> = self.connection.prepare("PRAGMA table_info(problems)")?
                .query_map([], |row| Ok(row.get::<_, String>(1)?))?
                .collect();
                
            match column_info {
                Ok(columns) => {
                    println!("🔍 [Database Migration] Current problems table columns: {:?}", columns);
                    let has_related_problem_ids = columns.contains(&"related_problem_ids".to_string());
                    println!("🔍 [Database Migration] Has related_problem_ids column: {}", has_related_problem_ids);
                    let needs_migration = !has_related_problem_ids;
                    println!("🔍 [Database Migration] Needs related_problem_ids migration: {}", needs_migration);
                    needs_migration
                }
                Err(e) => {
                    println!("⚠️ [Database Migration] Failed to get column info: {}", e);
                    false
                }
            }
        } else {
            println!("🔍 [Database Migration] Problems table does not exist, no related_problem_ids migration needed");
            false
        };
        
        // Perform related_problem_ids migration if needed
        if needs_related_problems_migration {
            println!("🔄 [Database Migration] Related problems migration required - executing...");
            match self.migrate_add_related_problems_column().await {
                Ok(()) => {
                    println!("✅ [Database Migration] Related problems migration completed successfully!");
                },
                Err(e) => {
                    let error_msg = format!("Related problems migration failed: {}", e);
                    println!("❌ [Database Migration] {}", error_msg);
                    return Err(anyhow::anyhow!(error_msg));
                }
            }
        } else {
            println!("ℹ️ [Database Migration] Related problems migration not needed, skipping...");
        }
        
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
    
    async fn migrate_category_to_topic(&mut self) -> anyhow::Result<()> {
        println!("🔄 [Database Migration] Starting category -> topic column migration...");
        
        // SQLite doesn't support ALTER TABLE DROP COLUMN until version 3.35.0
        // So we use the standard SQLite approach: create new table, copy data, drop old, rename
        
        // Temporarily disable foreign key constraints for migration
        println!("🔄 [Database Migration] Disabling foreign key constraints for migration...");
        self.connection.execute("PRAGMA foreign_keys = OFF", [])?;
        
        // Begin transaction for atomic migration
        let tx = self.connection.unchecked_transaction()?;
        
        // Step 0: Check if problems_new already exists and drop it (cleanup from failed migration)
        let problems_new_exists: i64 = tx.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='problems_new'",
            [],
            |row| row.get(0)
        )?;
        
        if problems_new_exists > 0 {
            println!("🔄 [Database Migration] Found existing problems_new table from previous migration, dropping it...");
            tx.execute("DROP TABLE problems_new", [])?;
        }
        
        // Step 1: Create a new problems table with the correct schema
        println!("🔄 [Database Migration] Creating new problems table with topic column...");
        tx.execute(
            "CREATE TABLE problems_new (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                difficulty TEXT CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
                topic TEXT,
                leetcode_url TEXT,
                constraints TEXT,
                examples TEXT,
                hints TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            []
        )?;
        
        // Step 2: Copy all data from old table to new table, mapping category -> topic
        println!("🔄 [Database Migration] Copying data from old table to new table...");
        let rows_copied = tx.execute(
            "INSERT INTO problems_new (id, title, description, difficulty, topic, leetcode_url, constraints, examples, hints, created_at)
             SELECT id, title, description, difficulty, category, leetcode_url, constraints, examples, hints, created_at
             FROM problems",
            []
        )?;
        println!("🔄 [Database Migration] Copied {} rows from old table to new table", rows_copied);
        
        // Step 3: Drop the old table
        println!("🔄 [Database Migration] Dropping old problems table...");
        tx.execute("DROP TABLE problems", [])?;
        
        // Step 4: Rename the new table to the original name
        println!("🔄 [Database Migration] Renaming new table to problems...");
        tx.execute("ALTER TABLE problems_new RENAME TO problems", [])?;
        
        // Commit the transaction
        tx.commit()?;
        
        // Re-enable foreign key constraints
        println!("🔄 [Database Migration] Re-enabling foreign key constraints...");
        self.connection.execute("PRAGMA foreign_keys = ON", [])?;
        
        println!("✅ [Database Migration] Category -> Topic migration completed successfully!");
        Ok(())
    }
    
    async fn migrate_add_related_problems_column(&mut self) -> anyhow::Result<()> {
        println!("🔄 [Database Migration] Adding related_problem_ids column to problems table...");
        
        // First, verify the problems table exists
        let problems_exists: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='problems'",
            [],
            |row| row.get(0)
        ).context("Failed to check if problems table exists")?;
        
        if problems_exists == 0 {
            return Err(anyhow::anyhow!("Problems table does not exist - cannot add related_problem_ids column"));
        }
        
        // Check if column already exists (double check)
        let columns_result: Result<Vec<String>, _> = self.connection.prepare("PRAGMA table_info(problems)")
            .context("Failed to prepare PRAGMA table_info")?
            .query_map([], |row| Ok(row.get::<_, String>(1)?))
            .context("Failed to query table info")?
            .collect();
            
        match columns_result {
            Ok(columns) => {
                if columns.contains(&"related_problem_ids".to_string()) {
                    println!("✅ [Database Migration] related_problem_ids column already exists, skipping...");
                    return Ok(());
                }
            },
            Err(e) => {
                println!("⚠️ [Database Migration] Warning: Could not check existing columns: {}", e);
                // Continue with migration attempt anyway
            }
        }
        
        println!("🔄 [Database Migration] Executing ALTER TABLE to add related_problem_ids column...");
        
        match self.connection.execute(
            "ALTER TABLE problems ADD COLUMN related_problem_ids TEXT",
            []
        ) {
            Ok(rows_affected) => {
                println!("✅ [Database Migration] ALTER TABLE executed successfully (rows affected: {})", rows_affected);
                
                // Verify the column was actually added
                let verification_result: Result<Vec<String>, _> = self.connection.prepare("PRAGMA table_info(problems)")
                    .context("Failed to prepare verification PRAGMA")?
                    .query_map([], |row| Ok(row.get::<_, String>(1)?))
                    .context("Failed to query verification table info")?
                    .collect();
                    
                match verification_result {
                    Ok(columns) => {
                        if columns.contains(&"related_problem_ids".to_string()) {
                            println!("✅ [Database Migration] Verified: related_problem_ids column was successfully added!");
                            Ok(())
                        } else {
                            let error_msg = format!("Column addition failed verification. Current columns: {:?}", columns);
                            println!("❌ [Database Migration] {}", error_msg);
                            Err(anyhow::anyhow!(error_msg))
                        }
                    },
                    Err(e) => {
                        let error_msg = format!("Failed to verify column addition: {}", e);
                        println!("❌ [Database Migration] {}", error_msg);
                        Err(anyhow::anyhow!(error_msg))
                    }
                }
            },
            Err(e) => {
                let error_msg = format!("Failed to add related_problem_ids column: {} (Error type: {})", e, std::any::type_name_of_val(&e));
                println!("❌ [Database Migration] {}", error_msg);
                
                // Check if it's a "duplicate column" error (which means it already exists)
                let error_str = e.to_string().to_lowercase();
                if error_str.contains("duplicate column") || error_str.contains("already exists") {
                    println!("ℹ️ [Database Migration] Column already exists, treating as success");
                    Ok(())
                } else {
                    Err(anyhow::anyhow!("{}", error_msg))
                }
            }
        }
    }

    // Helper function to check if related_problem_ids column exists
    fn has_related_problem_ids_column(&self) -> bool {
        let column_info: Result<Vec<String>, _> = self.connection.prepare("PRAGMA table_info(problems)")
            .and_then(|mut stmt| {
                stmt.query_map([], |row| Ok(row.get::<_, String>(1)?))
                    .map(|rows| rows.collect::<Result<Vec<String>, _>>())
            })
            .and_then(|result| result);
            
        match column_info {
            Ok(columns) => columns.contains(&"related_problem_ids".to_string()),
            Err(_) => false
        }
    }

    // Problem operations
    pub fn create_problem(&mut self, req: CreateProblemRequest) -> anyhow::Result<FrontendProblem> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        let topic_json = serde_json::to_string(&req.topic)?;
        let constraints_json = serde_json::to_string(&req.constraints)?;
        let hints_json = serde_json::to_string(&req.hints)?;
        let leetcode_url = req.leetcode_url.as_ref().map(|s| s.as_str()).unwrap_or("");
        
        // Check if related_problem_ids column exists for backward compatibility
        let has_related_column = self.has_related_problem_ids_column();
        
        if has_related_column {
            // Use new schema with related_problem_ids column
            let related_problem_ids_json = req.related_problem_ids
                .as_ref()
                .map(|ids| serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_string()))
                .unwrap_or_else(|| "[]".to_string());
                
            self.connection.execute(
                "INSERT INTO problems (id, title, description, difficulty, topic, leetcode_url, constraints, hints, related_problem_ids, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    &id,
                    &req.title,
                    &req.description,
                    &req.difficulty,
                    &topic_json,
                    leetcode_url,
                    &constraints_json,
                    &hints_json,
                    &related_problem_ids_json,
                    &now.to_rfc3339(),
                    &now.to_rfc3339(),
                ],
            )?;
        } else {
            // Use old schema without related_problem_ids column
            self.connection.execute(
                "INSERT INTO problems (id, title, description, difficulty, topic, leetcode_url, constraints, hints, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    &id,
                    &req.title,
                    &req.description,
                    &req.difficulty,
                    &topic_json,
                    leetcode_url,
                    &constraints_json,
                    &hints_json,
                    &now.to_rfc3339(),
                    &now.to_rfc3339(),
                ],
            )?;
        }
        
        // Return the frontend-compatible version
        Ok(FrontendProblem {
            id,
            title: req.title,
            description: req.description,
            difficulty: req.difficulty,
            topic: req.topic,
            leetcode_url: req.leetcode_url,
            constraints: req.constraints,
            hints: req.hints,
            related_problem_ids: req.related_problem_ids.unwrap_or_default(),
            created_at: now,
            updated_at: now,
            tags: Vec::new(), // Empty for newly created problems
        })
    }
    
    pub fn get_problems(&self) -> anyhow::Result<Vec<FrontendProblem>> {
        // Check if related_problem_ids column exists for backward compatibility
        let has_related_column = self.has_related_problem_ids_column();
        
        let sql = if has_related_column {
            "SELECT id, title, description, difficulty, topic, leetcode_url, constraints, hints, related_problem_ids, created_at, updated_at FROM problems ORDER BY created_at DESC"
        } else {
            "SELECT id, title, description, difficulty, topic, leetcode_url, constraints, hints, NULL as related_problem_ids, created_at, updated_at FROM problems ORDER BY created_at DESC"
        };
        
        let mut stmt = self.connection.prepare(sql)?;
        
        let problem_iter = stmt.query_map([], |row| {
            let db_problem = Problem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                difficulty: row.get(3)?,
                topic: row.get(4)?,
                leetcode_url: row.get(5)?,
                constraints: row.get(6)?,
                hints: row.get(7)?,
                related_problem_ids: row.get(8).ok(), // Use .ok() to handle NULL gracefully
                created_at: parse_datetime_flexible(&row.get::<_, String>(9)?),
                updated_at: parse_datetime_flexible(&row.get::<_, String>(10)?),
            };
            Ok(convert_problem_to_frontend(db_problem))
        })?;
        
        let mut problems = Vec::new();
        for problem in problem_iter {
            problems.push(problem?);
        }
        
        Ok(problems)
    }
    
    pub fn get_problem_by_id(&self, id: &str) -> anyhow::Result<Option<FrontendProblem>> {
        // Check if related_problem_ids column exists for backward compatibility
        let has_related_column = self.has_related_problem_ids_column();
        
        let sql = if has_related_column {
            "SELECT id, title, description, difficulty, topic, leetcode_url, constraints, hints, related_problem_ids, created_at, updated_at FROM problems WHERE id = ?1"
        } else {
            "SELECT id, title, description, difficulty, topic, leetcode_url, constraints, hints, NULL as related_problem_ids, created_at, updated_at FROM problems WHERE id = ?1"
        };
        
        let mut stmt = self.connection.prepare(sql)?;
        
        let mut problem_iter = stmt.query_map([id], |row| {
            let db_problem = Problem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                difficulty: row.get(3)?,
                topic: row.get(4)?,
                leetcode_url: row.get(5)?,
                constraints: row.get(6)?,
                hints: row.get(7)?,
                related_problem_ids: row.get(8).ok(), // Use .ok() to handle NULL gracefully
                created_at: parse_datetime_flexible(&row.get::<_, String>(9)?),
                updated_at: parse_datetime_flexible(&row.get::<_, String>(10)?),
            };
            Ok(convert_problem_to_frontend(db_problem))
        })?;
        
        match problem_iter.next() {
            Some(problem) => Ok(Some(problem?)),
            None => Ok(None),
        }
    }

    pub fn update_problem(&mut self, req: UpdateProblemRequest) -> anyhow::Result<Option<FrontendProblem>> {
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

        if let Some(ref topic) = req.topic {
            let topic_json = serde_json::to_string(topic)?;
            update_fields.push("topic = ?");
            update_values.push(Box::new(topic_json));
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

        // Only update related_problem_ids if the column exists (backward compatibility)
        if let Some(ref related_problem_ids) = req.related_problem_ids {
            if self.has_related_problem_ids_column() {
                let related_ids_json = serde_json::to_string(related_problem_ids)?;
                update_fields.push("related_problem_ids = ?");
                update_values.push(Box::new(related_ids_json));
            }
            // If column doesn't exist, silently ignore the related_problem_ids update
        }

        // If no fields to update, return the existing problem
        if update_fields.is_empty() {
            return Ok(existing_problem);
        }

        // Always update the updated_at timestamp when any field is modified
        let now = Utc::now();
        update_fields.push("updated_at = ?");
        update_values.push(Box::new(now.to_rfc3339()));

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
        
        // Fix FOREIGN KEY constraint: use NULL instead of empty string for parent_card_id
        match req.parent_card_id.as_ref() {
            Some(parent_id) if !parent_id.is_empty() => {
                // Insert with parent_card_id value
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
                        parent_id,
                    ],
                )?;
            }
            _ => {
                // Insert with NULL parent_card_id
                self.connection.execute(
                    "INSERT INTO cards (id, problem_id, card_number, language, status, total_duration, created_at, last_modified, parent_card_id)
                     VALUES (?1, ?2, ?3, ?4, 'In Progress', 0, ?5, ?6, NULL)",
                    params![
                        &id,
                        &req.problem_id,
                        card_number,
                        language,
                        &now.to_rfc3339(),
                        &now.to_rfc3339(),
                    ],
                )?;
            }
        }
        
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
        
        let now = Utc::now();
        self.connection.execute(
            "UPDATE cards SET total_duration = total_duration + ?1, last_modified = ?2 WHERE id = ?3",
            params![duration, &now.to_rfc3339(), &card_id],
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
                let now = Utc::now();
                tx.execute(
                    "UPDATE cards SET total_duration = total_duration - ?1, last_modified = ?2 WHERE id = ?3",
                    params![duration, &now.to_rfc3339(), &card_id]
                )?;
                
                // Commit the transaction
                tx.commit()?;
                
                println!("Successfully deleted session '{}' and updated card total duration", session_id);
                Ok(())
            },
            None => Err(anyhow::anyhow!("Session with id '{}' not found", session_id))
        }
    }

    // Recording operations
    pub fn save_recording(&mut self, card_id: &str, filename: &str, filepath: &str, duration: Option<i32>) -> anyhow::Result<Recording> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        // Get file size - resolve relative path to absolute path
        let file_size = if filepath.starts_with("dev-data/") || filepath.starts_with("app-data/") || filepath.starts_with("attachments/") {
            // Convert relative path to absolute path based on environment
            let absolute_path = if filepath.starts_with("dev-data/") {
                // Development path: project_root/dev-data/...
                let current_dir = std::env::current_dir().context("Failed to get current directory")?;
                current_dir.join(filepath)
            } else if filepath.starts_with("app-data/") {
                // Production path: resolve to actual app data directory
                if cfg!(debug_assertions) {
                    // In development, this shouldn't happen, but handle it
                    let current_dir = std::env::current_dir().context("Failed to get current directory")?;
                    current_dir.join("dev-data").join(&filepath[9..]) // Remove "app-data/" prefix
                } else {
                    // Production: resolve to actual app data directory
                    let app_data_dir = if cfg!(target_os = "macos") {
                        dirs::home_dir()
                            .context("Failed to get home directory")?
                            .join("Library")
                            .join("Application Support")
                            .join("com.dsalearning.app")
                    } else if cfg!(target_os = "windows") {
                        dirs::data_dir()
                            .context("Failed to get data directory")?
                            .join("com.dsalearning.app")
                    } else {
                        dirs::data_local_dir()
                            .context("Failed to get local data directory")?
                            .join("com.dsalearning.app")
                    };
                    app_data_dir.join(&filepath[9..]) // Remove "app-data/" prefix
                }
            } else {
                // Legacy "attachments/" path - assume project root for backward compatibility
                let current_dir = std::env::current_dir().context("Failed to get current directory")?;
                current_dir.join(filepath)
            };
            
            std::fs::metadata(&absolute_path)
                .map(|m| m.len() as i64)
                .map_err(|e| {
                    println!("Warning: Failed to get file metadata for {}: {}", absolute_path.display(), e);
                    e
                })
                .ok()
        } else {
            // Already an absolute path
            std::fs::metadata(filepath)
                .map(|m| m.len() as i64)
                .map_err(|e| {
                    println!("Warning: Failed to get file metadata for {}: {}", filepath, e);
                    e
                })
                .ok()
        };
        
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
    
    pub fn get_recordings_for_card(&self, card_id: &str) -> anyhow::Result<Vec<Recording>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, card_id, time_session_id, audio_url, duration, transcript, created_at, filename, filepath, file_size 
             FROM recordings WHERE card_id = ?1 ORDER BY created_at DESC"
        )?;
        
        let recording_iter = stmt.query_map([card_id], |row| {
            Ok(Recording {
                id: row.get(0)?,
                card_id: row.get(1)?,
                time_session_id: row.get(2)?,
                audio_url: row.get(3)?,
                duration: row.get(4)?,
                transcript: row.get(5)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                    .map_err(|e| rusqlite::Error::InvalidColumnType(6, e.to_string().into(), rusqlite::types::Type::Text))?
                    .with_timezone(&chrono::Utc),
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
    
    pub fn delete_recording(&mut self, recording_id: &str) -> anyhow::Result<()> {
        // Check if recording exists before attempting deletion
        let rows_affected = self.connection.execute(
            "DELETE FROM recordings WHERE id = ?1",
            [recording_id]
        )?;
        
        if rows_affected == 0 {
            return Err(anyhow::anyhow!("Recording with id '{}' not found", recording_id));
        }
        
        println!("Successfully deleted recording '{}'", recording_id);
        Ok(())
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
        println!("🗃️ Database: Attempting to delete image with id: {}", image_id);
        
        // First get the image path so we can delete the file
        let image_path: String = self.connection.query_row(
            "SELECT image_path FROM problem_images WHERE id = ?1",
            [image_id],
            |row| row.get(0),
        ).map_err(|e| {
            println!("❌ Database: Failed to find image with id '{}': {}", image_id, e);
            e
        })?;
        
        println!("✅ Database: Found image path: {}", image_path);
        
        // Delete from database
        let rows_affected = self.connection.execute(
            "DELETE FROM problem_images WHERE id = ?1",
            [image_id]
        ).map_err(|e| {
            println!("❌ Database: Failed to execute delete query: {}", e);
            e
        })?;
        
        println!("🔄 Database: Delete query executed, rows_affected: {}", rows_affected);
        
        if rows_affected == 0 {
            println!("❌ Database: No rows were affected - image not found");
            return Err(anyhow::anyhow!("Image not found"));
        }
        
        println!("✅ Database: Image deleted successfully from database");
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
    
    // Problem connection functions
    pub fn search_problems_by_title(&self, query: &str, limit: i32, exclude_id: Option<&str>) -> anyhow::Result<Vec<FrontendProblem>> {
        let search_pattern = format!("%{}%", query.to_lowercase());
        
        // Check if related_problem_ids column exists for backward compatibility
        let has_related_column = self.has_related_problem_ids_column();
        let related_column_sql = if has_related_column { "related_problem_ids" } else { "NULL as related_problem_ids" };
        
        let (sql, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(exclude_id) = exclude_id {
            (
                format!("SELECT id, title, description, difficulty, topic, leetcode_url, constraints, hints, {}, created_at 
                         FROM problems 
                         WHERE LOWER(title) LIKE ?1 AND id != ?2 
                         ORDER BY title 
                         LIMIT ?3", related_column_sql),
                vec![
                    Box::new(search_pattern),
                    Box::new(exclude_id.to_string()),
                    Box::new(limit),
                ],
            )
        } else {
            (
                format!("SELECT id, title, description, difficulty, topic, leetcode_url, constraints, hints, {}, created_at 
                         FROM problems 
                         WHERE LOWER(title) LIKE ?1 
                         ORDER BY title 
                         LIMIT ?2", related_column_sql),
                vec![
                    Box::new(search_pattern),
                    Box::new(limit),
                ],
            )
        };
        
        let mut stmt = self.connection.prepare(&sql)?;
        
        let problem_iter = stmt.query_map(
            rusqlite::params_from_iter(params.iter().map(|v| v.as_ref())),
            |row| {
                let db_problem = Problem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    difficulty: row.get(3)?,
                    topic: row.get(4)?,
                    leetcode_url: row.get(5)?,
                    constraints: row.get(6)?,
                    hints: row.get(7)?,
                    related_problem_ids: row.get(8).ok(), // Use .ok() to handle NULL gracefully
                    created_at: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
                    updated_at: row.get::<_, String>(10).ok().and_then(|s| s.parse().ok()).unwrap_or_else(|| Utc::now()),
                };
                Ok(convert_problem_to_frontend(db_problem))
            },
        )?;
        
        let mut problems = Vec::new();
        for problem in problem_iter {
            problems.push(problem?);
        }
        
        Ok(problems)
    }
    
    pub fn add_problem_relation(&mut self, problem_id: &str, related_problem_id: &str) -> anyhow::Result<()> {
        // Add relation to the first problem
        self.add_relation_to_problem(problem_id, related_problem_id)?;
        
        // Add bidirectional relation to the second problem
        self.add_relation_to_problem(related_problem_id, problem_id)?;
        
        Ok(())
    }
    
    pub fn remove_problem_relation(&mut self, problem_id: &str, related_problem_id: &str) -> anyhow::Result<()> {
        // Remove relation from the first problem
        self.remove_relation_from_problem(problem_id, related_problem_id)?;
        
        // Remove bidirectional relation from the second problem
        self.remove_relation_from_problem(related_problem_id, problem_id)?;
        
        Ok(())
    }
    
    pub fn get_related_problems(&self, problem_id: &str) -> anyhow::Result<Vec<FrontendProblem>> {
        // Get the problem to access its related_problem_ids
        if let Some(problem) = self.get_problem_by_id(problem_id)? {
            if problem.related_problem_ids.is_empty() {
                return Ok(Vec::new());
            }
            
            // Build query to get all related problems
            let placeholders = problem.related_problem_ids.iter()
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(", ");
            
            let sql = format!(
                "SELECT id, title, description, difficulty, topic, leetcode_url, constraints, hints, related_problem_ids, created_at 
                 FROM problems 
                 WHERE id IN ({}) 
                 ORDER BY title",
                placeholders
            );
            
            let mut stmt = self.connection.prepare(&sql)?;
            
            let params: Vec<&dyn rusqlite::ToSql> = problem.related_problem_ids.iter()
                .map(|id| id as &dyn rusqlite::ToSql)
                .collect();
                
            let problem_iter = stmt.query_map(params.as_slice(), |row| {
                let db_problem = Problem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    difficulty: row.get(3)?,
                    topic: row.get(4)?,
                    leetcode_url: row.get(5)?,
                    constraints: row.get(6)?,
                    hints: row.get(7)?,
                    related_problem_ids: row.get(8)?,
                    created_at: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
                    updated_at: row.get::<_, String>(10).ok().and_then(|s| s.parse().ok()).unwrap_or_else(|| Utc::now()),
                };
                Ok(convert_problem_to_frontend(db_problem))
            })?;
            
            let mut related_problems = Vec::new();
            for problem in problem_iter {
                related_problems.push(problem?);
            }
            
            Ok(related_problems)
        } else {
            Err(anyhow::anyhow!("Problem with id '{}' not found", problem_id))
        }
    }
    
    // Helper functions for managing relations
    fn add_relation_to_problem(&mut self, problem_id: &str, new_related_id: &str) -> anyhow::Result<()> {
        if let Some(mut problem) = self.get_problem_by_id(problem_id)? {
            // Check if relation already exists
            if !problem.related_problem_ids.contains(&new_related_id.to_string()) {
                problem.related_problem_ids.push(new_related_id.to_string());
                
                // Update the problem in database
                let update_req = UpdateProblemRequest {
                    id: problem_id.to_string(),
                    title: None,
                    description: None,
                    difficulty: None,
                    topic: None,
                    leetcode_url: None,
                    constraints: None,
                    hints: None,
                    related_problem_ids: Some(problem.related_problem_ids),
                };
                
                self.update_problem(update_req)?;
            }
        }
        Ok(())
    }
    
    fn remove_relation_from_problem(&mut self, problem_id: &str, related_id_to_remove: &str) -> anyhow::Result<()> {
        if let Some(mut problem) = self.get_problem_by_id(problem_id)? {
            // Remove the relation if it exists
            problem.related_problem_ids.retain(|id| id != related_id_to_remove);
            
            // Update the problem in database
            let update_req = UpdateProblemRequest {
                id: problem_id.to_string(),
                title: None,
                description: None,
                difficulty: None,
                topic: None,
                leetcode_url: None,
                constraints: None,
                hints: None,
                related_problem_ids: Some(problem.related_problem_ids),
            };
            
            self.update_problem(update_req)?;
        }
        Ok(())
    }

    // Search operations for Name/Topic/Tags system
    pub fn search_problems_by_topic(&self, query: &str) -> anyhow::Result<Vec<FrontendProblem>> {
        let search_pattern = format!("%{}%", query.to_lowercase());
        
        // Check if related_problem_ids column exists for backward compatibility
        let has_related_column = self.has_related_problem_ids_column();
        let related_column_sql = if has_related_column { "related_problem_ids" } else { "NULL as related_problem_ids" };
        
        let sql = format!("SELECT id, title, description, difficulty, topic, leetcode_url, constraints, hints, {}, created_at 
                          FROM problems 
                          WHERE LOWER(topic) LIKE ?1 
                          ORDER BY title 
                          LIMIT 50", related_column_sql);
        
        let mut stmt = self.connection.prepare(&sql)?;
        let problem_iter = stmt.query_map([search_pattern], |row| {
            let problem = Problem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                difficulty: row.get(3)?,
                topic: row.get(4)?,
                leetcode_url: row.get(5)?,
                constraints: row.get(6)?,
                hints: row.get(7)?,
                related_problem_ids: row.get(8)?,
                created_at: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
                updated_at: row.get::<_, String>(10).ok().and_then(|s| s.parse().ok()).unwrap_or_else(|| Utc::now()),
            };
            Ok(convert_problem_to_frontend(problem))
        })?;

        let mut problems = Vec::new();
        for problem in problem_iter {
            problems.push(problem?);
        }

        Ok(problems)
    }

    pub fn search_problems_by_tags(&self, query: &str) -> anyhow::Result<Vec<FrontendProblem>> {
        let search_pattern = format!("%{}%", query.to_lowercase());
        println!("DEBUG: Tag search query: '{}', pattern: '{}'", query, search_pattern);
        
        // Check if related_problem_ids column exists for backward compatibility
        let has_related_column = self.has_related_problem_ids_column();
        let related_column_sql = if has_related_column { "related_problem_ids" } else { "NULL as related_problem_ids" };
        
        // Search in problem_tags table (normalized tags)
        let sql = format!("SELECT DISTINCT p.id, p.title, p.description, p.difficulty, p.topic, p.leetcode_url, p.constraints, p.hints, {}, p.created_at 
                          FROM problems p
                          INNER JOIN problem_tags pt ON p.id = pt.problem_id
                          INNER JOIN tags t ON pt.tag_id = t.id
                          WHERE LOWER(t.name) LIKE ?1
                          ORDER BY p.title 
                          LIMIT 50", related_column_sql);
        
        println!("DEBUG: Executing SQL: {}", sql);
        
        // Debug: Check if the tag exists at all
        let tag_exists: Option<String> = self.connection.query_row(
            "SELECT name FROM tags WHERE LOWER(name) LIKE ?1",
            [&search_pattern],
            |row| Ok(row.get::<_, String>(0)?)
        ).optional()?;
        println!("DEBUG: Tag exists check: {:?}", tag_exists);
        
        // Debug: Check problem_tags relationships
        let relationship_count: i32 = self.connection.query_row(
            "SELECT COUNT(*) FROM problem_tags pt INNER JOIN tags t ON pt.tag_id = t.id WHERE LOWER(t.name) LIKE ?1",
            [&search_pattern],
            |row| Ok(row.get(0)?)
        )?;
        println!("DEBUG: Problem-tag relationships found: {}", relationship_count);
        
        let mut stmt = self.connection.prepare(&sql)?;
        let problem_iter = stmt.query_map([&search_pattern], |row| {
            let problem = Problem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                difficulty: row.get(3)?,
                topic: row.get(4)?,
                leetcode_url: row.get(5)?,
                constraints: row.get(6)?,
                hints: row.get(7)?,
                related_problem_ids: row.get(8)?,
                created_at: row.get::<_, String>(9)?.parse().unwrap_or_else(|_| Utc::now()),
                updated_at: row.get::<_, String>(10).ok().and_then(|s| s.parse().ok()).unwrap_or_else(|| Utc::now()),
            };
            Ok(convert_problem_to_frontend(problem))
        })?;

        let mut problems = Vec::new();
        for problem in problem_iter {
            problems.push(problem?);
        }

        println!("DEBUG: Tag search found {} problems", problems.len());
        for problem in &problems {
            println!("DEBUG: Found problem: {} (ID: {})", problem.title, problem.id);
        }

        Ok(problems)
    }

    pub fn get_title_suggestions(&self, query: &str) -> anyhow::Result<Vec<String>> {
        let search_pattern = format!("%{}%", query.to_lowercase());
        
        let sql = "SELECT DISTINCT title 
                   FROM problems 
                   WHERE LOWER(title) LIKE ?1 
                   ORDER BY title 
                   LIMIT 10";
        
        let mut stmt = self.connection.prepare(sql)?;
        let suggestion_iter = stmt.query_map([search_pattern], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let mut suggestions = Vec::new();
        for suggestion in suggestion_iter {
            suggestions.push(suggestion?);
        }

        Ok(suggestions)
    }

    pub fn get_topic_suggestions(&self, query: &str) -> anyhow::Result<Vec<String>> {
        let search_pattern = format!("%{}%", query.to_lowercase());
        
        // Since topic is stored as JSON array, we need to search within the JSON content
        let sql = "SELECT DISTINCT topic 
                   FROM problems 
                   WHERE LOWER(topic) LIKE ?1 AND topic IS NOT NULL AND topic != '[]'
                   ORDER BY topic 
                   LIMIT 10";
        
        let mut stmt = self.connection.prepare(sql)?;
        let topic_iter = stmt.query_map([search_pattern], |row| {
            let topic_json: String = row.get(0)?;
            Ok(topic_json)
        })?;

        let mut suggestions = Vec::new();
        for topic_result in topic_iter {
            let topic_json = topic_result?;
            // Parse JSON array and extract individual topics
            let topics: Vec<String> = parse_json_array(&topic_json);
            for topic in topics {
                if topic.to_lowercase().contains(&query.to_lowercase()) && !suggestions.contains(&topic) {
                    suggestions.push(topic);
                    if suggestions.len() >= 10 {
                        break;
                    }
                }
            }
            if suggestions.len() >= 10 {
                break;
            }
        }

        Ok(suggestions)
    }

    // Solution Card Methods
    
    /// Get the solution card for a specific problem
    pub fn get_solution_card(&self, problem_id: &str) -> anyhow::Result<Option<SolutionCard>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, problem_id, card_number, code, language, notes, status, 
                    total_duration, created_at, last_modified, is_solution
             FROM cards 
             WHERE problem_id = ? AND is_solution = 1
             LIMIT 1"
        )?;

        let card_iter = stmt.query_map(params![problem_id], |row| {
            Ok(SolutionCard {
                id: row.get("id")?,
                problem_id: row.get("problem_id")?,
                card_number: row.get("card_number")?,
                code: row.get("code")?,
                language: row.get("language")?,
                notes: row.get("notes")?,
                status: row.get("status")?,
                total_duration: row.get("total_duration")?,
                created_at: row.get("created_at")?,
                last_modified: row.get("last_modified")?,
                is_solution: row.get::<_, i32>("is_solution")? == 1,
            })
        })?;

        for card_result in card_iter {
            return Ok(Some(card_result?));
        }

        Ok(None)
    }

    /// Create a new solution card for a problem
    pub fn create_solution_card(&self, problem_id: &str) -> anyhow::Result<SolutionCard> {
        let card_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        // Insert the solution card
        self.connection.execute(
            "INSERT INTO cards (
                id, problem_id, card_number, code, language, notes, status,
                total_duration, created_at, last_modified, is_solution
             ) VALUES (?, ?, 0, '', 'javascript', '', 'In Progress', 0, ?, ?, 1)",
            params![card_id, problem_id, now, now]
        )?;

        // Return the created card
        Ok(SolutionCard {
            id: card_id,
            problem_id: problem_id.to_string(),
            card_number: 0, // Solution cards have card_number 0
            code: String::new(),
            language: "javascript".to_string(),
            notes: String::new(),
            status: "In Progress".to_string(),
            total_duration: 0,
            created_at: now.clone(),
            last_modified: now,
            is_solution: true,
        })
    }

    /// Update solution card code
    pub fn update_solution_card_code(&self, card_id: &str, code: &str, language: &str) -> anyhow::Result<()> {
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        self.connection.execute(
            "UPDATE cards 
             SET code = ?, language = ?, last_modified = ?
             WHERE id = ? AND is_solution = 1",
            params![code, language, now, card_id]
        )?;

        Ok(())
    }

    /// Update solution card notes
    pub fn update_solution_card_notes(&self, card_id: &str, notes: &str) -> anyhow::Result<()> {
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        self.connection.execute(
            "UPDATE cards 
             SET notes = ?, last_modified = ?
             WHERE id = ? AND is_solution = 1",
            params![notes, now, card_id]
        )?;

        Ok(())
    }

    /// Check if a solution card exists for a problem
    pub fn solution_card_exists(&self, problem_id: &str) -> anyhow::Result<bool> {
        let mut stmt = self.connection.prepare(
            "SELECT COUNT(*) as count FROM cards WHERE problem_id = ? AND is_solution = 1"
        )?;

        let count: i32 = stmt.query_row(params![problem_id], |row| {
            row.get("count")
        })?;

        Ok(count > 0)
    }

    /// Get regular (non-solution) cards for a problem
    /// This is useful for the normal card navigation to exclude solution cards
    pub fn get_regular_cards(&self, problem_id: &str) -> anyhow::Result<Vec<SolutionCard>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, problem_id, card_number, code, language, notes, status, 
                    total_duration, created_at, last_modified, COALESCE(is_solution, 0) as is_solution
             FROM cards 
             WHERE problem_id = ? AND (is_solution IS NULL OR is_solution = 0)
             ORDER BY card_number ASC"
        )?;

        let card_iter = stmt.query_map(params![problem_id], |row| {
            Ok(SolutionCard {
                id: row.get("id")?,
                problem_id: row.get("problem_id")?,
                card_number: row.get("card_number")?,
                code: row.get("code")?,
                language: row.get("language")?,
                notes: row.get("notes")?,
                status: row.get("status")?,
                total_duration: row.get("total_duration")?,
                created_at: row.get("created_at")?,
                last_modified: row.get("last_modified")?,
                is_solution: row.get::<_, i32>("is_solution")? == 1,
            })
        })?;

        let mut cards = Vec::new();
        for card_result in card_iter {
            cards.push(card_result?);
        }

        Ok(cards)
    }

    /// Delete a problem and all its related data
    /// Performs cascading deletion in proper order to maintain referential integrity
    pub fn delete_problem(&mut self, problem_id: &str) -> anyhow::Result<()> {
        println!("🗑️ [Database] Starting delete operation for problem: {}", problem_id);
        
        // First, verify the problem exists
        let problem = self.get_problem_by_id(problem_id)?;
        if problem.is_none() {
            return Err(anyhow::anyhow!("Problem with id '{}' not found", problem_id));
        }
        
        let problem = problem.unwrap();
        println!("🗑️ [Database] Confirmed problem exists: '{}'", problem.title);

        // Begin transaction for atomic deletion
        let tx = self.connection.unchecked_transaction()?;
        println!("🗑️ [Database] Transaction started for cascading deletion");

        // Step 1: Get all cards for this problem to delete their related data
        println!("🔍 [Database] Finding all cards for problem...");
        let card_ids: Vec<String> = tx.prepare(
            "SELECT id FROM cards WHERE problem_id = ?1"
        )?
        .query_map([problem_id], |row| Ok(row.get::<_, String>(0)?))?
        .collect::<Result<Vec<String>, _>>()?;
        
        println!("🗑️ [Database] Found {} cards to delete", card_ids.len());

        // Step 2: Delete time sessions for all cards
        for card_id in &card_ids {
            let sessions_deleted = tx.execute(
                "DELETE FROM time_sessions WHERE card_id = ?1",
                [card_id],
            ).unwrap_or(0);
            if sessions_deleted > 0 {
                println!("🗑️ [Database] Deleted {} time sessions for card {}", sessions_deleted, card_id);
            }
        }

        // Step 3: Delete recordings for all cards
        for card_id in &card_ids {
            let recordings_deleted = tx.execute(
                "DELETE FROM recordings WHERE card_id = ?1",
                [card_id],
            ).unwrap_or(0);
            if recordings_deleted > 0 {
                println!("🗑️ [Database] Deleted {} recordings for card {}", recordings_deleted, card_id);
            }
        }

        // Step 4: Delete connections where any of these cards are source or target
        for card_id in &card_ids {
            let connections_deleted = tx.execute(
                "DELETE FROM connections WHERE source_card_id = ?1 OR target_card_id = ?1",
                [card_id],
            ).unwrap_or(0);
            if connections_deleted > 0 {
                println!("🗑️ [Database] Deleted {} connections for card {}", connections_deleted, card_id);
            }
        }

        // Step 5: Delete card tags for all cards
        for card_id in &card_ids {
            let card_tags_deleted = tx.execute(
                "DELETE FROM card_tags WHERE card_id = ?1",
                [card_id],
            ).unwrap_or(0);
            if card_tags_deleted > 0 {
                println!("🗑️ [Database] Deleted {} card tags for card {}", card_tags_deleted, card_id);
            }
        }

        // Step 6: Delete all cards for this problem
        let cards_deleted = tx.execute(
            "DELETE FROM cards WHERE problem_id = ?1",
            [problem_id],
        )?;
        println!("🗑️ [Database] Deleted {} cards for problem", cards_deleted);

        // Step 7: Delete problem images
        let images_deleted = tx.execute(
            "DELETE FROM problem_images WHERE problem_id = ?1",
            [problem_id],
        ).unwrap_or(0);
        if images_deleted > 0 {
            println!("🗑️ [Database] Deleted {} problem images", images_deleted);
        }

        // Step 8: Delete problem tags relationships
        let problem_tags_deleted = tx.execute(
            "DELETE FROM problem_tags WHERE problem_id = ?1",
            [problem_id],
        ).unwrap_or(0);
        if problem_tags_deleted > 0 {
            println!("🗑️ [Database] Deleted {} problem tag relationships", problem_tags_deleted);
        }

        // Step 9: Remove this problem from other problems' related_problem_ids
        // This is complex due to JSON storage, so we'll update all problems that might reference this one
        println!("🔍 [Database] Removing problem from related_problem_ids in other problems...");
        if self.has_related_problem_ids_column() {
            // Get all problems that might have this problem in their related_problem_ids
            let mut stmt = tx.prepare(
                "SELECT id, related_problem_ids FROM problems WHERE related_problem_ids IS NOT NULL AND related_problem_ids LIKE ?"
            )?;
            
            let problem_pattern = format!("%{}%", problem_id);
            let problems_to_update: Vec<(String, String)> = stmt.query_map([&problem_pattern], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?.collect::<Result<Vec<_>, _>>()?;

            for (id, related_ids_json) in problems_to_update {
                if let Ok(mut related_ids) = serde_json::from_str::<Vec<String>>(&related_ids_json) {
                    if related_ids.contains(&problem_id.to_string()) {
                        related_ids.retain(|id| id != problem_id);
                        let updated_json = serde_json::to_string(&related_ids).unwrap_or_else(|_| "[]".to_string());
                        
                        tx.execute(
                            "UPDATE problems SET related_problem_ids = ?1 WHERE id = ?2",
                            params![updated_json, id]
                        )?;
                        println!("🗑️ [Database] Removed problem reference from problem {}", id);
                    }
                }
            }
        }

        // Step 10: Finally, delete the problem itself
        let rows_affected = tx.execute(
            "DELETE FROM problems WHERE id = ?1",
            [problem_id],
        )?;

        if rows_affected == 0 {
            println!("❌ [Database] Failed to delete problem - no rows affected");
            return Err(anyhow::anyhow!("Failed to delete problem - no rows affected"));
        }

        // Commit the transaction
        tx.commit()?;
        println!("✅ [Database] Successfully deleted problem '{}' and all related data", problem.title);
        
        Ok(())
    }

    pub fn delete_problem_with_files(&mut self, problem_id: &str) -> anyhow::Result<()> {
        println!("🗑️ [Database] Starting delete operation with file cleanup for problem: {}", problem_id);
        
        // First, verify the problem exists
        let problem = self.get_problem_by_id(problem_id)?;
        if problem.is_none() {
            return Err(anyhow::anyhow!("Problem with id '{}' not found", problem_id));
        }
        
        let problem = problem.unwrap();
        println!("🗑️ [Database] Confirmed problem exists: '{}'", problem.title);

        // Step 1: Get all files that need to be deleted before starting database transaction
        let mut files_to_delete = Vec::new();
        
        // Get audio recording files
        let recording_files: Vec<String> = self.connection.prepare(
            "SELECT DISTINCT filepath FROM recordings r 
             JOIN cards c ON r.card_id = c.id 
             WHERE c.problem_id = ?1"
        )?
        .query_map([problem_id], |row| Ok(row.get::<_, String>(0)?))?
        .collect::<Result<Vec<String>, _>>()?;
        
        files_to_delete.extend(recording_files);
        
        // Get problem image files
        let image_files: Vec<String> = self.connection.prepare(
            "SELECT image_path FROM problem_images WHERE problem_id = ?1"
        )?
        .query_map([problem_id], |row| Ok(row.get::<_, String>(0)?))?
        .collect::<Result<Vec<String>, _>>()?;
        
        files_to_delete.extend(image_files);
        
        println!("🗑️ [Database] Found {} files to delete", files_to_delete.len());

        // Step 2: Delete files from filesystem
        for file_path in &files_to_delete {
            match self.delete_file_safely(file_path) {
                Ok(_) => println!("🗑️ [Database] Deleted file: {}", file_path),
                Err(e) => println!("⚠️ [Database] Failed to delete file {}: {}", file_path, e),
            }
        }

        // Step 3: Proceed with database deletion using existing method
        self.delete_problem(problem_id)?;
        
        Ok(())
    }

    fn delete_file_safely(&self, file_path: &str) -> anyhow::Result<()> {
        use std::path::Path;
        
        // Handle different path formats (dev-data, app-data, absolute paths)
        let absolute_path = if file_path.starts_with("dev-data/") {
            let current_dir = std::env::current_dir()?;
            current_dir.join(file_path)
        } else if file_path.starts_with("app-data/") {
            // For production, we'd need to get app data directory
            // For now, assume dev mode and convert to dev-data path
            let current_dir = std::env::current_dir()?;
            current_dir.join("dev-data").join(&file_path[9..])
        } else if Path::new(file_path).is_absolute() {
            Path::new(file_path).to_path_buf()
        } else {
            // Relative path, assume it's relative to current dir
            let current_dir = std::env::current_dir()?;
            current_dir.join(file_path)
        };
        
        if absolute_path.exists() {
            std::fs::remove_file(&absolute_path)?;
            println!("✅ [Database] Deleted file: {:?}", absolute_path);
        } else {
            println!("⚠️ [Database] File not found (may already be deleted): {:?}", absolute_path);
        }
        
        Ok(())
    }

    /// Get statistics about what data will be deleted with a problem
    pub fn get_problem_delete_stats(&self, problem_id: &str) -> anyhow::Result<Option<crate::models::ProblemDeleteStats>> {
        println!("📊 [Database] Getting delete stats for problem: {}", problem_id);
        
        // First verify the problem exists
        let problem_exists: i32 = self.connection.query_row(
            "SELECT COUNT(*) FROM problems WHERE id = ?1",
            [problem_id],
            |row| row.get(0)
        )?;
        
        if problem_exists == 0 {
            println!("❌ [Database] Problem not found: {}", problem_id);
            return Ok(None);
        }

        // Get card counts
        let (total_cards, main_cards, child_cards): (i32, i32, i32) = self.connection.query_row(
            "SELECT 
                COUNT(*) as total_cards,
                COUNT(CASE WHEN parent_card_id IS NULL THEN 1 END) as main_cards,
                COUNT(CASE WHEN parent_card_id IS NOT NULL THEN 1 END) as child_cards
             FROM cards 
             WHERE problem_id = ?1",
            [problem_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        )?;

        // Get recordings count
        let recordings_count: i32 = self.connection.query_row(
            "SELECT COUNT(DISTINCT r.id) 
             FROM recordings r
             JOIN cards c ON r.card_id = c.id 
             WHERE c.problem_id = ?1",
            [problem_id],
            |row| row.get(0)
        ).unwrap_or(0);

        // Get images count
        let images_count: i32 = self.connection.query_row(
            "SELECT COUNT(*) FROM problem_images WHERE problem_id = ?1",
            [problem_id],
            |row| row.get(0)
        ).unwrap_or(0);

        // Get total duration from time sessions
        let total_duration: i32 = self.connection.query_row(
            "SELECT COALESCE(SUM(duration), 0)
             FROM time_sessions ts
             JOIN cards c ON ts.card_id = c.id
             WHERE c.problem_id = ?1 AND ts.duration IS NOT NULL",
            [problem_id],
            |row| row.get(0)
        ).unwrap_or(0);

        let stats = crate::models::ProblemDeleteStats {
            total_cards,
            main_cards,
            child_cards,
            recordings_count,
            images_count,
            total_duration,
        };

        println!("📊 [Database] Delete stats for {}: {} cards ({} main, {} child), {} recordings, {} images, {}s total duration", 
                 problem_id, stats.total_cards, stats.main_cards, stats.child_cards, 
                 stats.recordings_count, stats.images_count, stats.total_duration);

        Ok(Some(stats))
    }

    /// Get recording file paths for a specific problem
    pub fn get_recording_files_for_problem(&self, problem_id: &str) -> anyhow::Result<Vec<String>> {
        let recording_files: Vec<String> = self.connection.prepare(
            "SELECT DISTINCT filepath FROM recordings r 
             JOIN cards c ON r.card_id = c.id 
             WHERE c.problem_id = ?1"
        )?
        .query_map([problem_id], |row| Ok(row.get::<_, String>(0)?))?
        .collect::<Result<Vec<String>, _>>()?;
        
        Ok(recording_files)
    }

    /// Get image file paths for a specific problem
    pub fn get_image_files_for_problem(&self, problem_id: &str) -> anyhow::Result<Vec<String>> {
        let image_files: Vec<String> = self.connection.prepare(
            "SELECT image_path FROM problem_images WHERE problem_id = ?1"
        )?
        .query_map([problem_id], |row| Ok(row.get::<_, String>(0)?))?
        .collect::<Result<Vec<String>, _>>()?;
        
        Ok(image_files)
    }
}
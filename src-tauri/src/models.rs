use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::database::DatabaseManager;

// App state shared across Tauri commands
pub struct AppState {
    pub db: Arc<Mutex<DatabaseManager>>,
}

// Database models matching the frontend types
#[derive(Debug, Serialize, Deserialize)]
pub struct Problem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub difficulty: String, // 'Easy', 'Medium', 'Hard'
    pub category: String,   // JSON string for array
    pub leetcode_url: Option<String>,
    pub constraints: String, // JSON string for array
    pub examples: String,    // JSON string for array
    pub hints: String,       // JSON string for array
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    pub problem_id: String,
    pub card_number: i32,
    pub code: Option<String>,
    pub language: String,
    pub notes: Option<String>,
    pub status: String, // 'In Progress', 'Completed', 'Paused'
    pub total_duration: i32, // in seconds
    pub created_at: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,
    pub parent_card_id: Option<String>,
}

// Request/Response models
#[derive(Debug, Deserialize)]
pub struct CreateProblemRequest {
    pub title: String,
    pub description: String,
    pub difficulty: String,
    pub category: Vec<String>,
    pub leetcode_url: Option<String>,
    pub constraints: Vec<String>,
    pub examples: Vec<serde_json::Value>,
    pub hints: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCardRequest {
    pub problem_id: String,
    pub language: Option<String>,
    pub parent_card_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCardRequest {
    pub id: String,
    pub code: Option<String>,
    pub language: Option<String>,
    pub notes: Option<String>,
    pub status: Option<String>,
}
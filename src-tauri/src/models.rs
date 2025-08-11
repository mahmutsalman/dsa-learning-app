use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::database::DatabaseManager;

// App state shared across Tauri commands
pub struct AppState {
    pub db: Arc<Mutex<DatabaseManager>>,
    pub current_timer: Arc<Mutex<Option<TimerSession>>>,
}

// Database models matching the frontend types
#[derive(Debug, Serialize, Deserialize)]
pub struct Problem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub difficulty: String, // 'Easy', 'Medium', 'Hard'
    pub topic: String,   // JSON string for array
    pub leetcode_url: Option<String>,
    pub constraints: String, // JSON string for array
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
    pub topic: Vec<String>,
    pub leetcode_url: Option<String>,
    pub constraints: Vec<String>,
    pub hints: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProblemRequest {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub difficulty: Option<String>,
    pub topic: Option<Vec<String>>,
    pub leetcode_url: Option<String>,
    pub constraints: Option<Vec<String>>,
    pub hints: Option<Vec<String>>,
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

// Database analysis structs
#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub problem_count: i32,
    pub total_cards: i32,
    pub main_cards: i32,
    pub child_cards: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CardHierarchy {
    pub card_id: String,
    pub problem_id: String,
    pub problem_title: String,
    pub card_number: i32,
    pub parent_card_id: Option<String>,
    pub child_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CardCountPerProblem {
    pub problem_id: String,
    pub problem_title: String,
    pub total_cards: i32,
    pub main_cards: i32,
    pub child_cards: i32,
}

// Problem images model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProblemImage {
    pub id: String,
    pub problem_id: String,
    pub image_path: String,
    pub caption: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

// Request models for image operations
#[derive(Debug, Deserialize)]
pub struct SaveImageRequest {
    pub problem_id: String,
    pub image_data: String, // Base64 encoded image data
    pub caption: Option<String>,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteImageRequest {
    pub image_id: String,
}

// Additional models for timer sessions and recordings
#[derive(Debug, Serialize, Deserialize)]
pub struct TimeSession {
    pub id: String,
    pub card_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration: Option<i32>,
    pub date: String,
    pub is_active: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Recording {
    pub id: String,
    pub card_id: String,
    pub time_session_id: Option<String>,
    pub audio_url: String,
    pub duration: Option<i32>,
    pub transcript: Option<String>,
    pub created_at: DateTime<Utc>,
    pub filename: String,
    pub filepath: String,
    pub file_size: Option<i64>,
}

// Tag models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub category: String, // 'algorithm', 'data-structure', 'pattern', 'custom'
}

// Tag request/response models
#[derive(Debug, Deserialize)]
pub struct AddProblemTagRequest {
    pub problem_id: String,
    pub tag_name: String,
    pub color: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RemoveProblemTagRequest {
    pub problem_id: String,
    pub tag_id: String,
}

#[derive(Debug, Deserialize)]
pub struct GetTagSuggestionsRequest {
    pub query: String,
    pub limit: Option<i32>,
}

// Timer-specific models for in-memory timer state
#[derive(Debug, Serialize, Deserialize)]
pub struct TimerState {
    #[serde(rename = "isRunning")]
    pub is_running: bool,
    #[serde(rename = "isPaused")]
    pub is_paused: bool,
    #[serde(rename = "currentSessionId")]
    pub current_session_id: Option<String>,
    #[serde(rename = "sessionStartTime")]
    pub session_start_time: Option<DateTime<Utc>>,
    #[serde(rename = "elapsedTime")]
    pub elapsed_time: i32, // in seconds
}

#[derive(Debug, Clone)]
pub struct TimerSession {
    pub id: String,
    pub card_id: String,
    pub start_time: DateTime<Utc>,
    pub is_paused: bool,
    pub pause_duration: i32, // in seconds
}
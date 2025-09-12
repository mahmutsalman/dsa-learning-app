use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::database::DatabaseManager;
use crate::path_resolver::PathResolver;

// Audio command types (moved here to avoid circular dependency)
#[derive(Debug)]
pub enum AudioCommand {
    StartRecording {
        filepath: String,
        sample_rate: u32,
        channels: u16,
    },
    StopRecording,
    PauseRecording,
    ResumeRecording,
    RefreshDevices,
    SwitchDevice {
        device_name: String,
    },
}

// Audio device information for UI display
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioDevice {
    pub name: String,
    pub is_default: bool,
    pub is_current: bool,
}

// Audio device list response
#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDeviceList {
    pub devices: Vec<AudioDevice>,
    pub current_device: Option<String>,
}

// App state shared across Tauri commands
pub struct AppState {
    pub db: Arc<Mutex<DatabaseManager>>,
    pub current_timer: Arc<Mutex<Option<TimerSession>>>,
    pub recording_state: Arc<Mutex<Option<RecordingSession>>>,
    pub audio_thread_sender: Arc<Mutex<Option<mpsc::Sender<AudioCommand>>>>,
    pub path_resolver: Arc<PathResolver>,
}

// Recording session state (without the non-Send cpal Stream)
#[derive(Debug, Clone)]
pub struct RecordingSession {
    pub id: String,
    pub card_id: String,
    pub start_time: DateTime<Utc>,
    pub is_paused: bool,
    pub filename: String,
    pub filepath: String,
}

// Database models matching the database schema
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
    pub related_problem_ids: Option<String>, // JSON string for array of problem IDs
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Frontend-compatible version with parsed arrays
#[derive(Debug, Serialize, Deserialize)]
pub struct FrontendProblem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub difficulty: String, // 'Easy', 'Medium', 'Hard'
    pub topic: Vec<String>,
    pub leetcode_url: Option<String>,
    pub constraints: Vec<String>,
    pub hints: Vec<String>,
    pub related_problem_ids: Vec<String>, // Array of related problem IDs
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tags: Vec<String>, // For compatibility with frontend expectations
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
    pub related_problem_ids: Option<Vec<String>>,
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
    pub related_problem_ids: Option<Vec<String>>,
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

// Solution card model - special type of card for storing problem solutions
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SolutionCard {
    pub id: String,
    pub problem_id: String,
    pub card_number: i32,
    pub code: String,
    pub language: String,
    pub notes: String,
    pub status: String,
    pub total_duration: i32,
    pub created_at: String,
    pub last_modified: String,
    pub is_solution: bool,
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

// Recording-specific models for in-memory recording state
#[derive(Debug, Serialize, Deserialize)]
pub struct RecordingState {
    #[serde(rename = "isRecording")]
    pub is_recording: bool,
    #[serde(rename = "isPaused")]
    pub is_paused: bool,
    #[serde(rename = "currentRecordingId")]
    pub current_recording_id: Option<String>,
    #[serde(rename = "recordingStartTime")]
    pub recording_start_time: Option<DateTime<Utc>>,
    #[serde(rename = "elapsedRecordingTime")]
    pub elapsed_recording_time: i32, // in seconds
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordingInfo {
    pub filename: String,
    pub filepath: String,
}

// TXT Import system models
#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub success: bool,
    pub imported_count: i32,
    pub skipped_count: i32,
    pub error_count: i32,
    pub duplicates: Vec<String>,
    pub errors: Vec<ImportError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportError {
    pub line: i32,
    pub field: Option<String>,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Clone)]
pub struct ParsedProblem {
    pub title: String,
    pub description: String,
    pub difficulty: String,
    pub topics: Vec<String>,
    pub tags: Vec<String>,
    pub leetcode_url: Option<String>,
    pub constraints: Vec<String>,
    pub hints: Vec<String>,
}

impl ParsedProblem {
    pub fn new() -> Self {
        Self {
            title: String::new(),
            description: String::new(),
            difficulty: String::new(),
            topics: Vec::new(),
            tags: Vec::new(),
            leetcode_url: None,
            constraints: Vec::new(),
            hints: Vec::new(),
        }
    }
}

// Problem deletion stats
#[derive(Debug, Serialize, Deserialize)]
pub struct ProblemDeleteStats {
    pub total_cards: i32,
    pub main_cards: i32,
    pub child_cards: i32,
    pub recordings_count: i32,
    pub images_count: i32,
    pub total_duration: i32, // in seconds
}

// Dashboard statistics models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardStats {
    pub total_problems: i32,
    pub total_study_time: i32, // in seconds
    pub problems_worked_today: i32,
    pub completed_problems: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProblemsWorkedTodayResponse {
    pub count: i32,
    pub date: String, // ISO date string (YYYY-MM-DD)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyWorkStats {
    pub problems_worked: i32,
    pub total_study_time_today: i32, // in seconds
    pub date: String, // ISO date string (YYYY-MM-DD)
}
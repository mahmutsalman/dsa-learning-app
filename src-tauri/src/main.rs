// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::collections::HashMap;
use std::sync::Mutex;
use chrono::Utc;

// Simple in-memory storage for now (will be replaced with SQLite later)
static PROBLEMS: Mutex<Option<HashMap<String, serde_json::Value>>> = Mutex::new(None);
static CARDS: Mutex<Option<HashMap<String, serde_json::Value>>> = Mutex::new(None);

// Initialize the app with mock data
#[tauri::command]
fn init_database() -> Result<String, String> {
    println!("Initializing database...");
    
    // Initialize problems
    let mut problems = PROBLEMS.lock().unwrap();
    if problems.is_none() {
        println!("Creating problems data...");
        let mut data = HashMap::new();
        
        data.insert("1".to_string(), serde_json::json!({
            "id": "1",
            "title": "Two Sum",
            "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
            "difficulty": "Easy",
            "category": ["Array", "Hash Table"],
            "leetcode_url": "https://leetcode.com/problems/two-sum/",
            "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
            "examples": [{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]"}],
            "hints": ["Use a hash map to store complements"],
            "created_at": "2024-01-01T00:00:00Z"
        }));
        
        data.insert("2".to_string(), serde_json::json!({
            "id": "2",
            "title": "Add Two Numbers",
            "description": "You are given two non-empty linked lists representing two non-negative integers.",
            "difficulty": "Medium",
            "category": ["Linked List", "Math"],
            "leetcode_url": "https://leetcode.com/problems/add-two-numbers/",
            "constraints": ["1 <= l1.length, l2.length <= 100", "0 <= Node.val <= 9"],
            "examples": [{"input": "l1 = [2,4,3], l2 = [5,6,4]", "output": "[7,0,8]"}],
            "hints": ["Handle carry-over carefully"],
            "created_at": "2024-01-01T00:00:00Z"
        }));
        
        *problems = Some(data);
        println!("Problems initialized with {} items", 2);
    }
    
    // Initialize cards storage
    let mut cards = CARDS.lock().unwrap();
    if cards.is_none() {
        println!("Initializing cards storage...");
        *cards = Some(HashMap::new());
    }
    
    println!("Database initialization complete!");
    Ok("Database initialized successfully".to_string())
}

// Get all problems
#[tauri::command]
fn get_problems() -> Result<Vec<serde_json::Value>, String> {
    let problems = PROBLEMS.lock().unwrap();
    match &*problems {
        Some(data) => {
            let problem_list: Vec<serde_json::Value> = data.values().cloned().collect();
            Ok(problem_list)
        }
        None => Err("Database not initialized".to_string())
    }
}

// Get a specific problem by ID
#[tauri::command]
fn get_problem_by_id(id: String) -> Result<serde_json::Value, String> {
    let problems = PROBLEMS.lock().unwrap();
    match &*problems {
        Some(data) => {
            match data.get(&id) {
                Some(problem) => Ok(problem.clone()),
                None => Err(format!("Problem with id {} not found", id))
            }
        }
        None => Err("Database not initialized".to_string())
    }
}

// Get cards for a problem
#[tauri::command]
fn get_cards_for_problem(problem_id: String) -> Result<Vec<serde_json::Value>, String> {
    let cards = CARDS.lock().unwrap();
    match &*cards {
        Some(data) => {
            let card_list: Vec<serde_json::Value> = data.values()
                .filter(|card| {
                    card.get("problem_id")
                        .and_then(|v| v.as_str())
                        .map(|id| id == problem_id)
                        .unwrap_or(false)
                })
                .cloned()
                .collect();
            Ok(card_list)
        }
        None => {
            // Initialize empty cards if not initialized
            let mut cards_guard = CARDS.lock().unwrap();
            *cards_guard = Some(HashMap::new());
            Ok(Vec::new())
        }
    }
}

// Create a new card
#[tauri::command]
fn create_card(request: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut cards = CARDS.lock().unwrap();
    
    // Initialize cards if not exists
    if cards.is_none() {
        *cards = Some(HashMap::new());
    }
    
    let card_data = cards.as_mut().unwrap();
    
    let problem_id = request.get("problem_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing problem_id")?;
        
    let language = request.get("language")
        .and_then(|v| v.as_str())
        .unwrap_or("javascript");
    
    // Generate a simple ID (in production, use UUID)
    let card_id = format!("card_{}", card_data.len() + 1);
    
    let new_card = serde_json::json!({
        "id": card_id,
        "problem_id": problem_id,
        "card_number": card_data.len() as i32 + 1,
        "code": "",
        "language": language,
        "notes": "",
        "status": "In Progress",
        "total_duration": 0,
        "created_at": "2024-01-01T00:00:00Z",
        "last_modified": "2024-01-01T00:00:00Z",
        "parent_card_id": request.get("parent_card_id")
    });
    
    card_data.insert(card_id.clone(), new_card.clone());
    Ok(new_card)
}

// Update an existing card
#[tauri::command]
fn update_card(
    card_id: String,
    code: Option<String>,
    notes: Option<String>,
    language: Option<String>,
) -> Result<serde_json::Value, String> {
    println!("Updating card {} with code: {}, notes: {}, language: {:?}", 
             card_id, 
             code.as_ref().map(|c| c.len()).unwrap_or(0), 
             notes.as_ref().map(|n| n.len()).unwrap_or(0),
             language);
    
    let mut cards = CARDS.lock().unwrap();
    
    match cards.as_mut() {
        Some(data) => {
            match data.get_mut(&card_id) {
                Some(card) => {
                    // Update fields if provided
                    if let Some(new_code) = code {
                        card["code"] = serde_json::Value::String(new_code);
                    }
                    if let Some(new_notes) = notes {
                        card["notes"] = serde_json::Value::String(new_notes);
                    }
                    if let Some(new_language) = language {
                        card["language"] = serde_json::Value::String(new_language);
                    }
                    
                    // Update timestamp
                    let now = Utc::now();
                    card["last_modified"] = serde_json::Value::String(now.to_rfc3339());
                    
                    println!("Card updated successfully: {}", card_id);
                    Ok(card.clone())
                }
                None => {
                    let error = format!("Card with id {} not found", card_id);
                    println!("Error: {}", error);
                    Err(error)
                }
            }
        }
        None => {
            let error = "Database not initialized".to_string();
            println!("Error: {}", error);
            Err(error)
        }
    }
}

// Simple greet command for testing
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to DSA Learning App!", name)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            init_database,
            get_problems,
            get_problem_by_id,
            get_cards_for_problem,
            create_card,
            update_card
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
// Simplified main.rs for database testing
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod models;

use tauri::Manager;
use std::sync::{Arc, Mutex};
use models::{AppState, DatabaseStats, CardHierarchy, CardCountPerProblem};
use database::DatabaseManager;

// Simplified database analysis commands
#[tauri::command]
async fn get_database_stats(state: tauri::State<'_, AppState>) -> Result<DatabaseStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_database_stats().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_card_hierarchy(state: tauri::State<'_, AppState>) -> Result<Vec<CardHierarchy>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_card_hierarchy().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_cards_per_problem(state: tauri::State<'_, AppState>) -> Result<Vec<CardCountPerProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_cards_per_problem().map_err(|e| e.to_string())
}

#[tokio::main]
async fn main() {
    // Initialize database
    let db_manager = DatabaseManager::new().await
        .expect("Failed to initialize database");
    
    let app_state = AppState {
        db: Arc::new(Mutex::new(db_manager)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_database_stats,
            get_card_hierarchy,
            get_cards_per_problem
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
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod models;

use tauri::Manager;
use std::sync::{Arc, Mutex};
use models::AppState;
use database::DatabaseManager;

#[tokio::main]
async fn main() {
    // Try to connect to existing database first, fallback to initialization
    let db_manager = match DatabaseManager::connect_existing().await {
        Ok(manager) => {
            println!("Connected to existing database successfully");
            manager
        },
        Err(_) => {
            println!("No existing database found, initializing new one");
            DatabaseManager::new().await
                .expect("Failed to initialize database")
        }
    };
    
    let app_state = AppState {
        db: Arc::new(Mutex::new(db_manager)),
        current_timer: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Database commands only (working implementations)
            commands::database::init_database,
            commands::database::connect_database,
            commands::database::create_problem,
            commands::database::get_problems,
            commands::database::get_problem_by_id,
            commands::database::update_problem,
            commands::database::delete_problem,
            commands::database::create_card,
            commands::database::get_cards_for_problem,
            commands::database::get_card_by_id,
            commands::database::update_card,
            commands::database::delete_card,
            commands::database::get_database_stats,
            commands::database::get_card_hierarchy,
            commands::database::get_cards_per_problem,
            // Timer commands
            commands::timer::start_timer_session,
            commands::timer::stop_timer_session,
            commands::timer::pause_timer_session,
            commands::timer::resume_timer_session,
            commands::timer::get_timer_state,
            commands::timer::get_card_sessions,
            commands::timer::delete_session
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
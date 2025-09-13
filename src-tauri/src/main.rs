// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod models;
mod path_resolver;

use tauri::Manager;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use models::AppState;
use database::DatabaseManager;
use path_resolver::PathResolver;

/// Get the app data directory based on environment
/// Development: uses project_root/dev-data/
/// Production: uses platform-standard app data directory
fn get_app_data_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        // Development: use project dev-data folder (outside watched directories)
        std::env::current_dir()
            .expect("Failed to get current directory")
            .join("dev-data")
    } else {
        // Production: use proper app data directory
        // This will be updated in setup() to use app.path_resolver()
        // For now, return a placeholder - will be overridden in setup
        PathBuf::new()
    }
}

#[tokio::main]
async fn main() {
    // Enable logging for production debugging - write to a log file for GUI launches
    let log_file_path = "/tmp/dsa-learning-app-crash.log";
    use std::fs::OpenOptions;
    use std::io::Write;
    
    let mut log_file = match OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file_path) 
    {
        Ok(file) => Some(file),
        Err(_) => None,
    };
    
    // Log to both stderr and file
    let log_msg = format!("DSA Learning App: Main function starting at {:?}\n", std::time::SystemTime::now());
    eprintln!("{}", log_msg.trim());
    if let Some(ref mut file) = log_file {
        let _ = file.write_all(log_msg.as_bytes());
        let _ = file.flush();
    }
    
    // Simple logging function that doesn't borrow issues
    let log_to_file = |msg: &str| {
        eprintln!("{}", msg);
        // Write directly to file instead of using mutable reference
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_file_path) 
        {
            let _ = writeln!(file, "{}", msg);
            let _ = file.flush();
        }
    };
    
    log_to_file("DSA Learning App: Creating Tauri application...");

    let tauri_builder = match tauri::Builder::default().plugin(tauri_plugin_shell::init()) {
        builder => {
            log_to_file("DSA Learning App: Tauri builder created successfully");
            builder
        }
    };

    log_to_file("DSA Learning App: Adding command handlers...");
    
    let tauri_app = tauri_builder.invoke_handler(tauri::generate_handler![
            // Database commands only (working implementations)
            commands::database::init_database,
            commands::database::connect_database,
            commands::database::create_problem,
            commands::database::get_problems,
            commands::database::get_problem_by_id,
            commands::database::update_problem,
            commands::database::delete_problem,
            commands::database::get_problem_delete_stats,
            commands::database::create_card,
            commands::database::get_cards_for_problem,
            commands::database::get_card_by_id,
            commands::database::update_card,
            commands::database::delete_card,
            commands::database::get_database_stats,
            commands::database::get_card_hierarchy,
            commands::database::get_cards_per_problem,
            // Tag management commands
            commands::database::get_problem_tags,
            commands::database::get_all_tags,
            commands::database::add_problem_tag,
            commands::database::remove_problem_tag,
            commands::database::get_tag_suggestions,
            // Bulk tag operations
            commands::database::add_tag_to_problems,
            commands::database::remove_tag_from_problems,
            // Bulk delete operations
            commands::database::delete_problems_bulk,
            // Search commands for Name/Topic/Tags system
            commands::database::search_problems_by_name,
            commands::database::search_problems_by_topic,
            commands::database::search_problems_by_tags,
            commands::database::get_problem_count_for_tag,
            commands::database::filter_problems_by_tags,
            commands::database::get_search_suggestions,
            // Problem connection commands
            commands::database::search_problems_for_connection,
            commands::database::add_problem_relation,
            commands::database::remove_problem_relation,
            commands::database::get_related_problems,
            // Stats-related database commands
            commands::database::get_problems_worked_today_list,
            commands::database::get_worked_today_total_duration,
            // Timer commands
            commands::timer::start_timer_session,
            commands::timer::stop_timer_session,
            commands::timer::pause_timer_session,
            commands::timer::resume_timer_session,
            commands::timer::get_timer_state,
            commands::timer::get_card_sessions,
            commands::timer::delete_session,
            // Image commands
            commands::images::save_problem_image,
            commands::images::get_problem_images,
            commands::images::delete_problem_image,
            commands::images::update_image_positions,
            commands::images::get_image_path,
            commands::images::get_image_data_url,
            // Audio commands
            commands::audio::start_recording,
            commands::audio::stop_recording,
            commands::audio::pause_recording,
            commands::audio::resume_recording,
            commands::audio::get_recording_state,
            commands::audio::get_all_recordings,
            commands::audio::get_card_recordings,
            commands::audio::get_audio_data,
            commands::audio::get_current_dir,
            commands::audio::delete_recording,
            // Enhanced audio device management commands
            commands::audio::get_audio_devices,
            commands::audio::switch_audio_device,
            commands::audio::refresh_audio_devices,
            // Debug commands
            commands::debug::debug_paths,
            commands::debug::debug_recording_paths,
            commands::debug::debug_audio_loading,
            commands::debug::get_absolute_path,
            // Solution card commands
            commands::solution_card::get_solution_card,
            commands::solution_card::create_solution_card,
            commands::solution_card::toggle_solution_view,
            commands::solution_card::update_solution_card_code,
            commands::solution_card::update_solution_card_notes,
            commands::solution_card::solution_card_exists,
            commands::solution_card::get_regular_cards,
            // TXT Import command
            commands::database::import_problems_from_txt,
            // Debug commands continued
            commands::debug::check_microphone_permission,
            commands::debug::write_file,
            commands::debug::append_to_file,
            // Stats commands
            commands::stats::get_problems_worked_today,
            commands::stats::get_daily_work_stats,
            commands::stats::get_dashboard_stats,
            // Work Sessions commands for detailed time tracking and visualization
            commands::work_sessions::get_work_sessions_date_range,
            commands::work_sessions::get_work_sessions_today,
            commands::work_sessions::get_work_sessions_yesterday,
            commands::work_sessions::get_last_n_days_summary,
            commands::work_sessions::get_hourly_breakdown,
            commands::work_sessions::get_problem_work_history,
            commands::work_sessions::get_daily_aggregates,
            commands::work_sessions::get_productivity_by_hour,
            commands::work_sessions::get_most_productive_hour,
            commands::work_sessions::get_most_worked_problem
        ]);
    
    log_to_file("DSA Learning App: Command handlers registered");
    log_to_file("DSA Learning App: Setting up Tauri application...");
    
    let tauri_app_with_setup = tauri_app.setup(|app| {
            let log_to_file = |msg: &str| {
                eprintln!("{}", msg);
                if let Ok(mut file) = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open("/tmp/dsa-learning-app-crash.log") 
                {
                    let _ = writeln!(file, "{}", msg);
                    let _ = file.flush();
                }
            };
            log_to_file("DSA Learning App: Setup function called");
            // Enable logging for production debugging
            eprintln!("DSA Learning App: Setup phase starting");
            
            // Initialize app data directories
            let app_data_dir = if cfg!(debug_assertions) {
                eprintln!("DSA Learning App: Development mode detected");
                // Development: use project dev-data folder
                std::env::current_dir()
                    .expect("Failed to get current directory")
                    .join("dev-data")
            } else {
                eprintln!("DSA Learning App: Production mode detected");
                // Production: use proper app data directory
                match app.path().app_data_dir() {
                    Ok(dir) => {
                        eprintln!("DSA Learning App: App data dir resolved: {}", dir.display());
                        dir
                    }
                    Err(e) => {
                        eprintln!("DSA Learning App: FATAL - Failed to get app data directory: {}", e);
                        panic!("Failed to get app data directory: {}", e);
                    }
                }
            };

            // Create necessary directories
            let recordings_dir = app_data_dir.join("recordings");
            let images_dir = app_data_dir.join("images");
            
            match std::fs::create_dir_all(&app_data_dir) {
                Ok(_) => eprintln!("DSA Learning App: Created app data directory"),
                Err(e) => {
                    eprintln!("DSA Learning App: FATAL - Failed to create app data directory: {}", e);
                    panic!("Failed to create app data directory: {}", e);
                }
            }
            
            match std::fs::create_dir_all(&recordings_dir) {
                Ok(_) => eprintln!("DSA Learning App: Created recordings directory"),
                Err(e) => {
                    eprintln!("DSA Learning App: FATAL - Failed to create recordings directory: {}", e);
                    panic!("Failed to create recordings directory: {}", e);
                }
            }
            
            match std::fs::create_dir_all(&images_dir) {
                Ok(_) => eprintln!("DSA Learning App: Created images directory"),
                Err(e) => {
                    eprintln!("DSA Learning App: FATAL - Failed to create images directory: {}", e);
                    panic!("Failed to create images directory: {}", e);
                }
            }

            eprintln!("DSA Learning App: App data directory initialized: {}", app_data_dir.display());
            eprintln!("DSA Learning App: Development mode: {}", cfg!(debug_assertions));
            
            // Initialize path resolver
            let app_handle = app.handle().clone();
            let path_resolver = match PathResolver::new(&app_handle) {
                Ok(resolver) => {
                    eprintln!("DSA Learning App: Path resolver initialized successfully");
                    Arc::new(resolver)
                }
                Err(e) => {
                    eprintln!("DSA Learning App: FATAL - Failed to initialize path resolver: {}", e);
                    panic!("Failed to initialize path resolver: {}", e);
                }
            };
            
            // Now initialize database with proper app data directory
            eprintln!("DSA Learning App: Initializing database...");
            
            // Use blocking task for async database initialization
            let app_data_dir_clone = app_data_dir.clone();
            let db_manager = tokio::task::block_in_place(|| {
                tokio::runtime::Handle::current().block_on(async {
                    // Try to connect to existing database first, fallback to initialization
                    match DatabaseManager::connect_existing_with_path(app_data_dir_clone.clone()).await {
                        Ok(manager) => {
                            eprintln!("DSA Learning App: Connected to existing database successfully");
                            manager
                        },
                        Err(e) => {
                            eprintln!("DSA Learning App: No existing database found, initializing new one. Error: {}", e);
                            match DatabaseManager::new_with_path(app_data_dir_clone).await {
                                Ok(manager) => {
                                    eprintln!("DSA Learning App: Database initialization completed successfully");
                                    manager
                                }
                                Err(e) => {
                                    eprintln!("DSA Learning App: FATAL - Failed to initialize database: {}", e);
                                    panic!("Database initialization failed: {}", e);
                                }
                            }
                        }
                    }
                })
            });
            
            // Create and manage app state with the initialized database
            let app_state = AppState {
                db: Arc::new(Mutex::new(db_manager)),
                current_timer: Arc::new(Mutex::new(None)),
                recording_state: Arc::new(Mutex::new(None)),
                audio_thread_sender: Arc::new(Mutex::new(None)),
                path_resolver,
            };
            
            app.manage(app_state);
            eprintln!("DSA Learning App: App state with database initialized successfully");

            // Always try to get the main window
            match app.get_webview_window("main") {
                Some(_window) => {
                    eprintln!("DSA Learning App: Main window found successfully");
                    eprintln!("DSA Learning App: Window initialization complete");
                }
                None => {
                    eprintln!("DSA Learning App: WARNING - Main window not found!");
                    eprintln!("DSA Learning App: This could indicate a window configuration issue");
                }
            }
            
            eprintln!("DSA Learning App: Setup completed successfully");
            log_to_file("DSA Learning App: Setup completed successfully");
            Ok(())
        });
    
    log_to_file("DSA Learning App: Starting Tauri application run phase...");
    
    tauri_app_with_setup
        .run(tauri::generate_context!())
        .map_err(|e| {
            log_to_file(&format!("DSA Learning App: FATAL - Failed to run Tauri application: {}", e));
            e
        })
        .expect("error while running tauri application");
}
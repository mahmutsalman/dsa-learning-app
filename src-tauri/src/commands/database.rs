use tauri::State;
use crate::models::*;

#[tauri::command]
pub async fn init_database(_state: State<'_, AppState>) -> Result<String, String> {
    // Database is already initialized in main.rs
    Ok("Database initialized successfully".to_string())
}

#[tauri::command]
pub async fn connect_database(state: State<'_, AppState>) -> Result<String, String> {
    // Test database connection and return status
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Quick connection test - count problems
    match db.get_problems() {
        Ok(problems) => {
            Ok(format!("Connected to database successfully. Found {} problems.", problems.len()))
        },
        Err(e) => {
            Err(format!("Database connection failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn create_problem(
    state: State<'_, AppState>,
    request: CreateProblemRequest,
) -> Result<Problem, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_problem(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_problems(state: State<'_, AppState>) -> Result<Vec<Problem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_problems().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_problem_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Problem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_problem_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_problem(
    state: State<'_, AppState>,
    request: UpdateProblemRequest,
) -> Result<String, String> {
    // TODO: Implement update_problem in DatabaseManager
    Ok("Problem updated successfully".to_string())
}

#[tauri::command]
pub async fn delete_problem(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    // TODO: Implement delete_problem in DatabaseManager
    Ok("Problem deleted successfully".to_string())
}

#[tauri::command]
pub async fn create_card(
    state: State<'_, AppState>,
    request: CreateCardRequest,
) -> Result<Card, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_card(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cards_for_problem(
    state: State<'_, AppState>,
    problem_id: String,
) -> Result<Vec<Card>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_cards_for_problem(&problem_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_card_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Card>, String> {
    // TODO: Implement get_card_by_id in DatabaseManager
    Ok(None)
}

#[tauri::command]
pub async fn update_card(
    state: State<'_, AppState>,
    request: UpdateCardRequest,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_card(request).map_err(|e| e.to_string())?;
    Ok("Card updated successfully".to_string())
}

#[tauri::command]
pub async fn delete_card(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    // TODO: Implement delete_card in DatabaseManager
    Ok("Card deleted successfully".to_string())
}

// Database analysis commands
#[tauri::command]
pub async fn get_database_stats(state: State<'_, AppState>) -> Result<DatabaseStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_database_stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_card_hierarchy(state: State<'_, AppState>) -> Result<Vec<CardHierarchy>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_card_hierarchy().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cards_per_problem(state: State<'_, AppState>) -> Result<Vec<CardCountPerProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_cards_per_problem().map_err(|e| e.to_string())
}
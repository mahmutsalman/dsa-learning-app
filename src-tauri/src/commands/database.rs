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
) -> Result<FrontendProblem, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_problem(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_problems(state: State<'_, AppState>) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_problems().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_problem_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_problem_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_problem(
    state: State<'_, AppState>,
    request: UpdateProblemRequest,
) -> Result<FrontendProblem, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    match db.update_problem(request) {
        Ok(Some(problem)) => Ok(problem),
        Ok(None) => Err("Problem not found".to_string()),
        Err(e) => Err(e.to_string())
    }
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
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_card_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_card(
    state: State<'_, AppState>,
    card_id: String,
    code: Option<String>,
    notes: Option<String>,
    language: Option<String>,
    status: Option<String>,
) -> Result<Option<Card>, String> {
    let request = UpdateCardRequest {
        id: card_id,
        code,
        notes,
        language,
        status,
    };
    
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_card(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_card(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    
    match db.delete_card(&id) {
        Ok(()) => Ok("Card deleted successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
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

// Tag management commands
#[tauri::command]
pub async fn get_problem_tags(
    state: State<'_, AppState>,
    problem_id: String,
) -> Result<Vec<Tag>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_problem_tags(&problem_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_problem_tag(
    state: State<'_, AppState>,
    request: AddProblemTagRequest,
) -> Result<Tag, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.add_problem_tag(request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_problem_tag(
    state: State<'_, AppState>,
    request: RemoveProblemTagRequest,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    match db.remove_problem_tag(request) {
        Ok(()) => Ok("Tag removed successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn get_tag_suggestions(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i32>,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_tag_suggestions(&query, limit.unwrap_or(10)).map_err(|e| e.to_string())
}

// Search commands for Name/Topic/Tags search system
#[tauri::command]
pub async fn search_problems_by_name(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_problems_by_title(&query, 50, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_problems_by_topic(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_problems_by_topic(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_problems_by_tags(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_problems_by_tags(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_search_suggestions(
    state: State<'_, AppState>,
    query: String,
    search_type: String,
) -> Result<Vec<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    match search_type.as_str() {
        "name" => db.get_title_suggestions(&query).map_err(|e| e.to_string()),
        "topic" => db.get_topic_suggestions(&query).map_err(|e| e.to_string()),
        "tags" => db.get_tag_suggestions(&query, 10).map_err(|e| e.to_string()),
        _ => Err("Invalid search type".to_string()),
    }
}

// Problem connection commands
#[tauri::command]
pub async fn search_problems_for_connection(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i32>,
    exclude_id: Option<String>,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let exclude_id_ref = exclude_id.as_deref();
    db.search_problems_by_title(&query, limit.unwrap_or(10), exclude_id_ref)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_problem_relation(
    state: State<'_, AppState>,
    problem_id: String,
    related_problem_id: String,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    match db.add_problem_relation(&problem_id, &related_problem_id) {
        Ok(()) => Ok("Problem relation added successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn remove_problem_relation(
    state: State<'_, AppState>,
    problem_id: String,
    related_problem_id: String,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    match db.remove_problem_relation(&problem_id, &related_problem_id) {
        Ok(()) => Ok("Problem relation removed successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn get_related_problems(
    state: State<'_, AppState>,
    problem_id: String,
) -> Result<Vec<FrontendProblem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_related_problems(&problem_id).map_err(|e| e.to_string())
}
// Solution Card Command Handlers
//
// Tauri command handlers for solution card operations.
// These provide the API interface between frontend and database.

use tauri::State;
use serde::{Deserialize, Serialize};
use crate::models::{AppState, SolutionCard};

#[derive(Debug, Serialize, Deserialize)]
pub struct SolutionCardResponse {
    pub success: bool,
    pub card: Option<SolutionCard>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SolutionCardToggleResponse {
    pub success: bool,
    pub is_viewing_solution: bool,
    pub card: Option<SolutionCard>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SolutionCardUpdateResponse {
    pub success: bool,
    pub error: Option<String>,
}

/// Get solution card for a problem
#[tauri::command]
pub async fn get_solution_card(problem_id: String, app_state: State<'_, AppState>) -> Result<SolutionCardResponse, String> {
    let db = app_state.db.lock().map_err(|e| e.to_string())?;
    
    match db.get_solution_card(&problem_id) {
        Ok(card) => Ok(SolutionCardResponse {
            success: true,
            card,
            error: None,
        }),
        Err(e) => Ok(SolutionCardResponse {
            success: false,
            card: None,
            error: Some(format!("Failed to get solution card: {}", e)),
        })
    }
}

/// Create solution card for a problem
#[tauri::command]
pub async fn create_solution_card(problem_id: String, app_state: State<'_, AppState>) -> Result<SolutionCardResponse, String> {
    let db = app_state.db.lock().map_err(|e| e.to_string())?;
    
    match db.create_solution_card(&problem_id) {
        Ok(card) => Ok(SolutionCardResponse {
            success: true,
            card: Some(card),
            error: None,
        }),
        Err(e) => Ok(SolutionCardResponse {
            success: false,
            card: None,
            error: Some(format!("Failed to create solution card: {}", e)),
        })
    }
}

/// Toggle solution view - get existing or create new solution card
#[tauri::command]
pub async fn toggle_solution_view(
    problem_id: String, 
    create_if_missing: bool,
    app_state: State<'_, AppState>
) -> Result<SolutionCardToggleResponse, String> {
    let db = app_state.db.lock().map_err(|e| e.to_string())?;
    
    // First, check if solution card exists
    match db.get_solution_card(&problem_id) {
        Ok(Some(card)) => {
            // Solution card exists, return it
            Ok(SolutionCardToggleResponse {
                success: true,
                is_viewing_solution: true,
                card: Some(card),
                error: None,
            })
        },
        Ok(None) => {
            // No solution card exists
            if create_if_missing {
                // Create new solution card
                match db.create_solution_card(&problem_id) {
                    Ok(card) => Ok(SolutionCardToggleResponse {
                        success: true,
                        is_viewing_solution: true,
                        card: Some(card),
                        error: None,
                    }),
                    Err(e) => Ok(SolutionCardToggleResponse {
                        success: false,
                        is_viewing_solution: false,
                        card: None,
                        error: Some(format!("Failed to create solution card: {}", e)),
                    })
                }
            } else {
                // Don't create, just return that no solution exists
                Ok(SolutionCardToggleResponse {
                    success: true,
                    is_viewing_solution: false,
                    card: None,
                    error: None,
                })
            }
        },
        Err(e) => Ok(SolutionCardToggleResponse {
            success: false,
            is_viewing_solution: false,
            card: None,
            error: Some(format!("Failed to check for solution card: {}", e)),
        })
    }
}

/// Update solution card code
#[tauri::command]
pub async fn update_solution_card_code(
    card_id: String,
    code: String,
    language: String,
    app_state: State<'_, AppState>
) -> Result<SolutionCardUpdateResponse, String> {
    let db = app_state.db.lock().map_err(|e| e.to_string())?;
    
    match db.update_solution_card_code(&card_id, &code, &language) {
        Ok(_) => Ok(SolutionCardUpdateResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(SolutionCardUpdateResponse {
            success: false,
            error: Some(format!("Failed to update solution card code: {}", e)),
        })
    }
}

/// Update solution card notes
#[tauri::command]
pub async fn update_solution_card_notes(
    card_id: String,
    notes: String,
    app_state: State<'_, AppState>
) -> Result<SolutionCardUpdateResponse, String> {
    let db = app_state.db.lock().map_err(|e| e.to_string())?;
    
    match db.update_solution_card_notes(&card_id, &notes) {
        Ok(_) => Ok(SolutionCardUpdateResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(SolutionCardUpdateResponse {
            success: false,
            error: Some(format!("Failed to update solution card notes: {}", e)),
        })
    }
}

/// Check if solution card exists
#[tauri::command]
pub async fn solution_card_exists(problem_id: String, app_state: State<'_, AppState>) -> Result<bool, String> {
    let db = app_state.db.lock().map_err(|e| e.to_string())?;
    
    match db.solution_card_exists(&problem_id) {
        Ok(exists) => Ok(exists),
        Err(e) => Err(format!("Failed to check if solution card exists: {}", e))
    }
}

/// Get regular (non-solution) cards for a problem
/// This is useful for normal card navigation to exclude solution cards
#[tauri::command]
pub async fn get_regular_cards(problem_id: String, app_state: State<'_, AppState>) -> Result<Vec<SolutionCard>, String> {
    let db = app_state.db.lock().map_err(|e| e.to_string())?;
    
    match db.get_regular_cards(&problem_id) {
        Ok(cards) => Ok(cards),
        Err(e) => Err(format!("Failed to get regular cards: {}", e))
    }
}
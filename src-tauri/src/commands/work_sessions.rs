use crate::models::*;
use chrono::Utc;
use tauri::State;

/// Get work sessions for a specific date range
#[tauri::command]
pub async fn get_work_sessions_date_range(
    app_state: State<'_, AppState>,
    request: WorkSessionsDateRangeRequest,
) -> Result<Vec<WorkSessionWithProblem>, String> {
    println!("🔍 [API] Getting work sessions from {} to {}", request.start_date, request.end_date);
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_work_sessions_by_date_range(&request.start_date, &request.end_date) {
        Ok(sessions) => {
            println!("✅ [API] Retrieved {} work sessions", sessions.len());
            Ok(sessions)
        }
        Err(e) => {
            println!("❌ [API] Error getting work sessions: {}", e);
            Err(format!("Failed to get work sessions: {}", e))
        }
    }
}

/// Get work sessions for today
#[tauri::command]
pub async fn get_work_sessions_today(
    app_state: State<'_, AppState>,
) -> Result<Vec<WorkSessionWithProblem>, String> {
    println!("🔍 [API] Getting today's work sessions");
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_work_sessions_today() {
        Ok(sessions) => {
            println!("✅ [API] Retrieved {} work sessions for today", sessions.len());
            Ok(sessions)
        }
        Err(e) => {
            println!("❌ [API] Error getting today's work sessions: {}", e);
            Err(format!("Failed to get today's work sessions: {}", e))
        }
    }
}

/// Get work sessions for yesterday
#[tauri::command]
pub async fn get_work_sessions_yesterday(
    app_state: State<'_, AppState>,
) -> Result<Vec<WorkSessionWithProblem>, String> {
    println!("🔍 [API] Getting yesterday's work sessions");
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_work_sessions_yesterday() {
        Ok(sessions) => {
            println!("✅ [API] Retrieved {} work sessions for yesterday", sessions.len());
            Ok(sessions)
        }
        Err(e) => {
            println!("❌ [API] Error getting yesterday's work sessions: {}", e);
            Err(format!("Failed to get yesterday's work sessions: {}", e))
        }
    }
}

/// Get work sessions summary for the last N days
#[tauri::command]
pub async fn get_last_n_days_summary(
    app_state: State<'_, AppState>,
    days: i32,
) -> Result<DateRangeWorkSummary, String> {
    println!("🔍 [API] Getting work summary for last {} days", days);
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_last_n_days_summary(days) {
        Ok(summary) => {
            println!("✅ [API] Retrieved work summary: {} problems, {} sessions, {} seconds total", 
                    summary.unique_problems_count, summary.total_sessions_count, summary.total_duration_seconds);
            Ok(summary)
        }
        Err(e) => {
            println!("❌ [API] Error getting work summary: {}", e);
            Err(format!("Failed to get work summary: {}", e))
        }
    }
}

/// Get hourly breakdown for a specific date
#[tauri::command]
pub async fn get_hourly_breakdown(
    app_state: State<'_, AppState>,
    date: String,
) -> Result<Vec<HourlyWorkBreakdown>, String> {
    println!("🔍 [API] Getting hourly breakdown for {}", date);
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_hourly_breakdown(&date) {
        Ok(breakdown) => {
            println!("✅ [API] Retrieved hourly breakdown with {} entries", breakdown.len());
            Ok(breakdown)
        }
        Err(e) => {
            println!("❌ [API] Error getting hourly breakdown: {}", e);
            Err(format!("Failed to get hourly breakdown: {}", e))
        }
    }
}

/// Get work sessions for a specific problem over the last N days
#[tauri::command]
pub async fn get_problem_work_history(
    app_state: State<'_, AppState>,
    request: WorkSessionsByProblemRequest,
) -> Result<Vec<WorkSession>, String> {
    let days = request.days.unwrap_or(30);
    println!("🔍 [API] Getting work history for problem {} over last {} days", request.problem_id, days);
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_problem_work_history(&request.problem_id, days) {
        Ok(sessions) => {
            println!("✅ [API] Retrieved {} work sessions for problem", sessions.len());
            Ok(sessions)
        }
        Err(e) => {
            println!("❌ [API] Error getting problem work history: {}", e);
            Err(format!("Failed to get problem work history: {}", e))
        }
    }
}

/// Get daily work aggregates for visualization
#[tauri::command]
pub async fn get_daily_aggregates(
    app_state: State<'_, AppState>,
    request: WorkSessionsDateRangeRequest,
) -> Result<Vec<DailyWorkSummary>, String> {
    println!("🔍 [API] Getting daily aggregates from {} to {}", request.start_date, request.end_date);
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_daily_aggregates(&request.start_date, &request.end_date) {
        Ok(aggregates) => {
            println!("✅ [API] Retrieved {} daily aggregates", aggregates.len());
            Ok(aggregates)
        }
        Err(e) => {
            println!("❌ [API] Error getting daily aggregates: {}", e);
            Err(format!("Failed to get daily aggregates: {}", e))
        }
    }
}

/// Get productivity pattern analysis for the last N days
#[tauri::command]
pub async fn get_productivity_by_hour(
    app_state: State<'_, AppState>,
    request: HourlyProductivityRequest,
) -> Result<Vec<HourlyWorkBreakdown>, String> {
    let days = request.days.unwrap_or(7);
    println!("🔍 [API] Getting productivity by hour for last {} days", days);
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_productivity_by_hour(days) {
        Ok(breakdown) => {
            println!("✅ [API] Retrieved productivity breakdown with {} hour slots", breakdown.len());
            Ok(breakdown)
        }
        Err(e) => {
            println!("❌ [API] Error getting productivity by hour: {}", e);
            Err(format!("Failed to get productivity by hour: {}", e))
        }
    }
}

/// Get most productive hour over the last N days
#[tauri::command]
pub async fn get_most_productive_hour(
    app_state: State<'_, AppState>,
    days: i32,
) -> Result<Option<i32>, String> {
    println!("🔍 [API] Getting most productive hour for last {} days", days);
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_most_productive_hour(days) {
        Ok(hour) => {
            match hour {
                Some(h) => println!("✅ [API] Most productive hour: {}:00", h),
                None => println!("✅ [API] No work sessions found in the specified period"),
            }
            Ok(hour)
        }
        Err(e) => {
            println!("❌ [API] Error getting most productive hour: {}", e);
            Err(format!("Failed to get most productive hour: {}", e))
        }
    }
}

/// Get most worked problem in a date range
#[tauri::command]
pub async fn get_most_worked_problem(
    app_state: State<'_, AppState>,
    request: WorkSessionsDateRangeRequest,
) -> Result<Option<ProblemWorkBreakdown>, String> {
    println!("🔍 [API] Getting most worked problem from {} to {}", request.start_date, request.end_date);
    
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.get_most_worked_problem(&request.start_date, &request.end_date) {
        Ok(problem) => {
            match &problem {
                Some(p) => println!("✅ [API] Most worked problem: '{}' with {} seconds", p.problem_title, p.total_duration_seconds),
                None => println!("✅ [API] No work sessions found in the specified period"),
            }
            Ok(problem)
        }
        Err(e) => {
            println!("❌ [API] Error getting most worked problem: {}", e);
            Err(format!("Failed to get most worked problem: {}", e))
        }
    }
}

// Internal functions for session management (called by timer commands)

/// Create a new work session (internal function)
pub fn create_work_session_internal(
    app_state: &AppState,
    problem_id: &str,
    card_id: &str,
    start_timestamp: chrono::DateTime<Utc>,
) -> Result<String, String> {
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.create_work_session(problem_id, card_id, start_timestamp) {
        Ok(session_id) => {
            println!("✅ [Internal] Created work session {} for problem {} card {}", session_id, problem_id, card_id);
            Ok(session_id)
        }
        Err(e) => {
            println!("❌ [Internal] Error creating work session: {}", e);
            Err(format!("Failed to create work session: {}", e))
        }
    }
}

/// Complete a work session (internal function)
pub fn complete_work_session_internal(
    app_state: &AppState,
    session_id: &str,
    end_timestamp: chrono::DateTime<Utc>,
) -> Result<(), String> {
    let db = app_state.db.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    match db.complete_work_session(session_id, end_timestamp) {
        Ok(()) => {
            println!("✅ [Internal] Completed work session {}", session_id);
            Ok(())
        }
        Err(e) => {
            println!("❌ [Internal] Error completing work session: {}", e);
            Err(format!("Failed to complete work session: {}", e))
        }
    }
}
use tauri::State;
use chrono::Local;
use crate::models::*;

#[tauri::command]
pub async fn get_problems_worked_today(state: State<'_, AppState>) -> Result<ProblemsWorkedTodayResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Get today's date in the local timezone
    let today = Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();
    
    let count = db.get_problems_worked_today(&today_str).map_err(|e| e.to_string())?;
    
    Ok(ProblemsWorkedTodayResponse {
        count,
        date: today_str,
    })
}

#[tauri::command]
pub async fn get_daily_work_stats(state: State<'_, AppState>) -> Result<DailyWorkStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Get today's date in the local timezone
    let today = Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();
    
    let stats = db.get_daily_work_stats(&today_str).map_err(|e| e.to_string())?;
    
    Ok(stats)
}

#[tauri::command]
pub async fn get_dashboard_stats(state: State<'_, AppState>) -> Result<DashboardStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Get today's date in the local timezone
    let today = Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();
    
    let stats = db.get_dashboard_stats(&today_str).map_err(|e| e.to_string())?;
    
    Ok(stats)
}
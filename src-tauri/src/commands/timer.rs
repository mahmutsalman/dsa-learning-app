use tauri::State;
use chrono::Utc;
use crate::models::*;

#[tauri::command]
pub async fn start_timer_session(
    state: State<'_, AppState>,
    card_id: String,
) -> Result<TimerState, String> {
    // Stop any existing timer session
    if let Ok(mut current_timer) = state.current_timer.lock() {
        if let Some(timer_session) = current_timer.take() {
            // End the previous session
            let mut db = state.db.lock().map_err(|e| e.to_string())?;
            let _ = db.end_timer_session(&timer_session.id, timer_session.work_session_id.as_deref());
        }
    }

    // Start new timer session
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let (session, work_session_id) = db.start_timer_session(&card_id).map_err(|e| e.to_string())?;
    
    // Store in current timer state
    let timer_session = TimerSession {
        id: session.id.clone(),
        card_id: card_id.clone(),
        start_time: session.start_time,
        is_paused: false,
        pause_duration: 0,
        work_session_id: Some(work_session_id),
    };
    
    {
        let mut current_timer = state.current_timer.lock().map_err(|e| e.to_string())?;
        *current_timer = Some(timer_session);
    }
    
    Ok(TimerState {
        is_running: true,
        is_paused: false,
        current_session_id: Some(session.id),
        session_start_time: Some(session.start_time),
        elapsed_time: 0,
    })
}

#[tauri::command]
pub async fn stop_timer_session(state: State<'_, AppState>) -> Result<String, String> {
    let mut current_timer = state.current_timer.lock().map_err(|e| e.to_string())?;
    
    if let Some(timer_session) = current_timer.take() {
        let mut db = state.db.lock().map_err(|e| e.to_string())?;
        db.end_timer_session(&timer_session.id, timer_session.work_session_id.as_deref()).map_err(|e| e.to_string())?;
        Ok("Timer session stopped successfully".to_string())
    } else {
        Err("No active timer session".to_string())
    }
}

#[tauri::command]
pub async fn pause_timer_session(state: State<'_, AppState>) -> Result<String, String> {
    let mut current_timer = state.current_timer.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref mut timer_session) = *current_timer {
        timer_session.is_paused = true;
        Ok("Timer session paused".to_string())
    } else {
        Err("No active timer session".to_string())
    }
}

#[tauri::command]
pub async fn resume_timer_session(state: State<'_, AppState>) -> Result<String, String> {
    let mut current_timer = state.current_timer.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref mut timer_session) = *current_timer {
        timer_session.is_paused = false;
        Ok("Timer session resumed".to_string())
    } else {
        Err("No active timer session".to_string())
    }
}

#[tauri::command]
pub async fn get_timer_state(state: State<'_, AppState>) -> Result<TimerState, String> {
    let current_timer = state.current_timer.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref timer_session) = *current_timer {
        let now = Utc::now();
        let elapsed_time = if timer_session.is_paused {
            timer_session.pause_duration
        } else {
            (now - timer_session.start_time).num_seconds() as i32 - timer_session.pause_duration
        };
        
        Ok(TimerState {
            is_running: true,
            is_paused: timer_session.is_paused,
            current_session_id: Some(timer_session.id.clone()),
            session_start_time: Some(timer_session.start_time),
            elapsed_time,
        })
    } else {
        Ok(TimerState {
            is_running: false,
            is_paused: false,
            current_session_id: None,
            session_start_time: None,
            elapsed_time: 0,
        })
    }
}

#[tauri::command]
pub async fn get_card_sessions(
    state: State<'_, AppState>,
    card_id: String,
) -> Result<Vec<TimeSession>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_sessions_for_card(&card_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<String, String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_time_session(&session_id).map_err(|e| e.to_string())?;
    Ok("Session deleted successfully".to_string())
}
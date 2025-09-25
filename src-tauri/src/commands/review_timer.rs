use tauri::State;
use chrono::Utc;
use crate::models::*;

// Review Timer State - similar to TimerState but for review mode
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ReviewTimerState {
    pub is_running: bool,
    pub is_paused: bool,
    pub current_session_id: Option<String>,
    pub session_start_time: Option<chrono::DateTime<Utc>>,
    pub elapsed_time: i32, // in seconds
}

#[tauri::command]
pub async fn start_review_timer_session(
    state: State<'_, AppState>,
    card_id: String,
) -> Result<ReviewTimerState, String> {
    // Stop any existing review timer session
    if let Ok(mut current_review_timer) = state.current_review_timer.lock() {
        if let Some(review_timer_session) = current_review_timer.take() {
            // End the previous review session
            let db = state.db.lock().map_err(|e| e.to_string())?;
            let _ = db.end_review_timer_session(&review_timer_session.id, review_timer_session.review_work_session_id.as_deref());
        }
    }

    // Start new review timer session
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let (session, review_work_session_id) = db.start_review_timer_session(&card_id).map_err(|e| e.to_string())?;

    // Store in current review timer state
    let review_timer_session = ReviewTimerSession {
        id: session.id.clone(),
        card_id: card_id.clone(),
        start_time: session.start_time,
        is_paused: false,
        pause_duration: 0,
        review_work_session_id: Some(review_work_session_id),
        original_session_id: session.original_session_id,
    };

    {
        let mut current_review_timer = state.current_review_timer.lock().map_err(|e| e.to_string())?;
        *current_review_timer = Some(review_timer_session);
    }

    Ok(ReviewTimerState {
        is_running: true,
        is_paused: false,
        current_session_id: Some(session.id),
        session_start_time: Some(session.start_time),
        elapsed_time: 0,
    })
}

#[tauri::command]
pub async fn stop_review_timer_session(state: State<'_, AppState>) -> Result<String, String> {
    let mut current_review_timer = state.current_review_timer.lock().map_err(|e| e.to_string())?;

    if let Some(review_timer_session) = current_review_timer.take() {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.end_review_timer_session(&review_timer_session.id, review_timer_session.review_work_session_id.as_deref()).map_err(|e| e.to_string())?;
        Ok("Review timer session stopped successfully".to_string())
    } else {
        Err("No active review timer session".to_string())
    }
}

#[tauri::command]
pub async fn pause_review_timer_session(state: State<'_, AppState>) -> Result<String, String> {
    let mut current_review_timer = state.current_review_timer.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut review_timer_session) = *current_review_timer {
        review_timer_session.is_paused = true;
        Ok("Review timer session paused".to_string())
    } else {
        Err("No active review timer session".to_string())
    }
}

#[tauri::command]
pub async fn resume_review_timer_session(state: State<'_, AppState>) -> Result<String, String> {
    let mut current_review_timer = state.current_review_timer.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut review_timer_session) = *current_review_timer {
        review_timer_session.is_paused = false;
        Ok("Review timer session resumed".to_string())
    } else {
        Err("No active review timer session".to_string())
    }
}

#[tauri::command]
pub async fn get_review_timer_state(state: State<'_, AppState>) -> Result<ReviewTimerState, String> {
    let current_review_timer = state.current_review_timer.lock().map_err(|e| e.to_string())?;

    if let Some(ref review_timer_session) = *current_review_timer {
        let now = Utc::now();
        let elapsed_time = if review_timer_session.is_paused {
            review_timer_session.pause_duration
        } else {
            (now - review_timer_session.start_time).num_seconds() as i32 - review_timer_session.pause_duration
        };

        Ok(ReviewTimerState {
            is_running: true,
            is_paused: review_timer_session.is_paused,
            current_session_id: Some(review_timer_session.id.clone()),
            session_start_time: Some(review_timer_session.start_time),
            elapsed_time: elapsed_time.max(0),
        })
    } else {
        Ok(ReviewTimerState {
            is_running: false,
            is_paused: false,
            current_session_id: None,
            session_start_time: None,
            elapsed_time: 0,
        })
    }
}

#[tauri::command]
pub async fn get_card_review_sessions(
    state: State<'_, AppState>,
    card_id: String,
) -> Result<Vec<ReviewSession>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_card_review_sessions(&card_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_review_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_review_session(&session_id).map_err(|e| e.to_string())?;
    Ok("Review session deleted successfully".to_string())
}
use tauri::State;
use std::fs;
use base64::{Engine as _, engine::general_purpose};
use crate::models::*;
use crate::audio::{get_recordings_directory, generate_recording_filename, get_audio_duration};

#[tauri::command]
pub async fn start_recording(state: State<'_, AppState>) -> Result<RecordingInfo, String> {
    let recordings_dir = get_recordings_directory().map_err(|e| e.to_string())?;
    let filename = generate_recording_filename();
    let filepath = recordings_dir.join(&filename);
    
    let audio_recorder = state.audio_recorder.lock().map_err(|e| e.to_string())?;
    let handle = audio_recorder.start_recording(filepath.clone()).map_err(|e| e.to_string())?;
    
    // Store the recording handle
    let mut current_recording = state.current_recording.lock().map_err(|e| e.to_string())?;
    *current_recording = Some(handle);
    
    Ok(RecordingInfo {
        filename,
        filepath: filepath.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AppState>) -> Result<String, String> {
    let mut current_recording = state.current_recording.lock().map_err(|e| e.to_string())?;
    
    if let Some(handle) = current_recording.take() {
        let filepath = handle.stop().map_err(|e| e.to_string())?;
        let filepath_str = filepath.to_string_lossy().to_string();
        
        // Get audio duration
        let duration = get_audio_duration(&filepath_str).ok();
        
        // Save recording to database (need card_id context - this is simplified)
        // In a real implementation, you'd track which card is currently active
        let filename = filepath.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        
        // For now, we'll skip database save as we need card context
        // let mut db = state.db.lock().map_err(|e| e.to_string())?;
        // let _recording = db.save_recording(card_id, &filename, &filepath_str, duration)?;
        
        Ok("Recording saved successfully".to_string())
    } else {
        Err("No active recording".to_string())
    }
}

#[tauri::command]
pub async fn pause_recording(state: State<'_, AppState>) -> Result<String, String> {
    let current_recording = state.current_recording.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref handle) = *current_recording {
        handle.pause().map_err(|e| e.to_string())?;
        Ok("Recording paused".to_string())
    } else {
        Err("No active recording".to_string())
    }
}

#[tauri::command]
pub async fn resume_recording(state: State<'_, AppState>) -> Result<String, String> {
    let current_recording = state.current_recording.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref handle) = *current_recording {
        handle.resume().map_err(|e| e.to_string())?;
        Ok("Recording resumed".to_string())
    } else {
        Err("No active recording".to_string())
    }
}

#[tauri::command]
pub async fn get_recording_state(state: State<'_, AppState>) -> Result<RecordingState, String> {
    let current_recording = state.current_recording.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref handle) = *current_recording {
        let elapsed_time = handle.get_elapsed_time();
        let is_paused = handle.is_paused();
        let is_recording = handle.is_recording();
        
        Ok(RecordingState {
            is_recording,
            is_paused,
            current_recording_id: Some("current".to_string()), // Simplified
            recording_start_time: None, // Would need to store this
            elapsed_recording_time: elapsed_time,
        })
    } else {
        Ok(RecordingState {
            is_recording: false,
            is_paused: false,
            current_recording_id: None,
            recording_start_time: None,
            elapsed_recording_time: 0,
        })
    }
}

#[tauri::command]
pub async fn get_all_recordings(state: State<'_, AppState>) -> Result<Vec<Recording>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_recordings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_audio_data(filepath: String) -> Result<String, String> {
    // Read the audio file
    let audio_data = fs::read(&filepath)
        .map_err(|e| format!("Failed to read audio file: {}", e))?;
    
    // Convert to base64 data URL
    let base64_data = general_purpose::STANDARD.encode(&audio_data);
    let data_url = format!("data:audio/wav;base64,{}", base64_data);
    
    Ok(data_url)
}
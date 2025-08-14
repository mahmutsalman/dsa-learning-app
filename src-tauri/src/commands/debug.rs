use crate::models::AppState;
use tauri::State;

#[derive(serde::Serialize)]
pub struct PathDebugInfo {
    pub is_debug_mode: bool,
    pub path_resolver_base_dir: String,
    pub recordings_dir: String,
    pub images_dir: String,
    pub sample_resolved_path: String,
    pub cfg_debug_assertions: bool,
}

#[tauri::command]
pub async fn debug_paths(state: State<'_, AppState>) -> Result<PathDebugInfo, String> {
    // Test path resolution with a sample relative path
    let sample_relative = "app-data/recordings/test.wav";
    let resolved = state.path_resolver.resolve_relative_path(sample_relative);
    
    let recordings_dir = state.path_resolver.get_recordings_dir();
    let images_dir = state.path_resolver.get_images_dir();
    let base_dir = state.path_resolver.get_app_data_dir();
    
    Ok(PathDebugInfo {
        is_debug_mode: cfg!(debug_assertions),
        cfg_debug_assertions: cfg!(debug_assertions),
        path_resolver_base_dir: base_dir.display().to_string(),
        recordings_dir: recordings_dir.display().to_string(),
        images_dir: images_dir.display().to_string(),
        sample_resolved_path: resolved.display().to_string(),
    })
}

#[tauri::command]
pub async fn debug_recording_paths(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<String, String> {
    let resolved = state.path_resolver.resolve_relative_path(&relative_path);
    
    // Check if file exists
    let exists = resolved.exists();
    
    Ok(format!(
        "Relative: {} → Resolved: {} (exists: {})", 
        relative_path, 
        resolved.display(), 
        exists
    ))
}

#[tauri::command]
pub async fn debug_audio_loading(state: State<'_, AppState>, relative_path: String) -> Result<String, String> {
    // Method 1: What frontend currently does (WRONG)
    let current_dir = std::env::current_dir().unwrap_or_default();
    let wrong_path = current_dir.join(&relative_path);
    
    // Method 2: What PathResolver does (CORRECT)
    let correct_path = state.path_resolver.resolve_relative_path(&relative_path);
    
    let result = format!(
        "🔍 Audio Loading Debug:\n\n\
        1. Current Working Dir: {}\n\
        2. Relative Path: {}\n\
        3. Frontend Wrong Path: {} (exists: {})\n\
        4. PathResolver Correct Path: {} (exists: {})\n\n\
        ❌ Problem: Frontend uses current_dir + relative_path\n\
        ✅ Solution: Frontend should get absolute path from Rust",
        current_dir.display(),
        relative_path,
        wrong_path.display(),
        wrong_path.exists(),
        correct_path.display(),
        correct_path.exists()
    );
    
    Ok(result)
}

#[tauri::command]
pub async fn get_absolute_path(state: State<'_, AppState>, relative_path: String) -> Result<String, String> {
    let absolute_path = state.path_resolver.resolve_relative_path(&relative_path);
    Ok(absolute_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn check_microphone_permission() -> Result<String, String> {
    // Try to get default input device to check if microphone access is available
    use cpal::traits::{HostTrait, DeviceTrait};
    
    let host = cpal::default_host();
    match host.default_input_device() {
        Some(device) => {
            // Try to get the device name - this will fail if no permission
            match device.name() {
                Ok(name) => Ok(format!("✅ Microphone permission granted. Device: {}", name)),
                Err(e) => Ok(format!("❌ Microphone permission denied or device error: {}", e))
            }
        }
        None => Ok("❌ No microphone device available".to_string())
    }
}
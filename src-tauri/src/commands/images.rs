use crate::models::{AppState, ProblemImage, SaveImageRequest, DeleteImageRequest};
use base64::{Engine as _, engine::general_purpose};
use std::path::PathBuf;
use std::fs;
use tauri::State;
use uuid::Uuid;

/// Get the app data directory based on environment
/// Development: uses project_root/dev-data/
/// Production: would use app data directory (need app context for that)
fn get_app_data_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        // Development: use project dev-data folder (outside watched directories)
        std::env::current_dir()
            .expect("Failed to get current directory")
            .join("dev-data")
    } else {
        // Production: This is a fallback, but ideally we'd use app.path_resolver()
        // For now, use a sensible default - this should be updated when we have app context
        if cfg!(target_os = "macos") {
            dirs::home_dir()
                .expect("Failed to get home directory")
                .join("Library")
                .join("Application Support")
                .join("com.dsalearning.app")
        } else if cfg!(target_os = "windows") {
            dirs::data_dir()
                .expect("Failed to get data directory")
                .join("com.dsalearning.app")
        } else {
            dirs::data_local_dir()
                .expect("Failed to get local data directory")
                .join("com.dsalearning.app")
        }
    }
}

// Helper function to get the images directory with cross-platform support
fn get_images_dir() -> anyhow::Result<PathBuf> {
    let app_data_dir = get_app_data_dir().join("images");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)?;
    
    Ok(app_data_dir)
}

// Helper function to ensure problem-specific directory exists
fn ensure_problem_dir(problem_id: &str) -> anyhow::Result<PathBuf> {
    let problem_dir = get_images_dir()?.join(format!("problem_{}", problem_id));
    fs::create_dir_all(&problem_dir)?;
    Ok(problem_dir)
}

// Helper function to detect image format from base64 data
fn detect_image_format(data: &str) -> Option<&str> {
    if data.starts_with("data:image/png") {
        Some("png")
    } else if data.starts_with("data:image/jpeg") || data.starts_with("data:image/jpg") {
        Some("jpg")
    } else if data.starts_with("data:image/gif") {
        Some("gif")
    } else if data.starts_with("data:image/webp") {
        Some("webp")
    } else if data.starts_with("data:image/svg") {
        Some("svg")
    } else {
        // Default to png if no format detected
        Some("png")
    }
}

#[tauri::command]
pub async fn save_problem_image(
    state: State<'_, AppState>,
    request: SaveImageRequest,
) -> Result<ProblemImage, String> {
    // Extract base64 data (remove data URL prefix if present)
    let image_data = if request.image_data.contains(',') {
        request.image_data.split(',').nth(1).unwrap_or(&request.image_data)
    } else {
        &request.image_data
    };
    
    // Detect image format
    let format = detect_image_format(&request.image_data).unwrap_or("png");
    
    // Decode base64 data
    let decoded_data = general_purpose::STANDARD
        .decode(image_data)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;
    
    // Generate unique filename
    let filename = format!("{}.{}", Uuid::new_v4(), format);
    
    // Ensure problem directory exists
    let problem_dir = ensure_problem_dir(&request.problem_id)
        .map_err(|e| format!("Failed to create problem directory: {}", e))?;
    
    // Full path for file storage
    let full_path = problem_dir.join(&filename);
    
    // Save the image file
    fs::write(&full_path, decoded_data)
        .map_err(|e| format!("Failed to save image file: {}", e))?;
    
    // Create relative path for database storage (environment-aware)
    let relative_path = if cfg!(debug_assertions) {
        format!("dev-data/images/problem_{}/{}", request.problem_id, filename)
    } else {
        format!("app-data/images/problem_{}/{}", request.problem_id, filename)
    };
    
    // Save to database
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let image = db.save_problem_image(
        &request.problem_id,
        &relative_path,
        request.caption,
        request.position,
    ).map_err(|e| format!("Failed to save image to database: {}", e))?;
    
    Ok(image)
}

#[tauri::command]
pub async fn get_problem_images(
    state: State<'_, AppState>,
    problem_id: String,
) -> Result<Vec<ProblemImage>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_problem_images(&problem_id)
        .map_err(|e| format!("Failed to get problem images: {}", e))
}

#[tauri::command]
pub async fn delete_problem_image(
    state: State<'_, AppState>,
    request: DeleteImageRequest,
) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Get the image path from database and delete the record
    let image_path = db.delete_problem_image(&request.image_id)
        .map_err(|e| format!("Failed to delete image from database: {}", e))?;
    
    // Delete the actual file - handle environment-aware path resolution
    let full_path = if image_path.starts_with("dev-data/") || image_path.starts_with("app-data/") || image_path.starts_with("images/") {
        // Convert relative path to absolute path based on environment
        if image_path.starts_with("dev-data/") {
            // Development path: project_root/dev-data/...
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join(&image_path)
        } else if image_path.starts_with("app-data/") {
            // Production path: resolve to actual app data directory
            get_app_data_dir().join(&image_path[9..]) // Remove "app-data/" prefix
        } else if image_path.starts_with("images/") {
            // Legacy path: attachments/images/...
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join("attachments")
                .join(&image_path)
        } else {
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join(&image_path)
        }
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(&image_path)
    };
    
    if full_path.exists() {
        fs::remove_file(full_path)
            .map_err(|e| format!("Failed to delete image file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn update_image_positions(
    state: State<'_, AppState>,
    updates: Vec<(String, i32)>,
) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_image_positions(updates)
        .map_err(|e| format!("Failed to update image positions: {}", e))
}

// Helper command to get the full path for an image (for displaying in frontend)
#[tauri::command]
pub async fn get_image_path(relative_path: String) -> Result<String, String> {
    // Handle environment-aware path resolution
    let full_path = if relative_path.starts_with("dev-data/") || relative_path.starts_with("app-data/") || relative_path.starts_with("images/") {
        // Convert relative path to absolute path based on environment
        if relative_path.starts_with("dev-data/") {
            // Development path: project_root/dev-data/...
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join(&relative_path)
        } else if relative_path.starts_with("app-data/") {
            // Production path: resolve to actual app data directory
            get_app_data_dir().join(&relative_path[9..]) // Remove "app-data/" prefix
        } else if relative_path.starts_with("images/") {
            // Legacy path: attachments/images/...
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join("attachments")
                .join(&relative_path)
        } else {
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join(&relative_path)
        }
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(&relative_path)
    };
    
    // Convert to string and use the asset protocol
    let path_str = full_path.to_string_lossy().to_string();
    
    // Use asset protocol for Tauri
    #[cfg(target_os = "windows")]
    let asset_url = format!("asset://localhost/{}", path_str.replace('\\', "/"));
    
    #[cfg(not(target_os = "windows"))]
    let asset_url = format!("asset://localhost{}", path_str);
    
    Ok(asset_url)
}

// Alternative: Get image as base64 data URL
#[tauri::command]
pub async fn get_image_data_url(relative_path: String) -> Result<String, String> {
    // Handle environment-aware path resolution
    let full_path = if relative_path.starts_with("dev-data/") || relative_path.starts_with("app-data/") || relative_path.starts_with("images/") {
        // Convert relative path to absolute path based on environment
        if relative_path.starts_with("dev-data/") {
            // Development path: project_root/dev-data/...
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join(&relative_path)
        } else if relative_path.starts_with("app-data/") {
            // Production path: resolve to actual app data directory
            get_app_data_dir().join(&relative_path[9..]) // Remove "app-data/" prefix
        } else if relative_path.starts_with("images/") {
            // Legacy path: attachments/images/...
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join("attachments")
                .join(&relative_path)
        } else {
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join(&relative_path)
        }
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(&relative_path)
    };
    
    // Read the image file
    let image_data = fs::read(&full_path)
        .map_err(|e| format!("Failed to read image file: {}", e))?;
    
    // Encode to base64
    let base64_data = general_purpose::STANDARD.encode(&image_data);
    
    // Determine MIME type from file extension
    let mime_type = match full_path.extension().and_then(|s| s.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg", 
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        _ => "image/png", // default
    };
    
    // Return as data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}
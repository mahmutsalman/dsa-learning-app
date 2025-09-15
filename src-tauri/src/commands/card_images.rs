use crate::models::{AppState, CardImage, SaveCardImageRequest, DeleteCardImageRequest};
use base64::{Engine as _, engine::general_purpose};
use std::path::PathBuf;
use std::fs;
use tauri::State;
use uuid::Uuid;

// Helper function to get the card images directory using PathResolver
fn get_card_images_dir_with_resolver(path_resolver: &crate::path_resolver::PathResolver) -> anyhow::Result<PathBuf> {
    let images_dir = path_resolver.get_images_dir();
    let cards_dir = images_dir.join("cards");
    fs::create_dir_all(&cards_dir)?;
    Ok(cards_dir)
}

// Helper function to ensure card-specific directory exists using PathResolver
fn ensure_card_dir_with_resolver(path_resolver: &crate::path_resolver::PathResolver, card_id: &str) -> anyhow::Result<PathBuf> {
    let cards_dir = get_card_images_dir_with_resolver(path_resolver)?;
    let card_dir = cards_dir.join(format!("card_{}", card_id));
    fs::create_dir_all(&card_dir)?;
    Ok(card_dir)
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
pub async fn save_card_image(
    state: State<'_, AppState>,
    request: SaveCardImageRequest,
) -> Result<CardImage, String> {
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

    // Ensure card directory exists
    let card_dir = ensure_card_dir_with_resolver(&state.path_resolver, &request.card_id)
        .map_err(|e| format!("Failed to create card directory: {}", e))?;

    // Full path for file storage
    let full_path = card_dir.join(&filename);

    // Save the image file
    fs::write(&full_path, decoded_data)
        .map_err(|e| format!("Failed to save image file: {}", e))?;

    // Create relative path for database storage using PathResolver
    let relative_path = state.path_resolver.to_relative_path(&full_path);

    // Save to database
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    let image = db.save_card_image(
        &request.card_id,
        &relative_path,
        request.caption,
        request.position,
    ).map_err(|e| format!("Failed to save image to database: {}", e))?;

    Ok(image)
}

#[tauri::command]
pub async fn get_card_images(
    state: State<'_, AppState>,
    card_id: String,
) -> Result<Vec<CardImage>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_card_images(&card_id)
        .map_err(|e| format!("Failed to get card images: {}", e))
}

#[tauri::command]
pub async fn delete_card_image(
    state: State<'_, AppState>,
    request: DeleteCardImageRequest,
) -> Result<(), String> {
    println!("🗑️ Backend: Starting card image deletion for image_id: {}", request.image_id);

    let mut db = state.db.lock().map_err(|e| {
        let error_msg = format!("Failed to lock database: {}", e);
        println!("❌ Backend: {}", error_msg);
        error_msg
    })?;

    // Get the image path from database and delete the record
    println!("🔄 Backend: Querying database for image path and deleting record...");
    let image_path = db.delete_card_image(&request.image_id)
        .map_err(|e| {
            let error_msg = format!("Failed to delete image from database: {}", e);
            println!("❌ Backend: {}", error_msg);
            error_msg
        })?;

    println!("✅ Backend: Database record deleted, image_path: {}", image_path);

    // Delete the actual file using PathResolver
    let full_path = state.path_resolver.resolve_relative_path(&image_path);
    println!("🔄 Backend: Resolving file path: {} -> {}", image_path, full_path.display());

    if full_path.exists() {
        println!("🔄 Backend: File exists, attempting to delete...");
        fs::remove_file(&full_path)
            .map_err(|e| {
                let error_msg = format!("Failed to delete image file: {}", e);
                println!("❌ Backend: {}", error_msg);
                error_msg
            })?;
        println!("✅ Backend: File deleted successfully");
    } else {
        println!("⚠️ Backend: File doesn't exist at path: {}", full_path.display());
    }

    println!("✅ Backend: Card image deletion completed successfully");
    Ok(())
}

#[tauri::command]
pub async fn update_card_image_positions(
    state: State<'_, AppState>,
    updates: Vec<(String, i32)>,
) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_card_image_positions(updates)
        .map_err(|e| format!("Failed to update image positions: {}", e))
}

// Helper command to get the full path for a card image (for displaying in frontend)
#[tauri::command]
pub async fn get_card_image_path(state: State<'_, AppState>, relative_path: String) -> Result<String, String> {
    // Use PathResolver to handle environment-aware path resolution
    let full_path = state.path_resolver.resolve_relative_path(&relative_path);

    // Convert to string and use the asset protocol
    let path_str = full_path.to_string_lossy().to_string();

    // Use asset protocol for Tauri
    #[cfg(target_os = "windows")]
    let asset_url = format!("asset://localhost/{}", path_str.replace('\\', "/"));

    #[cfg(not(target_os = "windows"))]
    let asset_url = format!("asset://localhost{}", path_str);

    Ok(asset_url)
}

// Alternative: Get card image as base64 data URL
#[tauri::command]
pub async fn get_card_image_data_url(state: State<'_, AppState>, relative_path: String) -> Result<String, String> {
    // Use PathResolver to handle environment-aware path resolution
    let full_path = state.path_resolver.resolve_relative_path(&relative_path);

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
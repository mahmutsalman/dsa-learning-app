use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Production-ready path resolver that uses Tauri's native path resolution
/// instead of std::env::current_dir() which doesn't work in production bundles
pub struct PathResolver {
    app_data_dir: PathBuf,
}

impl PathResolver {
    /// Create a new path resolver using Tauri's app handle
    pub fn new(app_handle: &AppHandle) -> Result<Self, String> {
        let app_data_dir = if cfg!(debug_assertions) {
            // Development: use project dev-data folder
            std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?
                .join("dev-data")
        } else {
            // Production: use proper app data directory via Tauri
            app_handle
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data directory: {}", e))?
        };

        // Ensure the directory exists
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;

        Ok(Self { app_data_dir })
    }

    /// Get the base app data directory
    pub fn get_app_data_dir(&self) -> &PathBuf {
        &self.app_data_dir
    }

    /// Get the recordings directory path
    pub fn get_recordings_dir(&self) -> PathBuf {
        self.app_data_dir.join("recordings")
    }

    /// Get the images directory path
    pub fn get_images_dir(&self) -> PathBuf {
        self.app_data_dir.join("images")
    }

    /// Get the database file path
    pub fn get_database_path(&self) -> PathBuf {
        self.app_data_dir.join("database.db")
    }

    /// Convert a relative path (like "dev-data/recordings/file.wav") to absolute path
    pub fn resolve_relative_path(&self, relative_path: &str) -> PathBuf {
        if relative_path.starts_with("dev-data/") || relative_path.starts_with("app-data/") {
            // Strip the environment prefix and resolve relative to our app data dir
            let path_without_prefix = relative_path
                .split('/')
                .skip(1)
                .collect::<Vec<&str>>()
                .join("/");
            self.app_data_dir.join(path_without_prefix)
        } else {
            // Assume it's relative to app data dir
            self.app_data_dir.join(relative_path)
        }
    }

    /// Generate a relative path for storing in database
    /// Returns format like "dev-data/recordings/file.wav" or "app-data/recordings/file.wav"
    pub fn to_relative_path(&self, path: &PathBuf) -> String {
        let prefix = if cfg!(debug_assertions) {
            "dev-data"
        } else {
            "app-data"
        };

        if let Ok(relative) = path.strip_prefix(&self.app_data_dir) {
            format!("{}/{}", prefix, relative.to_string_lossy())
        } else {
            // Fallback - just use the filename if stripping fails
            format!("{}/unknown/{}", prefix, path.file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string()))
        }
    }

    /// Ensure a subdirectory exists and return its path
    pub fn ensure_subdir(&self, subdir: &str) -> Result<PathBuf, String> {
        let dir_path = self.app_data_dir.join(subdir);
        std::fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create directory {}: {}", subdir, e))?;
        Ok(dir_path)
    }
}

/// Legacy fallback for when PathResolver is not available
/// This should only be used during the transition period
pub fn get_app_data_dir_fallback() -> PathBuf {
    if cfg!(debug_assertions) {
        // Development: use project dev-data folder
        std::env::current_dir()
            .expect("Failed to get current directory")
            .join("dev-data")
    } else {
        // Production fallback using dirs crate
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
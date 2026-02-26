use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Storage statistics for a directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub file_count: u32,
    pub exists: bool,
}

/// Overall storage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub app_data: StorageStats,
    pub app_cache: StorageStats,
    pub app_config: StorageStats,
    pub app_log: StorageStats,
    pub total_size_bytes: u64,
    pub total_size_formatted: String,
    pub total_files: u32,
}

/// Result of a cleanup operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupResult {
    pub success: bool,
    pub freed_bytes: u64,
    pub freed_formatted: String,
    pub deleted_files: u32,
    pub errors: Vec<String>,
}

/// Storage category to clean
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StorageCategory {
    Cache,
    Logs,
    TempFiles,
    All,
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn calculate_dir_size(path: &PathBuf) -> (u64, u32) {
    let mut total_size: u64 = 0;
    let mut file_count: u32 = 0;

    if !path.exists() {
        return (0, 0);
    }

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                    file_count += 1;
                }
            } else if entry_path.is_dir() {
                let (sub_size, sub_count) = calculate_dir_size(&entry_path);
                total_size += sub_size;
                file_count += sub_count;
            }
        }
    }

    (total_size, file_count)
}

fn get_storage_stats(path: &PathBuf, name: &str) -> StorageStats {
    let exists = path.exists();
    let (size_bytes, file_count) = if exists {
        calculate_dir_size(path)
    } else {
        (0, 0)
    };

    StorageStats {
        path: path.to_string_lossy().to_string(),
        name: name.to_string(),
        size_bytes,
        size_formatted: format_size(size_bytes),
        file_count,
        exists,
    }
}

fn delete_dir_contents(path: &PathBuf) -> (u64, u32, Vec<String>) {
    let mut freed_bytes: u64 = 0;
    let mut deleted_files: u32 = 0;
    let mut errors: Vec<String> = Vec::new();

    if !path.exists() {
        return (0, 0, errors);
    }

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Ok(metadata) = entry.metadata() {
                    let size = metadata.len();
                    match fs::remove_file(&entry_path) {
                        Ok(_) => {
                            freed_bytes += size;
                            deleted_files += 1;
                        }
                        Err(e) => {
                            errors.push(format!(
                                "Failed to delete {}: {}",
                                entry_path.display(),
                                e
                            ));
                        }
                    }
                }
            } else if entry_path.is_dir() {
                let (sub_freed, sub_deleted, sub_errors) = delete_dir_contents(&entry_path);
                freed_bytes += sub_freed;
                deleted_files += sub_deleted;
                errors.extend(sub_errors);

                // Try to remove the empty directory
                if let Err(e) = fs::remove_dir(&entry_path) {
                    // Only report if it's not "directory not empty"
                    if e.kind() != std::io::ErrorKind::Other {
                        errors.push(format!(
                            "Failed to remove directory {}: {}",
                            entry_path.display(),
                            e
                        ));
                    }
                }
            }
        }
    }

    (freed_bytes, deleted_files, errors)
}

/// Get storage information for the application
#[tauri::command]
pub fn get_storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let app_cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get cache dir: {}", e))?;
    
    let app_config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    
    let app_log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get log dir: {}", e))?;

    let app_data = get_storage_stats(&app_data_dir, "Application Data");
    let app_cache = get_storage_stats(&app_cache_dir, "Cache");
    let app_config = get_storage_stats(&app_config_dir, "Configuration");
    let app_log = get_storage_stats(&app_log_dir, "Logs");

    // Calculate totals (avoiding double counting if dirs overlap)
    let mut unique_paths = std::collections::HashSet::new();
    let mut total_size_bytes = 0u64;
    let mut total_files = 0u32;

    for stats in [&app_data, &app_cache, &app_config, &app_log] {
        if stats.exists && unique_paths.insert(stats.path.clone()) {
            total_size_bytes += stats.size_bytes;
            total_files += stats.file_count;
        }
    }

    Ok(StorageInfo {
        app_data,
        app_cache,
        app_config,
        app_log,
        total_size_bytes,
        total_size_formatted: format_size(total_size_bytes),
        total_files,
    })
}

/// Clear storage for a specific category
#[tauri::command]
pub fn clear_storage(app: AppHandle, category: StorageCategory) -> Result<CleanupResult, String> {
    let mut total_freed: u64 = 0;
    let mut total_deleted: u32 = 0;
    let mut all_errors: Vec<String> = Vec::new();

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get cache dir: {}", e))?;
    
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get log dir: {}", e))?;

    match category {
        StorageCategory::Cache => {
            let (freed, deleted, errors) = delete_dir_contents(&cache_dir);
            total_freed += freed;
            total_deleted += deleted;
            all_errors.extend(errors);
        }
        StorageCategory::Logs => {
            let (freed, deleted, errors) = delete_dir_contents(&log_dir);
            total_freed += freed;
            total_deleted += deleted;
            all_errors.extend(errors);
        }
        StorageCategory::TempFiles => {
            // Clear only temp files from cache
            if cache_dir.exists() {
                if let Ok(entries) = fs::read_dir(&cache_dir) {
                    for entry in entries.flatten() {
                        let entry_path = entry.path();
                        let name = entry_path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("");
                        
                        // Only delete temp files (starting with tmp or ending with .tmp)
                        if name.starts_with("tmp") || name.ends_with(".tmp") || name.ends_with(".temp") {
                            if entry_path.is_file() {
                                if let Ok(metadata) = entry.metadata() {
                                    let size = metadata.len();
                                    match fs::remove_file(&entry_path) {
                                        Ok(_) => {
                                            total_freed += size;
                                            total_deleted += 1;
                                        }
                                        Err(e) => {
                                            all_errors.push(format!(
                                                "Failed to delete {}: {}",
                                                entry_path.display(),
                                                e
                                            ));
                                        }
                                    }
                                }
                            } else if entry_path.is_dir() {
                                let (freed, deleted, errors) = delete_dir_contents(&entry_path);
                                total_freed += freed;
                                total_deleted += deleted;
                                all_errors.extend(errors);
                                let _ = fs::remove_dir(&entry_path);
                            }
                        }
                    }
                }
            }
        }
        StorageCategory::All => {
            // Clear cache
            let (freed, deleted, errors) = delete_dir_contents(&cache_dir);
            total_freed += freed;
            total_deleted += deleted;
            all_errors.extend(errors);

            // Clear logs
            let (freed, deleted, errors) = delete_dir_contents(&log_dir);
            total_freed += freed;
            total_deleted += deleted;
            all_errors.extend(errors);
        }
    }

    Ok(CleanupResult {
        success: all_errors.is_empty(),
        freed_bytes: total_freed,
        freed_formatted: format_size(total_freed),
        deleted_files: total_deleted,
        errors: all_errors,
    })
}

/// Get the path to a specific storage directory
#[tauri::command]
pub fn get_storage_path(app: AppHandle, category: StorageCategory) -> Result<String, String> {
    let path = match category {
        StorageCategory::Cache => app.path().app_cache_dir(),
        StorageCategory::Logs => app.path().app_log_dir(),
        StorageCategory::TempFiles => app.path().app_cache_dir(),
        StorageCategory::All => app.path().app_data_dir(),
    }
    .map_err(|e| format!("Failed to get path: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

/// Open a storage directory in the system file manager
#[tauri::command]
pub fn open_storage_location(app: AppHandle, category: StorageCategory) -> Result<(), String> {
    let path = get_storage_path(app, category)?;
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

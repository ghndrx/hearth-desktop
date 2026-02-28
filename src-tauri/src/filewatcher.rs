//! File watcher for the Hearth desktop app
//!
//! Provides native file system watching capabilities:
//! - Watch directories for file changes (create, modify, delete)
//! - Emit events to the frontend on changes
//! - Used for download folder monitoring, attachment previews, etc.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

static NEXT_WATCHER_ID: AtomicU64 = AtomicU64::new(1);

/// Tracked watchers: id -> cancel flag
static WATCHERS: Mutex<Option<HashMap<u64, std::sync::Arc<AtomicBool>>>> = Mutex::new(None);

fn get_watchers() -> std::sync::MutexGuard<'static, Option<HashMap<u64, std::sync::Arc<AtomicBool>>>> {
    let mut guard = WATCHERS.lock().unwrap();
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    guard
}

/// A file change event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeEvent {
    /// Watcher ID that detected this change
    pub watcher_id: u64,
    /// The path that changed
    pub path: String,
    /// Type of change: "created", "modified", "deleted"
    pub change_type: String,
    /// File name
    pub file_name: String,
    /// File size in bytes (0 for deleted files)
    pub size: u64,
    /// Timestamp of the event (Unix ms)
    pub timestamp: u64,
}

/// Info about an active watcher
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatcherInfo {
    pub id: u64,
    pub path: String,
    pub active: bool,
}

/// Start watching a directory for file changes
/// Returns the watcher ID for later management
#[tauri::command]
pub fn watch_directory(app: AppHandle, path: String, recursive: Option<bool>) -> Result<u64, String> {
    let watch_path = PathBuf::from(&path);

    if !watch_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if !watch_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let id = NEXT_WATCHER_ID.fetch_add(1, Ordering::Relaxed);
    let cancel = std::sync::Arc::new(AtomicBool::new(false));
    let cancel_clone = cancel.clone();
    let recursive = recursive.unwrap_or(false);

    // Store the watcher
    {
        let mut watchers = get_watchers();
        watchers.as_mut().unwrap().insert(id, cancel);
    }

    // Spawn polling-based watcher (simpler, cross-platform, no extra deps)
    tauri::async_runtime::spawn(async move {
        let mut known_files: HashMap<String, (u64, u64)> = HashMap::new(); // path -> (size, modified_time)

        // Initial scan
        scan_directory(&watch_path, recursive, &mut known_files);

        log::info!("File watcher {} started on: {} ({} files)", id, path, known_files.len());

        loop {
            if cancel_clone.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            if cancel_clone.load(Ordering::Relaxed) {
                break;
            }

            let mut current_files: HashMap<String, (u64, u64)> = HashMap::new();
            scan_directory(&watch_path, recursive, &mut current_files);

            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            // Detect new and modified files
            for (file_path, (size, mtime)) in &current_files {
                if let Some((old_size, old_mtime)) = known_files.get(file_path) {
                    if size != old_size || mtime != old_mtime {
                        let event = FileChangeEvent {
                            watcher_id: id,
                            path: file_path.clone(),
                            change_type: "modified".to_string(),
                            file_name: PathBuf::from(file_path)
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string(),
                            size: *size,
                            timestamp: now,
                        };
                        let _ = app.emit("filewatcher:change", &event);
                    }
                } else {
                    let event = FileChangeEvent {
                        watcher_id: id,
                        path: file_path.clone(),
                        change_type: "created".to_string(),
                        file_name: PathBuf::from(file_path)
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        size: *size,
                        timestamp: now,
                    };
                    let _ = app.emit("filewatcher:change", &event);
                }
            }

            // Detect deleted files
            for (file_path, _) in &known_files {
                if !current_files.contains_key(file_path) {
                    let event = FileChangeEvent {
                        watcher_id: id,
                        path: file_path.clone(),
                        change_type: "deleted".to_string(),
                        file_name: PathBuf::from(file_path)
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        size: 0,
                        timestamp: now,
                    };
                    let _ = app.emit("filewatcher:change", &event);
                }
            }

            known_files = current_files;
        }

        log::info!("File watcher {} stopped", id);
    });

    Ok(id)
}

/// Stop a file watcher by ID
#[tauri::command]
pub fn unwatch_directory(watcher_id: u64) -> Result<(), String> {
    let mut watchers = get_watchers();
    if let Some(cancel) = watchers.as_mut().unwrap().remove(&watcher_id) {
        cancel.store(true, Ordering::Relaxed);
        log::info!("File watcher {} cancelled", watcher_id);
        Ok(())
    } else {
        Err(format!("Watcher {} not found", watcher_id))
    }
}

/// Stop all active file watchers
#[tauri::command]
pub fn unwatch_all() -> Result<u32, String> {
    let mut watchers = get_watchers();
    let map = watchers.as_mut().unwrap();
    let count = map.len() as u32;

    for (_, cancel) in map.drain() {
        cancel.store(true, Ordering::Relaxed);
    }

    log::info!("Stopped {} file watchers", count);
    Ok(count)
}

/// List all active file watchers
#[tauri::command]
pub fn list_watchers() -> Vec<WatcherInfo> {
    let watchers = get_watchers();
    watchers
        .as_ref()
        .unwrap()
        .iter()
        .map(|(id, cancel)| WatcherInfo {
            id: *id,
            path: String::new(), // Path not stored separately
            active: !cancel.load(Ordering::Relaxed),
        })
        .collect()
}

/// Scan a directory and collect file metadata
fn scan_directory(dir: &PathBuf, recursive: bool, files: &mut HashMap<String, (u64, u64)>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_file() {
            if let Ok(metadata) = std::fs::metadata(&path) {
                let mtime = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                files.insert(
                    path.to_string_lossy().to_string(),
                    (metadata.len(), mtime),
                );
            }
        } else if path.is_dir() && recursive {
            scan_directory(&path, recursive, files);
        }
    }
}

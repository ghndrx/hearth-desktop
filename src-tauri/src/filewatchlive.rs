//! File Watcher Live - watch directories for real-time file change events

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeEvent {
    pub path: String,
    pub event_type: String, // "created", "modified", "deleted", "renamed"
    pub timestamp: String,
    pub size_bytes: Option<u64>,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherStats {
    pub watching: bool,
    pub watch_path: Option<String>,
    pub events: Vec<FileChangeEvent>,
    pub total_events: u32,
    pub created_count: u32,
    pub modified_count: u32,
    pub deleted_count: u32,
}

pub struct FileWatchLiveManager {
    events: Mutex<Vec<FileChangeEvent>>,
    watch_path: Mutex<Option<String>>,
}

impl Default for FileWatchLiveManager {
    fn default() -> Self {
        Self {
            events: Mutex::new(Vec::new()),
            watch_path: Mutex::new(None),
        }
    }
}

fn scan_dir_snapshot(path: &str) -> Result<Vec<(String, u64, bool)>, String> {
    let mut entries = Vec::new();
    let dir = std::fs::read_dir(path).map_err(|e| e.to_string())?;
    for entry in dir.flatten() {
        let meta = entry.metadata().ok();
        entries.push((
            entry.path().to_string_lossy().to_string(),
            meta.as_ref().map(|m| m.len()).unwrap_or(0),
            meta.as_ref().map(|m| m.is_dir()).unwrap_or(false),
        ));
    }
    Ok(entries)
}

#[tauri::command]
pub fn filewatchlive_set_path(path: String, manager: tauri::State<'_, FileWatchLiveManager>) -> Result<WatcherStats, String> {
    // Verify path exists
    if !std::path::Path::new(&path).is_dir() {
        return Err(format!("Not a directory: {}", path));
    }
    let mut wp = manager.watch_path.lock().map_err(|e| e.to_string())?;
    *wp = Some(path.clone());

    // Clear old events
    let mut events = manager.events.lock().map_err(|e| e.to_string())?;
    events.clear();

    // Add initial snapshot as "created" events
    if let Ok(entries) = scan_dir_snapshot(&path) {
        let now = chrono::Local::now().to_rfc3339();
        for (entry_path, size, is_dir) in entries {
            events.push(FileChangeEvent {
                path: entry_path,
                event_type: "existing".into(),
                timestamp: now.clone(),
                size_bytes: Some(size),
                is_dir,
            });
        }
    }

    let total = events.len() as u32;
    Ok(WatcherStats {
        watching: true,
        watch_path: Some(path),
        events: events.clone(),
        total_events: total,
        created_count: 0,
        modified_count: 0,
        deleted_count: 0,
    })
}

#[tauri::command]
pub fn filewatchlive_poll(manager: tauri::State<'_, FileWatchLiveManager>) -> Result<WatcherStats, String> {
    let wp = manager.watch_path.lock().map_err(|e| e.to_string())?;
    let watch_path = wp.clone();
    drop(wp);

    if let Some(ref path) = watch_path {
        // Quick re-scan to detect changes
        if let Ok(current_entries) = scan_dir_snapshot(path) {
            let mut events = manager.events.lock().map_err(|e| e.to_string())?;
            let existing_paths: std::collections::HashSet<String> = events.iter().map(|e| e.path.clone()).collect();
            let current_paths: std::collections::HashSet<String> = current_entries.iter().map(|(p, _, _)| p.clone()).collect();
            let now = chrono::Local::now().to_rfc3339();

            // Detect new files
            for (entry_path, size, is_dir) in &current_entries {
                if !existing_paths.contains(entry_path) {
                    events.insert(0, FileChangeEvent {
                        path: entry_path.clone(),
                        event_type: "created".into(),
                        timestamp: now.clone(),
                        size_bytes: Some(*size),
                        is_dir: *is_dir,
                    });
                }
            }

            // Detect deleted files (only from non-"existing" events that were "created")
            for existing in existing_paths.iter() {
                if !current_paths.contains(existing) && existing.starts_with(path.as_str()) {
                    events.insert(0, FileChangeEvent {
                        path: existing.clone(),
                        event_type: "deleted".into(),
                        timestamp: now.clone(),
                        size_bytes: None,
                        is_dir: false,
                    });
                }
            }

            if events.len() > 200 { events.truncate(200); }

            let created = events.iter().filter(|e| e.event_type == "created").count() as u32;
            let modified = events.iter().filter(|e| e.event_type == "modified").count() as u32;
            let deleted = events.iter().filter(|e| e.event_type == "deleted").count() as u32;
            let total = events.len() as u32;

            return Ok(WatcherStats {
                watching: true,
                watch_path: watch_path,
                events: events.iter().take(50).cloned().collect(),
                total_events: total,
                created_count: created,
                modified_count: modified,
                deleted_count: deleted,
            });
        }
    }

    Ok(WatcherStats {
        watching: false,
        watch_path: None,
        events: Vec::new(),
        total_events: 0,
        created_count: 0,
        modified_count: 0,
        deleted_count: 0,
    })
}

#[tauri::command]
pub fn filewatchlive_stop(manager: tauri::State<'_, FileWatchLiveManager>) -> Result<(), String> {
    let mut wp = manager.watch_path.lock().map_err(|e| e.to_string())?;
    *wp = None;
    Ok(())
}

#[tauri::command]
pub fn filewatchlive_clear(manager: tauri::State<'_, FileWatchLiveManager>) -> Result<(), String> {
    let mut events = manager.events.lock().map_err(|e| e.to_string())?;
    events.clear();
    Ok(())
}

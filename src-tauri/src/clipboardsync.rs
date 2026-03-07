//! Clipboard Sync Manager - Cross-device clipboard synchronization state tracking
//!
//! Provides:
//! - Track clipboard entries with timestamps, source device, and content type
//! - Manage sync settings (auto-sync, max entries, content type filters)
//! - Statistics on sync activity
//! - Entry CRUD operations

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipSyncEntry {
    pub id: String,
    pub content: String,
    pub content_type: String, // "text", "image", "file"
    pub source_device: String,
    pub timestamp: String,
    pub synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipSyncSettings {
    pub enabled: bool,
    pub max_entries: usize,
    pub auto_sync: bool,
    pub sync_images: bool,
    pub sync_files: bool,
}

impl Default for ClipSyncSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            max_entries: 100,
            auto_sync: true,
            sync_images: true,
            sync_files: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipSyncStats {
    pub total_entries: usize,
    pub synced_entries: usize,
    pub text_entries: usize,
    pub image_entries: usize,
    pub file_entries: usize,
    pub devices: Vec<String>,
    pub last_sync_time: Option<String>,
}

#[derive(Debug)]
pub struct ClipSyncState {
    entries: Vec<ClipSyncEntry>,
    settings: ClipSyncSettings,
    last_sync_time: Option<String>,
}

impl Default for ClipSyncState {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
            settings: ClipSyncSettings::default(),
            last_sync_time: None,
        }
    }
}

#[derive(Default)]
pub struct ClipSyncManager {
    state: Mutex<ClipSyncState>,
}

#[tauri::command]
pub async fn clipsync_get_entries(
    content_type: Option<String>,
    device: Option<String>,
    limit: Option<usize>,
    manager: State<'_, ClipSyncManager>,
) -> Result<Vec<ClipSyncEntry>, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    let entries: Vec<ClipSyncEntry> = state
        .entries
        .iter()
        .filter(|e| {
            content_type
                .as_ref()
                .map(|ct| e.content_type == *ct)
                .unwrap_or(true)
        })
        .filter(|e| {
            device
                .as_ref()
                .map(|d| e.source_device == *d)
                .unwrap_or(true)
        })
        .take(limit.unwrap_or(100))
        .cloned()
        .collect();
    Ok(entries)
}

#[tauri::command]
pub async fn clipsync_add_entry(
    content: String,
    content_type: String,
    source_device: String,
    manager: State<'_, ClipSyncManager>,
) -> Result<ClipSyncEntry, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    // Validate content_type
    if !["text", "image", "file"].contains(&content_type.as_str()) {
        return Err("Invalid content_type: must be 'text', 'image', or 'file'".to_string());
    }

    // Check settings for content type filters
    if content_type == "image" && !state.settings.sync_images {
        return Err("Image sync is disabled in settings".to_string());
    }
    if content_type == "file" && !state.settings.sync_files {
        return Err("File sync is disabled in settings".to_string());
    }

    let entry = ClipSyncEntry {
        id: uuid::Uuid::new_v4().to_string(),
        content,
        content_type,
        source_device,
        timestamp: Utc::now().to_rfc3339(),
        synced: state.settings.auto_sync,
    };

    state.entries.insert(0, entry.clone());
    state.last_sync_time = Some(Utc::now().to_rfc3339());

    // Trim to max_entries
    let max = state.settings.max_entries;
    if state.entries.len() > max {
        state.entries.truncate(max);
    }

    Ok(entry)
}

#[tauri::command]
pub async fn clipsync_clear(
    manager: State<'_, ClipSyncManager>,
) -> Result<usize, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let count = state.entries.len();
    state.entries.clear();
    Ok(count)
}

#[tauri::command]
pub async fn clipsync_get_settings(
    manager: State<'_, ClipSyncManager>,
) -> Result<ClipSyncSettings, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.settings.clone())
}

#[tauri::command]
pub async fn clipsync_update_settings(
    enabled: Option<bool>,
    max_entries: Option<usize>,
    auto_sync: Option<bool>,
    sync_images: Option<bool>,
    sync_files: Option<bool>,
    manager: State<'_, ClipSyncManager>,
) -> Result<ClipSyncSettings, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    if let Some(v) = enabled {
        state.settings.enabled = v;
    }
    if let Some(v) = max_entries {
        state.settings.max_entries = v;
    }
    if let Some(v) = auto_sync {
        state.settings.auto_sync = v;
    }
    if let Some(v) = sync_images {
        state.settings.sync_images = v;
    }
    if let Some(v) = sync_files {
        state.settings.sync_files = v;
    }

    // Trim entries if max was reduced
    let max = state.settings.max_entries;
    if state.entries.len() > max {
        state.entries.truncate(max);
    }

    Ok(state.settings.clone())
}

#[tauri::command]
pub async fn clipsync_get_stats(
    manager: State<'_, ClipSyncManager>,
) -> Result<ClipSyncStats, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;

    let mut devices: Vec<String> = state
        .entries
        .iter()
        .map(|e| e.source_device.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    devices.sort();

    Ok(ClipSyncStats {
        total_entries: state.entries.len(),
        synced_entries: state.entries.iter().filter(|e| e.synced).count(),
        text_entries: state.entries.iter().filter(|e| e.content_type == "text").count(),
        image_entries: state.entries.iter().filter(|e| e.content_type == "image").count(),
        file_entries: state.entries.iter().filter(|e| e.content_type == "file").count(),
        devices,
        last_sync_time: state.last_sync_time.clone(),
    })
}

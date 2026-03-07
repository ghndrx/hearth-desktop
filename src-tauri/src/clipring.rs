//! Clipboard Ring - circular clipboard history buffer with search and pinning

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipEntry {
    pub id: u32,
    pub content: String,
    pub content_type: String, // "text", "url", "code", "path"
    pub timestamp: String,
    pub pinned: bool,
    pub char_count: usize,
    pub word_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipRingStats {
    pub entries: Vec<ClipEntry>,
    pub total: u32,
    pub pinned_count: u32,
    pub capacity: u32,
}

pub struct ClipRingManager {
    entries: Mutex<Vec<ClipEntry>>,
    next_id: Mutex<u32>,
    capacity: u32,
}

impl Default for ClipRingManager {
    fn default() -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
            next_id: Mutex::new(1),
            capacity: 50,
        }
    }
}

fn detect_content_type(content: &str) -> String {
    let trimmed = content.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        "url".into()
    } else if trimmed.starts_with('/') || trimmed.starts_with("~/") || trimmed.contains("\\\\") {
        "path".into()
    } else if trimmed.contains("fn ") || trimmed.contains("function ") || trimmed.contains("class ")
        || trimmed.contains("import ") || trimmed.contains("const ") || trimmed.contains("let ")
        || trimmed.contains("def ") || trimmed.contains("pub ") {
        "code".into()
    } else {
        "text".into()
    }
}

#[tauri::command]
pub fn clipring_add(content: String, manager: tauri::State<'_, ClipRingManager>) -> Result<ClipRingStats, String> {
    let mut entries = manager.entries.lock().map_err(|e| e.to_string())?;
    let mut next_id = manager.next_id.lock().map_err(|e| e.to_string())?;

    // Don't add duplicates of the most recent entry
    if let Some(last) = entries.first() {
        if last.content == content {
            let pinned_count = entries.iter().filter(|e| e.pinned).count() as u32;
            return Ok(ClipRingStats {
                total: entries.len() as u32,
                pinned_count,
                capacity: manager.capacity,
                entries: entries.clone(),
            });
        }
    }

    let word_count = content.split_whitespace().count();
    let entry = ClipEntry {
        id: *next_id,
        content: content.clone(),
        content_type: detect_content_type(&content),
        timestamp: chrono::Local::now().to_rfc3339(),
        pinned: false,
        char_count: content.len(),
        word_count,
    };
    *next_id += 1;

    entries.insert(0, entry);

    // Evict unpinned entries beyond capacity
    while entries.len() > manager.capacity as usize {
        if let Some(pos) = entries.iter().rposition(|e| !e.pinned) {
            entries.remove(pos);
        } else {
            break;
        }
    }

    let pinned_count = entries.iter().filter(|e| e.pinned).count() as u32;
    Ok(ClipRingStats {
        total: entries.len() as u32,
        pinned_count,
        capacity: manager.capacity,
        entries: entries.clone(),
    })
}

#[tauri::command]
pub fn clipring_list(manager: tauri::State<'_, ClipRingManager>) -> Result<ClipRingStats, String> {
    let entries = manager.entries.lock().map_err(|e| e.to_string())?;
    let pinned_count = entries.iter().filter(|e| e.pinned).count() as u32;
    Ok(ClipRingStats {
        total: entries.len() as u32,
        pinned_count,
        capacity: manager.capacity,
        entries: entries.clone(),
    })
}

#[tauri::command]
pub fn clipring_pin(id: u32, pinned: bool, manager: tauri::State<'_, ClipRingManager>) -> Result<(), String> {
    let mut entries = manager.entries.lock().map_err(|e| e.to_string())?;
    if let Some(entry) = entries.iter_mut().find(|e| e.id == id) {
        entry.pinned = pinned;
    }
    Ok(())
}

#[tauri::command]
pub fn clipring_remove(id: u32, manager: tauri::State<'_, ClipRingManager>) -> Result<(), String> {
    let mut entries = manager.entries.lock().map_err(|e| e.to_string())?;
    entries.retain(|e| e.id != id);
    Ok(())
}

#[tauri::command]
pub fn clipring_clear(manager: tauri::State<'_, ClipRingManager>) -> Result<(), String> {
    let mut entries = manager.entries.lock().map_err(|e| e.to_string())?;
    entries.retain(|e| e.pinned); // Keep pinned
    Ok(())
}

#[tauri::command]
pub fn clipring_search(query: String, manager: tauri::State<'_, ClipRingManager>) -> Result<Vec<ClipEntry>, String> {
    let entries = manager.entries.lock().map_err(|e| e.to_string())?;
    let lower_query = query.to_lowercase();
    let results: Vec<ClipEntry> = entries.iter()
        .filter(|e| e.content.to_lowercase().contains(&lower_query))
        .cloned()
        .collect();
    Ok(results)
}

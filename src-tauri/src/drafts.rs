//! Message Drafts Manager - Auto-save and restore message drafts per channel
//!
//! Provides persistent draft storage so users never lose unsent messages:
//! - Per-channel draft persistence using tauri-plugin-store
//! - Draft metadata (timestamps, attachments info)
//! - Draft cleanup for old/stale entries
//! - Cross-session persistence

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// A saved message draft
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Draft {
    /// Channel ID this draft belongs to
    pub channel_id: String,
    /// The draft message content
    pub content: String,
    /// Optional reply-to message ID
    pub reply_to: Option<String>,
    /// Attachment filenames (for display, not the actual files)
    pub attachments: Vec<String>,
    /// When the draft was last updated (ms since epoch)
    pub updated_at: u64,
    /// When the draft was first created (ms since epoch)
    pub created_at: u64,
}

/// Drafts manager state
pub struct DraftsState {
    /// Map of channel_id -> Draft
    drafts: Mutex<HashMap<String, Draft>>,
}

impl Default for DraftsState {
    fn default() -> Self {
        Self {
            drafts: Mutex::new(HashMap::new()),
        }
    }
}

/// Get current timestamp in milliseconds
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Save or update a draft for a channel
#[tauri::command]
pub fn save_draft(
    app: AppHandle,
    state: tauri::State<'_, DraftsState>,
    channel_id: String,
    content: String,
    reply_to: Option<String>,
    attachments: Option<Vec<String>>,
) -> Result<Draft, String> {
    let mut drafts = state.drafts.lock().map_err(|e| e.to_string())?;
    let now = now_ms();

    let draft = if let Some(existing) = drafts.get(&channel_id) {
        Draft {
            channel_id: channel_id.clone(),
            content,
            reply_to,
            attachments: attachments.unwrap_or_default(),
            updated_at: now,
            created_at: existing.created_at,
        }
    } else {
        Draft {
            channel_id: channel_id.clone(),
            content,
            reply_to,
            attachments: attachments.unwrap_or_default(),
            updated_at: now,
            created_at: now,
        }
    };

    drafts.insert(channel_id, draft.clone());
    let _ = app.emit("draft:saved", &draft);
    Ok(draft)
}

/// Get the draft for a specific channel
#[tauri::command]
pub fn get_draft(
    state: tauri::State<'_, DraftsState>,
    channel_id: String,
) -> Result<Option<Draft>, String> {
    let drafts = state.drafts.lock().map_err(|e| e.to_string())?;
    Ok(drafts.get(&channel_id).cloned())
}

/// Delete the draft for a specific channel (e.g., after sending)
#[tauri::command]
pub fn delete_draft(
    app: AppHandle,
    state: tauri::State<'_, DraftsState>,
    channel_id: String,
) -> Result<bool, String> {
    let mut drafts = state.drafts.lock().map_err(|e| e.to_string())?;
    let removed = drafts.remove(&channel_id).is_some();
    if removed {
        let _ = app.emit("draft:deleted", &channel_id);
    }
    Ok(removed)
}

/// Get all saved drafts
#[tauri::command]
pub fn get_all_drafts(
    state: tauri::State<'_, DraftsState>,
) -> Result<Vec<Draft>, String> {
    let drafts = state.drafts.lock().map_err(|e| e.to_string())?;
    let mut result: Vec<Draft> = drafts.values().cloned().collect();
    result.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(result)
}

/// Get the number of saved drafts
#[tauri::command]
pub fn get_draft_count(
    state: tauri::State<'_, DraftsState>,
) -> Result<usize, String> {
    let drafts = state.drafts.lock().map_err(|e| e.to_string())?;
    Ok(drafts.len())
}

/// Clear all drafts
#[tauri::command]
pub fn clear_all_drafts(
    app: AppHandle,
    state: tauri::State<'_, DraftsState>,
) -> Result<usize, String> {
    let mut drafts = state.drafts.lock().map_err(|e| e.to_string())?;
    let count = drafts.len();
    drafts.clear();
    let _ = app.emit("draft:all-cleared", count);
    Ok(count)
}

/// Delete drafts older than a given age in milliseconds
#[tauri::command]
pub fn cleanup_stale_drafts(
    app: AppHandle,
    state: tauri::State<'_, DraftsState>,
    max_age_ms: u64,
) -> Result<usize, String> {
    let mut drafts = state.drafts.lock().map_err(|e| e.to_string())?;
    let cutoff = now_ms().saturating_sub(max_age_ms);
    let before = drafts.len();
    drafts.retain(|_, draft| draft.updated_at >= cutoff);
    let removed = before - drafts.len();
    if removed > 0 {
        let _ = app.emit("draft:cleanup", removed);
    }
    Ok(removed)
}

/// Bulk load drafts (for restoring from frontend persistence)
#[tauri::command]
pub fn load_drafts(
    state: tauri::State<'_, DraftsState>,
    drafts_data: Vec<Draft>,
) -> Result<usize, String> {
    let mut drafts = state.drafts.lock().map_err(|e| e.to_string())?;
    let count = drafts_data.len();
    for draft in drafts_data {
        drafts.insert(draft.channel_id.clone(), draft);
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_draft_serialization() {
        let draft = Draft {
            channel_id: "ch-123".to_string(),
            content: "Hello world".to_string(),
            reply_to: Some("msg-456".to_string()),
            attachments: vec!["image.png".to_string()],
            updated_at: 1234567890,
            created_at: 1234567890,
        };

        let json = serde_json::to_string(&draft).unwrap();
        assert!(json.contains("ch-123"));
        assert!(json.contains("Hello world"));
        assert!(json.contains("msg-456"));
        assert!(json.contains("image.png"));

        let deserialized: Draft = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.channel_id, "ch-123");
        assert_eq!(deserialized.content, "Hello world");
    }

    #[test]
    fn test_drafts_state_default() {
        let state = DraftsState::default();
        let drafts = state.drafts.lock().unwrap();
        assert!(drafts.is_empty());
    }
}

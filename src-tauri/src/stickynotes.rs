//! Sticky Notes - Floating colored notes for Hearth Desktop
//!
//! Provides:
//! - Create/update/delete sticky notes
//! - Pin/unpin notes
//! - Color coding (yellow, pink, blue, green, purple, orange)
//! - Position and size tracking for floating layout
//! - Markdown support in content
//! - Link to channel/message context
//! - Archive and restore notes

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Available sticky note colors
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StickyNoteColor {
    Yellow,
    Pink,
    Blue,
    Green,
    Purple,
    Orange,
}

impl Default for StickyNoteColor {
    fn default() -> Self {
        StickyNoteColor::Yellow
    }
}

/// A single sticky note
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StickyNote {
    pub id: String,
    pub content: String,
    pub color: StickyNoteColor,
    pub position_x: f64,
    pub position_y: f64,
    pub width: f64,
    pub height: f64,
    pub pinned: bool,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub channel_id: Option<String>,
    pub message_id: Option<String>,
}

impl StickyNote {
    fn new(content: String, color: StickyNoteColor, position_x: f64, position_y: f64) -> Self {
        let now = Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            content,
            color,
            position_x,
            position_y,
            width: 240.0,
            height: 200.0,
            pinned: false,
            archived: false,
            created_at: now.clone(),
            updated_at: now,
            channel_id: None,
            message_id: None,
        }
    }
}

/// Managed state for sticky notes
pub struct StickyNotesManager {
    notes: Mutex<Vec<StickyNote>>,
}

impl Default for StickyNotesManager {
    fn default() -> Self {
        Self {
            notes: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn sticky_create(
    state: State<'_, StickyNotesManager>,
    content: String,
    color: Option<StickyNoteColor>,
    position_x: Option<f64>,
    position_y: Option<f64>,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = StickyNote::new(
        content,
        color.unwrap_or_default(),
        position_x.unwrap_or(100.0),
        position_y.unwrap_or(100.0),
    );
    let created = note.clone();
    notes.push(note);
    Ok(created)
}

#[tauri::command]
pub fn sticky_update(
    state: State<'_, StickyNotesManager>,
    id: String,
    content: String,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Sticky note not found".to_string())?;
    note.content = content;
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn sticky_delete(
    state: State<'_, StickyNotesManager>,
    id: String,
) -> Result<bool, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let len_before = notes.len();
    notes.retain(|n| n.id != id);
    Ok(notes.len() < len_before)
}

#[tauri::command]
pub fn sticky_get_all(
    state: State<'_, StickyNotesManager>,
) -> Result<Vec<StickyNote>, String> {
    let notes = state.notes.lock().map_err(|e| e.to_string())?;
    Ok(notes.iter().filter(|n| !n.archived).cloned().collect())
}

#[tauri::command]
pub fn sticky_set_color(
    state: State<'_, StickyNotesManager>,
    id: String,
    color: StickyNoteColor,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Sticky note not found".to_string())?;
    note.color = color;
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn sticky_set_position(
    state: State<'_, StickyNotesManager>,
    id: String,
    x: f64,
    y: f64,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Sticky note not found".to_string())?;
    note.position_x = x;
    note.position_y = y;
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn sticky_set_size(
    state: State<'_, StickyNotesManager>,
    id: String,
    width: f64,
    height: f64,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Sticky note not found".to_string())?;
    note.width = width;
    note.height = height;
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn sticky_toggle_pin(
    state: State<'_, StickyNotesManager>,
    id: String,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Sticky note not found".to_string())?;
    note.pinned = !note.pinned;
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn sticky_archive(
    state: State<'_, StickyNotesManager>,
    id: String,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Sticky note not found".to_string())?;
    note.archived = true;
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn sticky_get_archived(
    state: State<'_, StickyNotesManager>,
) -> Result<Vec<StickyNote>, String> {
    let notes = state.notes.lock().map_err(|e| e.to_string())?;
    Ok(notes.iter().filter(|n| n.archived).cloned().collect())
}

#[tauri::command]
pub fn sticky_restore(
    state: State<'_, StickyNotesManager>,
    id: String,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Sticky note not found".to_string())?;
    note.archived = false;
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn sticky_link_to_message(
    state: State<'_, StickyNotesManager>,
    id: String,
    channel_id: String,
    message_id: String,
) -> Result<StickyNote, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Sticky note not found".to_string())?;
    note.channel_id = Some(channel_id);
    note.message_id = Some(message_id);
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn sticky_clear_archived(
    state: State<'_, StickyNotesManager>,
) -> Result<usize, String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let len_before = notes.len();
    notes.retain(|n| !n.archived);
    Ok(len_before - notes.len())
}

//! Quick Notes - Floating scratchpad for Hearth Desktop
//!
//! Provides:
//! - Persistent notes that survive app restarts
//! - Multiple note tabs with titles
//! - Pin/unpin notes to stay on top
//! - Markdown support in notes
//! - Quick capture from chat context

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// A single note entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub pinned: bool,
    pub color: Option<String>,
    pub tags: Vec<String>,
    pub source_channel_id: Option<String>,
    pub source_message_id: Option<String>,
}

impl Note {
    fn new(title: String, content: String) -> Self {
        let now = Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            content,
            created_at: now.clone(),
            updated_at: now,
            pinned: false,
            color: None,
            tags: Vec::new(),
            source_channel_id: None,
            source_message_id: None,
        }
    }
}

/// Quick Notes state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickNotesState {
    pub notes: Vec<Note>,
    pub active_note_id: Option<String>,
    pub is_visible: bool,
    pub is_pinned: bool,
}

impl Default for QuickNotesState {
    fn default() -> Self {
        Self {
            notes: vec![Note::new(
                "Scratch Pad".to_string(),
                String::new(),
            )],
            active_note_id: None,
            is_visible: false,
            is_pinned: false,
        }
    }
}

/// Managed state
pub struct QuickNotesManager {
    state: Mutex<QuickNotesState>,
}

impl Default for QuickNotesManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(QuickNotesState::default()),
        }
    }
}

#[tauri::command]
pub fn quicknotes_get_state(
    state: State<'_, QuickNotesManager>,
) -> Result<QuickNotesState, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    Ok(s.clone())
}

#[tauri::command]
pub fn quicknotes_create(
    state: State<'_, QuickNotesManager>,
    title: String,
    content: Option<String>,
    color: Option<String>,
    tags: Option<Vec<String>>,
    source_channel_id: Option<String>,
    source_message_id: Option<String>,
) -> Result<Note, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let mut note = Note::new(title, content.unwrap_or_default());
    note.color = color;
    note.tags = tags.unwrap_or_default();
    note.source_channel_id = source_channel_id;
    note.source_message_id = source_message_id;
    let created = note.clone();
    s.notes.push(note);
    s.active_note_id = Some(created.id.clone());
    Ok(created)
}

#[tauri::command]
pub fn quicknotes_update(
    state: State<'_, QuickNotesManager>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    color: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<Note, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let note = s
        .notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Note not found".to_string())?;

    if let Some(title) = title {
        note.title = title;
    }
    if let Some(content) = content {
        note.content = content;
    }
    if let Some(color) = color {
        note.color = Some(color);
    }
    if let Some(tags) = tags {
        note.tags = tags;
    }
    note.updated_at = Utc::now().to_rfc3339();

    Ok(note.clone())
}

#[tauri::command]
pub fn quicknotes_delete(
    state: State<'_, QuickNotesManager>,
    id: String,
) -> Result<(), String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.notes.retain(|n| n.id != id);
    if s.active_note_id.as_deref() == Some(&id) {
        s.active_note_id = s.notes.first().map(|n| n.id.clone());
    }
    Ok(())
}

#[tauri::command]
pub fn quicknotes_toggle_pin(
    state: State<'_, QuickNotesManager>,
    id: String,
) -> Result<Note, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let note = s
        .notes
        .iter_mut()
        .find(|n| n.id == id)
        .ok_or_else(|| "Note not found".to_string())?;
    note.pinned = !note.pinned;
    note.updated_at = Utc::now().to_rfc3339();
    Ok(note.clone())
}

#[tauri::command]
pub fn quicknotes_set_active(
    state: State<'_, QuickNotesManager>,
    id: String,
) -> Result<(), String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    if s.notes.iter().any(|n| n.id == id) {
        s.active_note_id = Some(id);
        Ok(())
    } else {
        Err("Note not found".to_string())
    }
}

#[tauri::command]
pub fn quicknotes_toggle_visible(
    state: State<'_, QuickNotesManager>,
    app: AppHandle,
) -> Result<bool, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.is_visible = !s.is_visible;
    let _ = app.emit("quicknotes-visibility-changed", s.is_visible);
    Ok(s.is_visible)
}

#[tauri::command]
pub fn quicknotes_get_all(
    state: State<'_, QuickNotesManager>,
) -> Result<Vec<Note>, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    Ok(s.notes.clone())
}

#[tauri::command]
pub fn quicknotes_search(
    state: State<'_, QuickNotesManager>,
    query: String,
) -> Result<Vec<Note>, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    let query_lower = query.to_lowercase();
    let results: Vec<Note> = s
        .notes
        .iter()
        .filter(|n| {
            n.title.to_lowercase().contains(&query_lower)
                || n.content.to_lowercase().contains(&query_lower)
                || n.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
        })
        .cloned()
        .collect();
    Ok(results)
}

#[tauri::command]
pub fn quicknotes_export(
    state: State<'_, QuickNotesManager>,
) -> Result<String, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&s.notes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quicknotes_import(
    state: State<'_, QuickNotesManager>,
    json: String,
) -> Result<Vec<Note>, String> {
    let imported: Vec<Note> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.notes.extend(imported.clone());
    Ok(imported)
}

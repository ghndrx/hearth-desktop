//! Clipboard Image Preview - Enhanced clipboard with image thumbnails
//!
//! Provides:
//! - Watch clipboard for image content
//! - Generate thumbnails for clipboard images
//! - Clipboard media history with previews
//! - Quick paste from clipboard history
//! - Image metadata extraction

use chrono::Utc;
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardMediaEntry {
    pub id: String,
    pub content_type: String,
    pub thumbnail_base64: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub size_bytes: u64,
    pub format: Option<String>,
    pub text_preview: Option<String>,
    pub timestamp: String,
    pub is_pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardPreviewState {
    pub entries: Vec<ClipboardMediaEntry>,
    pub max_entries: usize,
    pub thumbnail_size: u32,
    pub is_monitoring: bool,
    pub total_captured: u64,
}

impl Default for ClipboardPreviewState {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
            max_entries: 50,
            thumbnail_size: 128,
            is_monitoring: false,
            total_captured: 0,
        }
    }
}

pub struct ClipboardPreviewManager {
    state: Mutex<ClipboardPreviewState>,
}

impl Default for ClipboardPreviewManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(ClipboardPreviewState::default()),
        }
    }
}

fn generate_thumbnail(image_data: &[u8], max_size: u32) -> Result<(String, u32, u32, String), String> {
    let img = image::load_from_memory(image_data).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    let format = "png".to_string();

    let thumbnail = img.thumbnail(max_size, max_size);

    let mut buffer = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    let base64 = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        buffer.into_inner(),
    );

    Ok((base64, w, h, format))
}

#[tauri::command]
pub async fn clipboard_preview_add_image(
    image_base64: String,
    manager: State<'_, ClipboardPreviewManager>,
    app: AppHandle,
) -> Result<ClipboardMediaEntry, String> {
    let image_data = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &image_base64,
    )
    .map_err(|e| e.to_string())?;

    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let thumb_size = state.thumbnail_size;

    let (thumbnail, width, height, format) = generate_thumbnail(&image_data, thumb_size)?;

    let entry = ClipboardMediaEntry {
        id: uuid::Uuid::new_v4().to_string(),
        content_type: "image".to_string(),
        thumbnail_base64: Some(thumbnail),
        width: Some(width),
        height: Some(height),
        size_bytes: image_data.len() as u64,
        format: Some(format),
        text_preview: None,
        timestamp: Utc::now().to_rfc3339(),
        is_pinned: false,
    };

    state.entries.insert(0, entry.clone());
    state.total_captured += 1;

    // Trim to max, keeping pinned entries
    while state.entries.len() > state.max_entries {
        if let Some(pos) = state.entries.iter().rposition(|e| !e.is_pinned) {
            if pos > 0 {
                state.entries.remove(pos);
            } else {
                break;
            }
        } else {
            break;
        }
    }

    let _ = app.emit("clipboard-image-captured", &entry);
    Ok(entry)
}

#[tauri::command]
pub async fn clipboard_preview_add_text(
    text: String,
    manager: State<'_, ClipboardPreviewManager>,
    app: AppHandle,
) -> Result<ClipboardMediaEntry, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    let preview = if text.len() > 200 {
        format!("{}...", &text[..200])
    } else {
        text.clone()
    };

    let entry = ClipboardMediaEntry {
        id: uuid::Uuid::new_v4().to_string(),
        content_type: "text".to_string(),
        thumbnail_base64: None,
        width: None,
        height: None,
        size_bytes: text.len() as u64,
        format: None,
        text_preview: Some(preview),
        timestamp: Utc::now().to_rfc3339(),
        is_pinned: false,
    };

    state.entries.insert(0, entry.clone());
    state.total_captured += 1;

    while state.entries.len() > state.max_entries {
        if let Some(pos) = state.entries.iter().rposition(|e| !e.is_pinned) {
            if pos > 0 {
                state.entries.remove(pos);
            } else {
                break;
            }
        } else {
            break;
        }
    }

    let _ = app.emit("clipboard-text-captured", &entry);
    Ok(entry)
}

#[tauri::command]
pub async fn clipboard_preview_get_state(
    manager: State<'_, ClipboardPreviewManager>,
) -> Result<ClipboardPreviewState, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

#[tauri::command]
pub async fn clipboard_preview_get_entries(
    limit: Option<usize>,
    content_type: Option<String>,
    manager: State<'_, ClipboardPreviewManager>,
) -> Result<Vec<ClipboardMediaEntry>, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    let entries: Vec<ClipboardMediaEntry> = state
        .entries
        .iter()
        .filter(|e| {
            content_type
                .as_ref()
                .map(|ct| e.content_type == *ct)
                .unwrap_or(true)
        })
        .take(limit.unwrap_or(50))
        .cloned()
        .collect();
    Ok(entries)
}

#[tauri::command]
pub async fn clipboard_preview_pin(
    id: String,
    manager: State<'_, ClipboardPreviewManager>,
) -> Result<bool, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let entry = state
        .entries
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or("Entry not found")?;
    entry.is_pinned = !entry.is_pinned;
    Ok(entry.is_pinned)
}

#[tauri::command]
pub async fn clipboard_preview_delete(
    id: String,
    manager: State<'_, ClipboardPreviewManager>,
) -> Result<bool, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let len = state.entries.len();
    state.entries.retain(|e| e.id != id);
    Ok(state.entries.len() < len)
}

#[tauri::command]
pub async fn clipboard_preview_clear(
    keep_pinned: Option<bool>,
    manager: State<'_, ClipboardPreviewManager>,
) -> Result<usize, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let len = state.entries.len();
    if keep_pinned.unwrap_or(true) {
        state.entries.retain(|e| e.is_pinned);
    } else {
        state.entries.clear();
    }
    Ok(len - state.entries.len())
}

#[tauri::command]
pub async fn clipboard_preview_set_max(
    max_entries: usize,
    manager: State<'_, ClipboardPreviewManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.max_entries = max_entries;
    Ok(())
}

#[tauri::command]
pub async fn clipboard_preview_set_thumbnail_size(
    size: u32,
    manager: State<'_, ClipboardPreviewManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.thumbnail_size = size;
    Ok(())
}

#[tauri::command]
pub async fn clipboard_preview_search(
    query: String,
    manager: State<'_, ClipboardPreviewManager>,
) -> Result<Vec<ClipboardMediaEntry>, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    let q = query.to_lowercase();
    let results: Vec<ClipboardMediaEntry> = state
        .entries
        .iter()
        .filter(|e| {
            e.text_preview
                .as_ref()
                .map(|t| t.to_lowercase().contains(&q))
                .unwrap_or(false)
                || e.content_type.contains(&q)
                || e.format
                    .as_ref()
                    .map(|f| f.to_lowercase().contains(&q))
                    .unwrap_or(false)
        })
        .cloned()
        .collect();
    Ok(results)
}

//! Reading List - Save messages and links for later reading
//!
//! Provides:
//! - Save messages from chat to read later
//! - Save URLs with auto-fetched metadata
//! - Mark items as read/unread
//! - Organize with tags and categories
//! - Sort by date, priority, or source

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// Type of reading list item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ReadingItemType {
    Message,
    Link,
    Thread,
    Attachment,
}

impl Default for ReadingItemType {
    fn default() -> Self {
        ReadingItemType::Link
    }
}

/// Priority level for reading items
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ReadingPriority {
    Low,
    Normal,
    High,
}

impl Default for ReadingPriority {
    fn default() -> Self {
        ReadingPriority::Normal
    }
}

/// A reading list item
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingItem {
    pub id: String,
    pub item_type: ReadingItemType,
    pub title: String,
    pub content: Option<String>,
    pub url: Option<String>,
    pub preview_image: Option<String>,
    pub source_server_id: Option<String>,
    pub source_channel_id: Option<String>,
    pub source_message_id: Option<String>,
    pub author_name: Option<String>,
    pub author_avatar: Option<String>,
    pub tags: Vec<String>,
    pub priority: ReadingPriority,
    pub is_read: bool,
    pub is_archived: bool,
    pub added_at: String,
    pub read_at: Option<String>,
    pub estimated_read_time: Option<u32>,
    pub notes: Option<String>,
}

impl ReadingItem {
    fn new(item_type: ReadingItemType, title: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            item_type,
            title,
            content: None,
            url: None,
            preview_image: None,
            source_server_id: None,
            source_channel_id: None,
            source_message_id: None,
            author_name: None,
            author_avatar: None,
            tags: Vec::new(),
            priority: ReadingPriority::Normal,
            is_read: false,
            is_archived: false,
            added_at: Utc::now().to_rfc3339(),
            read_at: None,
            estimated_read_time: None,
            notes: None,
        }
    }
}

/// Reading list stats
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingListStats {
    pub total_items: u32,
    pub unread_items: u32,
    pub read_items: u32,
    pub archived_items: u32,
    pub items_by_type: std::collections::HashMap<String, u32>,
    pub items_this_week: u32,
}

/// Managed state
pub struct ReadingListManager {
    items: Mutex<Vec<ReadingItem>>,
}

impl Default for ReadingListManager {
    fn default() -> Self {
        Self {
            items: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn reading_list_add(
    state: State<'_, ReadingListManager>,
    item_type: ReadingItemType,
    title: String,
    content: Option<String>,
    url: Option<String>,
    source_server_id: Option<String>,
    source_channel_id: Option<String>,
    source_message_id: Option<String>,
    author_name: Option<String>,
    tags: Option<Vec<String>>,
    priority: Option<ReadingPriority>,
    notes: Option<String>,
    app: AppHandle,
) -> Result<ReadingItem, String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    let mut item = ReadingItem::new(item_type, title);
    item.content = content;
    item.url = url;
    item.source_server_id = source_server_id;
    item.source_channel_id = source_channel_id;
    item.source_message_id = source_message_id;
    item.author_name = author_name;
    item.tags = tags.unwrap_or_default();
    item.priority = priority.unwrap_or_default();
    item.notes = notes;

    // Estimate read time based on content length
    if let Some(ref content) = item.content {
        let word_count = content.split_whitespace().count();
        item.estimated_read_time = Some((word_count as u32 / 200).max(1));
    }

    let created = item.clone();
    items.push(item);

    let _ = app.emit("reading-list-updated", serde_json::json!({
        "action": "added",
        "itemId": created.id,
    }));

    Ok(created)
}

#[tauri::command]
pub fn reading_list_remove(
    state: State<'_, ReadingListManager>,
    id: String,
    app: AppHandle,
) -> Result<(), String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    items.retain(|i| i.id != id);
    let _ = app.emit("reading-list-updated", serde_json::json!({
        "action": "removed",
        "itemId": id,
    }));
    Ok(())
}

#[tauri::command]
pub fn reading_list_mark_read(
    state: State<'_, ReadingListManager>,
    id: String,
) -> Result<ReadingItem, String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    let item = items
        .iter_mut()
        .find(|i| i.id == id)
        .ok_or_else(|| "Item not found".to_string())?;
    item.is_read = true;
    item.read_at = Some(Utc::now().to_rfc3339());
    Ok(item.clone())
}

#[tauri::command]
pub fn reading_list_mark_unread(
    state: State<'_, ReadingListManager>,
    id: String,
) -> Result<ReadingItem, String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    let item = items
        .iter_mut()
        .find(|i| i.id == id)
        .ok_or_else(|| "Item not found".to_string())?;
    item.is_read = false;
    item.read_at = None;
    Ok(item.clone())
}

#[tauri::command]
pub fn reading_list_archive(
    state: State<'_, ReadingListManager>,
    id: String,
) -> Result<ReadingItem, String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    let item = items
        .iter_mut()
        .find(|i| i.id == id)
        .ok_or_else(|| "Item not found".to_string())?;
    item.is_archived = !item.is_archived;
    Ok(item.clone())
}

#[tauri::command]
pub fn reading_list_update_tags(
    state: State<'_, ReadingListManager>,
    id: String,
    tags: Vec<String>,
) -> Result<ReadingItem, String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    let item = items
        .iter_mut()
        .find(|i| i.id == id)
        .ok_or_else(|| "Item not found".to_string())?;
    item.tags = tags;
    Ok(item.clone())
}

#[tauri::command]
pub fn reading_list_update_priority(
    state: State<'_, ReadingListManager>,
    id: String,
    priority: ReadingPriority,
) -> Result<ReadingItem, String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    let item = items
        .iter_mut()
        .find(|i| i.id == id)
        .ok_or_else(|| "Item not found".to_string())?;
    item.priority = priority;
    Ok(item.clone())
}

#[tauri::command]
pub fn reading_list_update_notes(
    state: State<'_, ReadingListManager>,
    id: String,
    notes: Option<String>,
) -> Result<ReadingItem, String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    let item = items
        .iter_mut()
        .find(|i| i.id == id)
        .ok_or_else(|| "Item not found".to_string())?;
    item.notes = notes;
    Ok(item.clone())
}

#[tauri::command]
pub fn reading_list_get_all(
    state: State<'_, ReadingListManager>,
    include_archived: Option<bool>,
) -> Result<Vec<ReadingItem>, String> {
    let items = state.items.lock().map_err(|e| e.to_string())?;
    let include_archived = include_archived.unwrap_or(false);
    let result: Vec<ReadingItem> = items
        .iter()
        .filter(|i| include_archived || !i.is_archived)
        .cloned()
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn reading_list_get_unread(
    state: State<'_, ReadingListManager>,
) -> Result<Vec<ReadingItem>, String> {
    let items = state.items.lock().map_err(|e| e.to_string())?;
    let result: Vec<ReadingItem> = items
        .iter()
        .filter(|i| !i.is_read && !i.is_archived)
        .cloned()
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn reading_list_get_stats(
    state: State<'_, ReadingListManager>,
) -> Result<ReadingListStats, String> {
    let items = state.items.lock().map_err(|e| e.to_string())?;

    let total_items = items.len() as u32;
    let unread_items = items.iter().filter(|i| !i.is_read && !i.is_archived).count() as u32;
    let read_items = items.iter().filter(|i| i.is_read).count() as u32;
    let archived_items = items.iter().filter(|i| i.is_archived).count() as u32;

    let mut items_by_type = std::collections::HashMap::new();
    for item in items.iter() {
        let type_key = match item.item_type {
            ReadingItemType::Message => "message",
            ReadingItemType::Link => "link",
            ReadingItemType::Thread => "thread",
            ReadingItemType::Attachment => "attachment",
        };
        *items_by_type.entry(type_key.to_string()).or_insert(0u32) += 1;
    }

    Ok(ReadingListStats {
        total_items,
        unread_items,
        read_items,
        archived_items,
        items_by_type,
        items_this_week: 0,
    })
}

#[tauri::command]
pub fn reading_list_search(
    state: State<'_, ReadingListManager>,
    query: String,
) -> Result<Vec<ReadingItem>, String> {
    let items = state.items.lock().map_err(|e| e.to_string())?;
    let query_lower = query.to_lowercase();
    let results: Vec<ReadingItem> = items
        .iter()
        .filter(|i| {
            i.title.to_lowercase().contains(&query_lower)
                || i.content
                    .as_deref()
                    .map(|c| c.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
                || i.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
                || i.notes
                    .as_deref()
                    .map(|n| n.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
        })
        .cloned()
        .collect();
    Ok(results)
}

#[tauri::command]
pub fn reading_list_clear_read(
    state: State<'_, ReadingListManager>,
) -> Result<u32, String> {
    let mut items = state.items.lock().map_err(|e| e.to_string())?;
    let before = items.len();
    items.retain(|i| !i.is_read);
    Ok((before - items.len()) as u32)
}

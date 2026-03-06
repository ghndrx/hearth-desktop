//! Snippet Manager - Reusable text snippets for quick paste
//!
//! Provides:
//! - Save and organize text/code snippets
//! - Category-based organization
//! - Quick search and copy
//! - Usage tracking for most-used snippets

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// A single snippet entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub language: Option<String>,
    pub tags: Vec<String>,
    pub use_count: u32,
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl Snippet {
    fn new(title: String, content: String, category: String) -> Self {
        let now = Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            content,
            category,
            language: None,
            tags: Vec::new(),
            use_count: 0,
            is_favorite: false,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

/// Snippet manager state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetManagerState {
    pub snippets: Vec<Snippet>,
    pub categories: Vec<String>,
    pub active_category: Option<String>,
    pub is_visible: bool,
}

impl Default for SnippetManagerState {
    fn default() -> Self {
        Self {
            snippets: Vec::new(),
            categories: vec![
                "General".to_string(),
                "Code".to_string(),
                "Responses".to_string(),
                "Templates".to_string(),
            ],
            active_category: None,
            is_visible: false,
        }
    }
}

/// Managed state wrapper
pub struct SnippetsManager {
    state: Mutex<SnippetManagerState>,
}

impl Default for SnippetsManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(SnippetManagerState::default()),
        }
    }
}

#[tauri::command]
pub fn snippets_get_state(
    state: State<'_, SnippetsManager>,
) -> Result<SnippetManagerState, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    Ok(s.clone())
}

#[tauri::command]
pub fn snippets_create(
    state: State<'_, SnippetsManager>,
    title: String,
    content: String,
    category: Option<String>,
    language: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<Snippet, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let cat = category.unwrap_or_else(|| "General".to_string());
    let mut snippet = Snippet::new(title, content, cat.clone());
    snippet.language = language;
    snippet.tags = tags.unwrap_or_default();

    // Auto-add category if new
    if !s.categories.contains(&cat) {
        s.categories.push(cat);
    }

    let created = snippet.clone();
    s.snippets.push(snippet);
    Ok(created)
}

#[tauri::command]
pub fn snippets_update(
    state: State<'_, SnippetsManager>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    category: Option<String>,
    language: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<Snippet, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let idx = s
        .snippets
        .iter()
        .position(|sn| sn.id == id)
        .ok_or_else(|| "Snippet not found".to_string())?;

    if let Some(title) = title {
        s.snippets[idx].title = title;
    }
    if let Some(content) = content {
        s.snippets[idx].content = content;
    }
    if let Some(category) = category {
        if !s.categories.contains(&category) {
            s.categories.push(category.clone());
        }
        s.snippets[idx].category = category;
    }
    if let Some(language) = language {
        s.snippets[idx].language = Some(language);
    }
    if let Some(tags) = tags {
        s.snippets[idx].tags = tags;
    }
    s.snippets[idx].updated_at = Utc::now().to_rfc3339();
    Ok(s.snippets[idx].clone())
}

#[tauri::command]
pub fn snippets_delete(
    state: State<'_, SnippetsManager>,
    id: String,
) -> Result<(), String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.snippets.retain(|sn| sn.id != id);
    Ok(())
}

#[tauri::command]
pub fn snippets_toggle_favorite(
    state: State<'_, SnippetsManager>,
    id: String,
) -> Result<Snippet, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let snippet = s
        .snippets
        .iter_mut()
        .find(|sn| sn.id == id)
        .ok_or_else(|| "Snippet not found".to_string())?;
    snippet.is_favorite = !snippet.is_favorite;
    snippet.updated_at = Utc::now().to_rfc3339();
    Ok(snippet.clone())
}

#[tauri::command]
pub fn snippets_record_use(
    state: State<'_, SnippetsManager>,
    id: String,
    app: AppHandle,
) -> Result<Snippet, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let snippet = s
        .snippets
        .iter_mut()
        .find(|sn| sn.id == id)
        .ok_or_else(|| "Snippet not found".to_string())?;
    snippet.use_count += 1;
    let result = snippet.clone();
    let _ = app.emit("snippet-used", serde_json::json!({
        "id": result.id,
        "content": result.content
    }));
    Ok(result)
}

#[tauri::command]
pub fn snippets_search(
    state: State<'_, SnippetsManager>,
    query: String,
) -> Result<Vec<Snippet>, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    let query_lower = query.to_lowercase();
    let results: Vec<Snippet> = s
        .snippets
        .iter()
        .filter(|sn| {
            sn.title.to_lowercase().contains(&query_lower)
                || sn.content.to_lowercase().contains(&query_lower)
                || sn.category.to_lowercase().contains(&query_lower)
                || sn.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
        })
        .cloned()
        .collect();
    Ok(results)
}

#[tauri::command]
pub fn snippets_get_by_category(
    state: State<'_, SnippetsManager>,
    category: String,
) -> Result<Vec<Snippet>, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    let results: Vec<Snippet> = s
        .snippets
        .iter()
        .filter(|sn| sn.category == category)
        .cloned()
        .collect();
    Ok(results)
}

#[tauri::command]
pub fn snippets_get_favorites(
    state: State<'_, SnippetsManager>,
) -> Result<Vec<Snippet>, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    let results: Vec<Snippet> = s
        .snippets
        .iter()
        .filter(|sn| sn.is_favorite)
        .cloned()
        .collect();
    Ok(results)
}

#[tauri::command]
pub fn snippets_toggle_visible(
    state: State<'_, SnippetsManager>,
    app: AppHandle,
) -> Result<bool, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.is_visible = !s.is_visible;
    let _ = app.emit("snippets-visibility-changed", s.is_visible);
    Ok(s.is_visible)
}

#[tauri::command]
pub fn snippets_add_category(
    state: State<'_, SnippetsManager>,
    category: String,
) -> Result<Vec<String>, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    if !s.categories.contains(&category) {
        s.categories.push(category);
    }
    Ok(s.categories.clone())
}

#[tauri::command]
pub fn snippets_remove_category(
    state: State<'_, SnippetsManager>,
    category: String,
) -> Result<Vec<String>, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    // Move snippets in this category to "General"
    for snippet in s.snippets.iter_mut() {
        if snippet.category == category {
            snippet.category = "General".to_string();
        }
    }
    s.categories.retain(|c| c != &category);
    Ok(s.categories.clone())
}

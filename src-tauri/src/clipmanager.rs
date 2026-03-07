use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipEntry {
    pub id: String,
    pub content: String,
    pub content_type: String, // "text", "image", "url", "code"
    pub preview: String,
    pub byte_size: usize,
    pub pinned: bool,
    pub created_at: i64,
    pub source_app: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipManagerState {
    pub entries: Vec<ClipEntry>,
    pub max_entries: usize,
    pub total_clips: u64,
}

pub struct ClipManagerStore {
    state: Mutex<ClipManagerState>,
}

impl Default for ClipManagerStore {
    fn default() -> Self {
        Self {
            state: Mutex::new(ClipManagerState {
                entries: Vec::new(),
                max_entries: 200,
                total_clips: 0,
            }),
        }
    }
}

fn detect_content_type(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        "url".into()
    } else if trimmed.contains("fn ") || trimmed.contains("function ")
        || trimmed.contains("const ") || trimmed.contains("import ")
        || trimmed.contains("class ") || trimmed.contains("def ")
        || trimmed.contains("pub struct") || trimmed.contains("#include")
    {
        "code".into()
    } else {
        "text".into()
    }
}

fn make_preview(text: &str, max_len: usize) -> String {
    let clean: String = text.chars().take(max_len).collect();
    if text.len() > max_len {
        format!("{}...", clean)
    } else {
        clean
    }
}

fn with_state<F, R>(store: &ClipManagerStore, f: F) -> Result<R, String>
where
    F: FnOnce(&mut ClipManagerState) -> R,
{
    let mut state = store.state.lock().map_err(|e| e.to_string())?;
    Ok(f(&mut state))
}

#[tauri::command]
pub fn clipmgr_get_state(
    store: tauri::State<'_, ClipManagerStore>,
) -> Result<ClipManagerState, String> {
    with_state(&store, |s| s.clone())
}

#[tauri::command]
pub fn clipmgr_add(
    store: tauri::State<'_, ClipManagerStore>,
    content: String,
    source_app: Option<String>,
) -> Result<ClipManagerState, String> {
    with_state(&store, |s| {
        // Deduplicate: skip if the latest entry has the same content
        if let Some(latest) = s.entries.first() {
            if latest.content == content {
                return s.clone();
            }
        }
        let content_type = detect_content_type(&content);
        let preview = make_preview(&content, 120);
        let byte_size = content.len();
        let id = format!(
            "clip-{}",
            uuid::Uuid::new_v4()
                .to_string()
                .split('-')
                .next()
                .unwrap_or("0")
        );
        let entry = ClipEntry {
            id,
            content,
            content_type,
            preview,
            byte_size,
            pinned: false,
            created_at: chrono::Utc::now().timestamp_millis(),
            source_app: source_app.unwrap_or_else(|| "unknown".into()),
        };
        s.entries.insert(0, entry);
        s.total_clips += 1;
        // Trim to max (keep pinned)
        while s.entries.len() > s.max_entries {
            if let Some(pos) = s.entries.iter().rposition(|e| !e.pinned) {
                s.entries.remove(pos);
            } else {
                break;
            }
        }
        s.clone()
    })
}

#[tauri::command]
pub fn clipmgr_pin(
    store: tauri::State<'_, ClipManagerStore>,
    id: String,
    pinned: bool,
) -> Result<ClipManagerState, String> {
    with_state(&store, |s| {
        if let Some(entry) = s.entries.iter_mut().find(|e| e.id == id) {
            entry.pinned = pinned;
        }
        s.clone()
    })
}

#[tauri::command]
pub fn clipmgr_delete(
    store: tauri::State<'_, ClipManagerStore>,
    id: String,
) -> Result<ClipManagerState, String> {
    with_state(&store, |s| {
        s.entries.retain(|e| e.id != id);
        s.clone()
    })
}

#[tauri::command]
pub fn clipmgr_clear(
    store: tauri::State<'_, ClipManagerStore>,
    keep_pinned: bool,
) -> Result<ClipManagerState, String> {
    with_state(&store, |s| {
        if keep_pinned {
            s.entries.retain(|e| e.pinned);
        } else {
            s.entries.clear();
        }
        s.clone()
    })
}

#[tauri::command]
pub fn clipmgr_search(
    store: tauri::State<'_, ClipManagerStore>,
    query: String,
) -> Result<Vec<ClipEntry>, String> {
    with_state(&store, |s| {
        let q = query.to_lowercase();
        s.entries
            .iter()
            .filter(|e| e.content.to_lowercase().contains(&q) || e.content_type.contains(&q))
            .cloned()
            .collect()
    })
}

#[tauri::command]
pub fn clipmgr_copy_entry(
    store: tauri::State<'_, ClipManagerStore>,
    id: String,
) -> Result<String, String> {
    with_state(&store, |s| {
        s.entries
            .iter()
            .find(|e| e.id == id)
            .map(|e| e.content.clone())
            .unwrap_or_default()
    })
}

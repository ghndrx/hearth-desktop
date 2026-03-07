use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// A text expansion shortcut
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextExpansion {
    pub id: String,
    pub trigger: String,      // e.g. "/sig", "@@email", "brb"
    pub expansion: String,    // the expanded text
    pub category: String,     // e.g. "personal", "work", "emoji"
    pub case_sensitive: bool,
    pub use_count: u32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextExpanderState {
    pub enabled: bool,
    pub trigger_on_space: bool,  // expand when space is pressed after trigger
    pub trigger_on_tab: bool,    // expand when tab is pressed after trigger
    pub expansions: Vec<TextExpansion>,
}

impl Default for TextExpanderState {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        Self {
            enabled: true,
            trigger_on_space: true,
            trigger_on_tab: true,
            expansions: vec![
                TextExpansion {
                    id: "builtin-shrug".into(),
                    trigger: "/shrug".into(),
                    expansion: r"¯\_(ツ)_/¯".into(),
                    category: "emoji".into(),
                    case_sensitive: false,
                    use_count: 0,
                    created_at: now,
                    updated_at: now,
                },
                TextExpansion {
                    id: "builtin-tableflip".into(),
                    trigger: "/tableflip".into(),
                    expansion: "(╯°□°)╯︵ ┻━┻".into(),
                    category: "emoji".into(),
                    case_sensitive: false,
                    use_count: 0,
                    created_at: now,
                    updated_at: now,
                },
                TextExpansion {
                    id: "builtin-unflip".into(),
                    trigger: "/unflip".into(),
                    expansion: "┬─┬ノ( º _ ºノ)".into(),
                    category: "emoji".into(),
                    case_sensitive: false,
                    use_count: 0,
                    created_at: now,
                    updated_at: now,
                },
                TextExpansion {
                    id: "builtin-lenny".into(),
                    trigger: "/lenny".into(),
                    expansion: "( ͡° ͜ʖ ͡°)".into(),
                    category: "emoji".into(),
                    case_sensitive: false,
                    use_count: 0,
                    created_at: now,
                    updated_at: now,
                },
                TextExpansion {
                    id: "builtin-disapproval".into(),
                    trigger: "/disapproval".into(),
                    expansion: "ಠ_ಠ".into(),
                    category: "emoji".into(),
                    case_sensitive: false,
                    use_count: 0,
                    created_at: now,
                    updated_at: now,
                },
            ],
        }
    }
}

pub struct TextExpanderManager {
    state: Mutex<TextExpanderState>,
}

impl Default for TextExpanderManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(TextExpanderState::default()),
        }
    }
}

fn with_state<F, R>(manager: &TextExpanderManager, f: F) -> Result<R, String>
where
    F: FnOnce(&mut TextExpanderState) -> R,
{
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(f(&mut state))
}

/// Get the full text expander state
#[tauri::command]
pub fn expander_get_state(
    manager: tauri::State<'_, TextExpanderManager>,
) -> Result<TextExpanderState, String> {
    with_state(&manager, |s| s.clone())
}

/// Try to expand a trigger string, returns the expansion if found
#[tauri::command]
pub fn expander_try_expand(
    manager: tauri::State<'_, TextExpanderManager>,
    trigger: String,
) -> Result<Option<String>, String> {
    with_state(&manager, |s| {
        if !s.enabled {
            return None;
        }
        let found = s.expansions.iter_mut().find(|e| {
            if e.case_sensitive {
                e.trigger == trigger
            } else {
                e.trigger.eq_ignore_ascii_case(&trigger)
            }
        });
        if let Some(expansion) = found {
            expansion.use_count += 1;
            expansion.updated_at = chrono::Utc::now().timestamp_millis();
            Some(expansion.expansion.clone())
        } else {
            None
        }
    })
}

/// Create a new text expansion
#[tauri::command]
pub fn expander_create(
    manager: tauri::State<'_, TextExpanderManager>,
    trigger: String,
    expansion: String,
    category: Option<String>,
    case_sensitive: Option<bool>,
) -> Result<TextExpanderState, String> {
    with_state(&manager, |s| {
        // Check for duplicate trigger
        let trigger_lower = trigger.to_lowercase();
        if s.expansions.iter().any(|e| e.trigger.to_lowercase() == trigger_lower) {
            return s.clone(); // silently ignore duplicate
        }
        let now = chrono::Utc::now().timestamp_millis();
        let id = format!("exp-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));
        s.expansions.push(TextExpansion {
            id,
            trigger,
            expansion,
            category: category.unwrap_or_else(|| "custom".into()),
            case_sensitive: case_sensitive.unwrap_or(false),
            use_count: 0,
            created_at: now,
            updated_at: now,
        });
        s.clone()
    })
}

/// Update an existing text expansion
#[tauri::command]
pub fn expander_update(
    manager: tauri::State<'_, TextExpanderManager>,
    id: String,
    trigger: Option<String>,
    expansion: Option<String>,
    category: Option<String>,
    case_sensitive: Option<bool>,
) -> Result<TextExpanderState, String> {
    with_state(&manager, |s| {
        if let Some(entry) = s.expansions.iter_mut().find(|e| e.id == id) {
            if let Some(t) = trigger {
                entry.trigger = t;
            }
            if let Some(e) = expansion {
                entry.expansion = e;
            }
            if let Some(c) = category {
                entry.category = c;
            }
            if let Some(cs) = case_sensitive {
                entry.case_sensitive = cs;
            }
            entry.updated_at = chrono::Utc::now().timestamp_millis();
        }
        s.clone()
    })
}

/// Delete a text expansion
#[tauri::command]
pub fn expander_delete(
    manager: tauri::State<'_, TextExpanderManager>,
    id: String,
) -> Result<TextExpanderState, String> {
    with_state(&manager, |s| {
        s.expansions.retain(|e| e.id != id);
        s.clone()
    })
}

/// Toggle the text expander on/off
#[tauri::command]
pub fn expander_set_enabled(
    manager: tauri::State<'_, TextExpanderManager>,
    enabled: bool,
) -> Result<TextExpanderState, String> {
    with_state(&manager, |s| {
        s.enabled = enabled;
        s.clone()
    })
}

/// Get all expansion triggers (for frontend matching)
#[tauri::command]
pub fn expander_get_triggers(
    manager: tauri::State<'_, TextExpanderManager>,
) -> Result<Vec<String>, String> {
    with_state(&manager, |s| {
        s.expansions.iter().map(|e| e.trigger.clone()).collect()
    })
}

/// Get expansions sorted by most used
#[tauri::command]
pub fn expander_get_frequent(
    manager: tauri::State<'_, TextExpanderManager>,
    limit: Option<usize>,
) -> Result<Vec<TextExpansion>, String> {
    with_state(&manager, |s| {
        let mut sorted = s.expansions.clone();
        sorted.sort_by(|a, b| b.use_count.cmp(&a.use_count));
        sorted.truncate(limit.unwrap_or(10));
        sorted
    })
}

/// Search expansions by trigger or expansion text
#[tauri::command]
pub fn expander_search(
    manager: tauri::State<'_, TextExpanderManager>,
    query: String,
) -> Result<Vec<TextExpansion>, String> {
    with_state(&manager, |s| {
        let q = query.to_lowercase();
        s.expansions
            .iter()
            .filter(|e| {
                e.trigger.to_lowercase().contains(&q)
                    || e.expansion.to_lowercase().contains(&q)
                    || e.category.to_lowercase().contains(&q)
            })
            .cloned()
            .collect()
    })
}

/// Get categories
#[tauri::command]
pub fn expander_get_categories(
    manager: tauri::State<'_, TextExpanderManager>,
) -> Result<Vec<String>, String> {
    with_state(&manager, |s| {
        let mut cats: Vec<String> = s
            .expansions
            .iter()
            .map(|e| e.category.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        cats.sort();
        cats
    })
}

/// Import expansions from JSON
#[tauri::command]
pub fn expander_import(
    manager: tauri::State<'_, TextExpanderManager>,
    data: Vec<TextExpansion>,
) -> Result<TextExpanderState, String> {
    with_state(&manager, |s| {
        for item in data {
            if !s.expansions.iter().any(|e| e.trigger == item.trigger) {
                s.expansions.push(item);
            }
        }
        s.clone()
    })
}

/// Export all expansions
#[tauri::command]
pub fn expander_export(
    manager: tauri::State<'_, TextExpanderManager>,
) -> Result<Vec<TextExpansion>, String> {
    with_state(&manager, |s| s.expansions.clone())
}

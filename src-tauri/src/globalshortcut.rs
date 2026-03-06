use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use tauri::AppHandle;

/// Registered shortcut metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredShortcut {
    /// Unique identifier for this shortcut
    pub id: String,
    /// The accelerator string (e.g., "CommandOrControl+Shift+M")
    pub accelerator: String,
    /// Human-readable label
    pub label: String,
    /// Whether the shortcut is currently active
    pub active: bool,
}

/// State tracking all registered global shortcuts (app-level only, no OS registration)
struct ShortcutState {
    shortcuts: HashMap<String, RegisteredShortcut>,
}

static SHORTCUT_STATE: RwLock<Option<ShortcutState>> = RwLock::new(None);

fn ensure_state() {
    let mut state = SHORTCUT_STATE.write().unwrap();
    if state.is_none() {
        *state = Some(ShortcutState {
            shortcuts: HashMap::new(),
        });
    }
}

/// Convert frontend key names to Tauri accelerator format.
fn keys_to_accelerator(keys: &[String]) -> String {
    keys.iter()
        .map(|k| match k.as_str() {
            "Ctrl" => "CommandOrControl",
            "Cmd" => "Command",
            "Alt" => "Alt",
            "Shift" => "Shift",
            "Space" => "Space",
            "Tab" => "Tab",
            "Backspace" => "Backspace",
            "Delete" => "Delete",
            "Enter" => "Return",
            "Escape" => "Escape",
            "↑" | "ArrowUp" => "Up",
            "↓" | "ArrowDown" => "Down",
            "←" | "ArrowLeft" => "Left",
            "→" | "ArrowRight" => "Right",
            "`" => "`",
            other => other,
        })
        .collect::<Vec<_>>()
        .join("+")
}

/// Register a global shortcut (stored in app state; OS-level registration
/// requires tauri-plugin-global-shortcut which is not currently available).
#[tauri::command]
pub fn register_global_shortcut(
    _app: AppHandle,
    id: String,
    keys: Vec<String>,
    label: String,
) -> Result<RegisteredShortcut, String> {
    ensure_state();

    let accelerator = keys_to_accelerator(&keys);

    let entry = RegisteredShortcut {
        id: id.clone(),
        accelerator,
        label,
        active: true,
    };

    let mut state = SHORTCUT_STATE.write().map_err(|e| e.to_string())?;
    if let Some(ref mut s) = *state {
        s.shortcuts.insert(id, entry.clone());
    }

    Ok(entry)
}

/// Unregister a global shortcut by its ID.
#[tauri::command]
pub fn unregister_global_shortcut(_app: AppHandle, id: String) -> Result<(), String> {
    ensure_state();

    let mut state = SHORTCUT_STATE.write().map_err(|e| e.to_string())?;
    if let Some(ref mut s) = *state {
        s.shortcuts.remove(&id);
    }

    Ok(())
}

/// Unregister all managed global shortcuts.
#[tauri::command]
pub fn unregister_all_global_shortcuts(_app: AppHandle) -> Result<(), String> {
    ensure_state();

    let mut state = SHORTCUT_STATE.write().map_err(|e| e.to_string())?;
    if let Some(ref mut s) = *state {
        s.shortcuts.clear();
    }

    Ok(())
}

/// List all currently registered global shortcuts.
#[tauri::command]
pub fn list_global_shortcuts() -> Result<Vec<RegisteredShortcut>, String> {
    ensure_state();

    let state = SHORTCUT_STATE.read().map_err(|e| e.to_string())?;
    let shortcuts = state
        .as_ref()
        .map(|s| s.shortcuts.values().cloned().collect::<Vec<_>>())
        .unwrap_or_default();

    Ok(shortcuts)
}

/// Check if a specific accelerator is already registered (in app state).
#[tauri::command]
pub fn is_global_shortcut_registered(_app: AppHandle, keys: Vec<String>) -> Result<bool, String> {
    ensure_state();
    let accelerator = keys_to_accelerator(&keys);
    let state = SHORTCUT_STATE.read().map_err(|e| e.to_string())?;
    Ok(state
        .as_ref()
        .map(|s| s.shortcuts.values().any(|e| e.accelerator == accelerator))
        .unwrap_or(false))
}

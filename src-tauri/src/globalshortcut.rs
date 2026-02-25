use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use tauri::{AppHandle, GlobalShortcutBuilder, Manager};

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

/// State tracking all registered global shortcuts
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
/// Frontend uses keys like ["Ctrl", "Shift", "M"] and we need "CommandOrControl+Shift+M".
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

/// Register a global shortcut that emits an event to the frontend when triggered.
#[tauri::command]
pub fn register_global_shortcut(
    app: AppHandle,
    id: String,
    keys: Vec<String>,
    label: String,
) -> Result<RegisteredShortcut, String> {
    ensure_state();

    let accelerator = keys_to_accelerator(&keys);

    // Check if already registered with the same accelerator
    let manager = app.global_shortcut();
    if manager.is_registered(&accelerator) {
        // Unregister first to allow re-binding
        manager
            .unregister(&accelerator)
            .map_err(|e| format!("Failed to unregister existing shortcut: {}", e))?;
    }

    let shortcut_id = id.clone();
    let app_handle = app.clone();

    manager
        .on_shortcut(&accelerator, move |_app, _shortcut, _event| {
            // Emit event to the frontend so the UI can react
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.emit(
                    "global-shortcut-triggered",
                    serde_json::json!({ "id": shortcut_id }),
                );
            }
        })
        .map_err(|e| format!("Failed to register shortcut '{}': {}", accelerator, e))?;

    let entry = RegisteredShortcut {
        id: id.clone(),
        accelerator: accelerator.clone(),
        label,
        active: true,
    };

    // Store in state
    let mut state = SHORTCUT_STATE.write().map_err(|e| e.to_string())?;
    if let Some(ref mut s) = *state {
        s.shortcuts.insert(id, entry.clone());
    }

    Ok(entry)
}

/// Unregister a global shortcut by its ID.
#[tauri::command]
pub fn unregister_global_shortcut(app: AppHandle, id: String) -> Result<(), String> {
    ensure_state();

    let accelerator = {
        let state = SHORTCUT_STATE.read().map_err(|e| e.to_string())?;
        state
            .as_ref()
            .and_then(|s| s.shortcuts.get(&id))
            .map(|entry| entry.accelerator.clone())
    };

    if let Some(accel) = accelerator {
        let manager = app.global_shortcut();
        if manager.is_registered(&accel) {
            manager
                .unregister(&accel)
                .map_err(|e| format!("Failed to unregister shortcut: {}", e))?;
        }

        let mut state = SHORTCUT_STATE.write().map_err(|e| e.to_string())?;
        if let Some(ref mut s) = *state {
            s.shortcuts.remove(&id);
        }
    }

    Ok(())
}

/// Unregister all managed global shortcuts.
#[tauri::command]
pub fn unregister_all_global_shortcuts(app: AppHandle) -> Result<(), String> {
    ensure_state();

    let accelerators: Vec<String> = {
        let state = SHORTCUT_STATE.read().map_err(|e| e.to_string())?;
        state
            .as_ref()
            .map(|s| s.shortcuts.values().map(|e| e.accelerator.clone()).collect())
            .unwrap_or_default()
    };

    let manager = app.global_shortcut();
    for accel in &accelerators {
        if manager.is_registered(accel) {
            let _ = manager.unregister(accel);
        }
    }

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

/// Check if a specific accelerator is already registered.
#[tauri::command]
pub fn is_global_shortcut_registered(app: AppHandle, keys: Vec<String>) -> Result<bool, String> {
    let accelerator = keys_to_accelerator(&keys);
    let manager = app.global_shortcut();
    Ok(manager.is_registered(&accelerator))
}

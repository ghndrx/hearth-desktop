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
pub fn keys_to_accelerator(keys: &[String]) -> String {
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

/// Register a global shortcut in app state and with the OS via the global-shortcut plugin.
#[tauri::command]
pub fn register_global_shortcut(
    app: AppHandle,
    id: String,
    keys: Vec<String>,
    label: String,
) -> Result<RegisteredShortcut, String> {
    ensure_state();

    let accelerator = keys_to_accelerator(&keys);

    // Register with the OS-level global shortcut plugin
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    use tauri::{Emitter, Manager};
    let shortcut: tauri_plugin_global_shortcut::Shortcut = accelerator
        .parse()
        .map_err(|e| format!("Invalid shortcut '{}': {}", accelerator, e))?;

    let shortcut_id = id.clone();
    let app_clone = app.clone();
    let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, _event| {
        if let Some(window) = app_clone.get_webview_window("main") {
            let _ = window.emit("global-shortcut:triggered", &shortcut_id);
        }
    });

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
pub fn unregister_global_shortcut(app: AppHandle, id: String) -> Result<(), String> {
    ensure_state();

    // Find the accelerator for this ID and unregister from OS
    let accelerator = {
        let state = SHORTCUT_STATE.read().map_err(|e| e.to_string())?;
        state.as_ref().and_then(|s| s.shortcuts.get(&id).map(|e| e.accelerator.clone()))
    };

    if let Some(accel) = accelerator {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        if let Ok(shortcut) = accel.parse::<tauri_plugin_global_shortcut::Shortcut>() {
            let _ = app.global_shortcut().unregister(shortcut);
        }
    }

    let mut state = SHORTCUT_STATE.write().map_err(|e| e.to_string())?;
    if let Some(ref mut s) = *state {
        s.shortcuts.remove(&id);
    }

    Ok(())
}

/// Unregister all managed global shortcuts.
#[tauri::command]
pub fn unregister_all_global_shortcuts(app: AppHandle) -> Result<(), String> {
    ensure_state();

    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let _ = app.global_shortcut().unregister_all();

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
    ensure_state();
    let accelerator = keys_to_accelerator(&keys);

    // Check OS-level registration
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    if let Ok(shortcut) = accelerator.parse::<tauri_plugin_global_shortcut::Shortcut>() {
        return Ok(app.global_shortcut().is_registered(shortcut));
    }

    // Fallback to app-state check
    let state = SHORTCUT_STATE.read().map_err(|e| e.to_string())?;
    Ok(state
        .as_ref()
        .map(|s| s.shortcuts.values().any(|e| e.accelerator == accelerator))
        .unwrap_or(false))
}

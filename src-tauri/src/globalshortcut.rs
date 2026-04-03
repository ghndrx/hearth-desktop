use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegisteredShortcut {
    pub id: String,
    pub accelerator: String,
    pub label: String,
    pub active: bool,
}

#[derive(Default)]
pub struct ShortcutRegistry {
    shortcuts: Mutex<Vec<RegisteredShortcut>>,
}

/// Convert frontend key names to Tauri accelerator format.
/// e.g., ["Ctrl", "Shift", "M"] -> "CommandOrControl+Shift+M"
fn keys_to_accelerator(keys: &[String]) -> String {
    keys.iter()
        .map(|key| match key.to_lowercase().as_str() {
            "ctrl" | "control" => "CommandOrControl",
            "cmd" | "command" | "meta" => "CommandOrControl",
            "alt" | "option" => "Alt",
            "shift" => "Shift",
            "super" | "win" | "windows" => "Super",
            "`" | "backquote" => "`",
            _ => key.as_str(),
        })
        .collect::<Vec<&str>>()
        .join("+")
}

#[tauri::command]
pub fn register_global_shortcut(
    app: AppHandle,
    registry: State<'_, ShortcutRegistry>,
    id: String,
    keys: Vec<String>,
    label: String,
) -> Result<RegisteredShortcut, String> {
    let accelerator = keys_to_accelerator(&keys);
    let shortcut: Shortcut = accelerator.parse().map_err(|e| {
        format!("Invalid shortcut '{}': {}", accelerator, e)
    })?;

    let shortcut_id = id.clone();
    let app_handle = app.clone();

    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        match event.state {
            ShortcutState::Pressed => {
                // For PTT shortcuts, emit start on press
                if shortcut_id.contains("push-to-talk") {
                    let _ = app_handle.emit("ptt:start", &shortcut_id);
                }
                let _ = app_handle.emit("global-shortcut:triggered", &shortcut_id);
            }
            ShortcutState::Released => {
                // For PTT shortcuts, emit stop on release
                if shortcut_id.contains("push-to-talk") {
                    let _ = app_handle.emit("ptt:stop", &shortcut_id);
                }
            }
        }
    }).map_err(|e| format!("Failed to register shortcut: {}", e))?;

    let registered = RegisteredShortcut {
        id: id.clone(),
        accelerator: accelerator.clone(),
        label,
        active: true,
    };

    let mut shortcuts = registry.shortcuts.lock().map_err(|e| e.to_string())?;
    // Remove existing shortcut with same id if any
    shortcuts.retain(|s| s.id != id);
    shortcuts.push(registered.clone());

    Ok(registered)
}

#[tauri::command]
pub fn unregister_global_shortcut(
    app: AppHandle,
    registry: State<'_, ShortcutRegistry>,
    id: String,
) -> Result<(), String> {
    let mut shortcuts = registry.shortcuts.lock().map_err(|e| e.to_string())?;

    if let Some(shortcut) = shortcuts.iter().find(|s| s.id == id) {
        let parsed: Shortcut = shortcut.accelerator.parse().map_err(|e| {
            format!("Invalid shortcut: {}", e)
        })?;
        app.global_shortcut()
            .unregister(parsed)
            .map_err(|e| format!("Failed to unregister shortcut: {}", e))?;
    }

    shortcuts.retain(|s| s.id != id);
    Ok(())
}

#[tauri::command]
pub fn list_global_shortcuts(
    registry: State<'_, ShortcutRegistry>,
) -> Result<Vec<RegisteredShortcut>, String> {
    let shortcuts = registry.shortcuts.lock().map_err(|e| e.to_string())?;
    Ok(shortcuts.clone())
}

#[tauri::command]
pub fn is_shortcut_registered(
    app: AppHandle,
    keys: Vec<String>,
) -> Result<bool, String> {
    let accelerator = keys_to_accelerator(&keys);
    let shortcut: Shortcut = accelerator.parse().map_err(|e| {
        format!("Invalid shortcut '{}': {}", accelerator, e)
    })?;
    Ok(app.global_shortcut().is_registered(shortcut))
}

#[tauri::command]
pub fn check_shortcut_conflict(
    registry: State<'_, ShortcutRegistry>,
    keys: Vec<String>,
) -> Result<bool, String> {
    let accelerator = keys_to_accelerator(&keys);
    let shortcuts = registry.shortcuts.lock().map_err(|e| e.to_string())?;
    Ok(shortcuts.iter().any(|s| s.accelerator == accelerator))
}

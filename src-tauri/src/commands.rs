use tauri_plugin_notification::NotificationExt;
use tauri::State;
use std::collections::HashMap;
use crate::hotkey::{HotkeyManager, HotkeyConfig};

/// Get the application version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Set the dock/taskbar badge count (unread messages)
#[tauri::command]
pub async fn set_badge_count(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            if count > 0 {
                window.set_badge_count(Some(count as i64)).map_err(|e| e.to_string())?;
            } else {
                window.set_badge_count(None).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Register a new hotkey
#[tauri::command]
pub async fn register_hotkey(
    manager: State<'_, HotkeyManager>,
    config: HotkeyConfig,
) -> Result<(), String> {
    manager.register_hotkey(config)
}

/// Unregister a hotkey by ID
#[tauri::command]
pub async fn unregister_hotkey(
    manager: State<'_, HotkeyManager>,
    id: String,
) -> Result<(), String> {
    manager.unregister_hotkey(&id)
}

/// Update an existing hotkey configuration
#[tauri::command]
pub async fn update_hotkey(
    manager: State<'_, HotkeyManager>,
    config: HotkeyConfig,
) -> Result<(), String> {
    manager.update_hotkey(config)
}

/// Get all registered hotkeys
#[tauri::command]
pub async fn get_hotkeys(
    manager: State<'_, HotkeyManager>,
) -> Result<HashMap<String, HotkeyConfig>, String> {
    Ok(manager.get_registered_hotkeys())
}

/// Register multiple hotkeys at once
#[tauri::command]
pub async fn register_hotkeys(
    manager: State<'_, HotkeyManager>,
    configs: Vec<HotkeyConfig>,
) -> Result<Vec<String>, String> {
    let mut errors = Vec::new();

    for config in configs {
        if let Err(e) = manager.register_hotkey(config.clone()) {
            errors.push(format!("Failed to register hotkey '{}': {}", config.id, e));
        }
    }

    if errors.is_empty() {
        Ok(vec![])
    } else {
        Err(format!("Some hotkeys failed to register: {}", errors.join(", ")))
    }
}

/// Unregister all hotkeys
#[tauri::command]
pub async fn unregister_all_hotkeys(
    manager: State<'_, HotkeyManager>,
) -> Result<(), String> {
    let hotkeys = manager.get_registered_hotkeys();
    for id in hotkeys.keys() {
        manager.unregister_hotkey(id)?;
    }
    Ok(())
}

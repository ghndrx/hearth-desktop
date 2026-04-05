use tauri_plugin_notification::NotificationExt;
use crate::shortcuts::{ShortcutConfig};
use tauri::State;
use std::sync::Mutex;

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

/// Get current shortcut configuration
#[tauri::command]
pub fn get_shortcut_config(
    config: State<Mutex<ShortcutConfig>>,
) -> Result<ShortcutConfig, String> {
    config
        .lock()
        .map(|c| c.clone())
        .map_err(|e| e.to_string())
}

/// Update shortcut configuration
#[tauri::command]
pub fn update_shortcut_config(
    app: tauri::AppHandle,
    new_config: ShortcutConfig,
    config: State<Mutex<ShortcutConfig>>,
) -> Result<(), String> {
    {
        let mut config_guard = config.lock().map_err(|e| e.to_string())?;
        *config_guard = new_config;
    }

    // TODO: Re-register shortcuts with new configuration
    // This would require access to the HearthShortcutManager instance

    Ok(())
}

/// Test if a shortcut string is valid
#[tauri::command]
pub fn validate_shortcut(shortcut: String) -> Result<bool, String> {
    use tauri_plugin_global_shortcut::Shortcut;
    match shortcut.parse::<Shortcut>() {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Invalid shortcut: {}", e)),
    }
}

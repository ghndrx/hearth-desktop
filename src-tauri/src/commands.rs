use tauri::Manager;
use tauri_plugin_notification::NotificationExt;

/// Get the application version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Set a window's always-on-top (pin) state
#[tauri::command]
pub async fn set_always_on_top(
    app: tauri::AppHandle,
    window_label: String,
    always_on_top: bool,
) -> Result<(), String> {
    let window = app
        .get_webview_window(&window_label)
        .ok_or_else(|| format!("Window '{}' not found", window_label))?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())
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

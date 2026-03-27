use tauri_plugin_notification::NotificationExt;
use tauri::Manager;

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

/// Set the always on top behavior for a window
/// Supports 'main' (default) and 'voice-overlay' windows
#[tauri::command]
pub async fn set_always_on_top(
    app: tauri::AppHandle,
    always_on_top: bool,
    window_label: Option<String>,
) -> Result<(), String> {
    let label = window_label.as_deref().unwrap_or("main");
    if let Some(window) = app.get_webview_window(label) {
        window
            .set_always_on_top(always_on_top)
            .map_err(|e| e.to_string())?;
    } else {
        return Err(format!("Window '{}' not found", label));
    }
    Ok(())
}

/// Show the voice overlay window
#[tauri::command]
pub async fn show_voice_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("voice-overlay") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        return Err("Voice overlay window not found".to_string());
    }
    Ok(())
}

/// Hide the voice overlay window
#[tauri::command]
pub async fn hide_voice_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("voice-overlay") {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        return Err("Voice overlay window not found".to_string());
    }
    Ok(())
}

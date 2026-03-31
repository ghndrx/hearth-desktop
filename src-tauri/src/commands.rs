use tauri_plugin_notification::NotificationExt;
use crate::idle::{self, IdleInfo};

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

/// Get the current system idle time information
#[tauri::command]
pub async fn get_idle_time() -> Result<IdleInfo, String> {
    idle::get_idle_time()
}

/// Get the current system idle time with custom threshold
#[tauri::command]
pub async fn get_idle_time_with_threshold(threshold_seconds: u64) -> Result<IdleInfo, String> {
    idle::get_idle_time_with_threshold(threshold_seconds)
}

/// Check if the system is currently idle (uses default 5-minute threshold)
#[tauri::command]
pub async fn is_system_idle() -> Result<bool, String> {
    let idle_info = idle::get_idle_time()?;
    Ok(idle_info.is_idle)
}

/// Get just the idle time in seconds
#[tauri::command]
pub async fn get_idle_seconds() -> Result<u64, String> {
    let idle_info = idle::get_idle_time()?;
    Ok(idle_info.idle_seconds)
}

use tauri::State;
use tauri_plugin_notification::NotificationExt;

use crate::notification_manager::{
    NotificationData, NotificationManager, NotificationSettings, NotificationStats, QueueResult,
};

/// Get the application version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Show a system notification directly (low-level, bypasses batching)
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
                window
                    .set_badge_count(Some(count as i64))
                    .map_err(|e| e.to_string())?;
            } else {
                window.set_badge_count(None).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Queue a notification through the notification manager with smart batching and priority
#[tauri::command]
pub async fn queue_notification(
    manager: State<'_, NotificationManager>,
    notification: NotificationData,
) -> Result<QueueResult, String> {
    manager.queue(notification).await
}

/// Flush ready notifications and dispatch them as system notifications
#[tauri::command]
pub async fn flush_notifications(
    app: tauri::AppHandle,
    manager: State<'_, NotificationManager>,
) -> Result<u32, String> {
    let ready = manager.flush_ready().await;
    let count = ready.len() as u32;

    for (title, body, _sound) in ready {
        app.notification()
            .builder()
            .title(&title)
            .body(&body)
            .show()
            .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

/// Get notification manager statistics
#[tauri::command]
pub async fn get_notification_stats(
    manager: State<'_, NotificationManager>,
) -> Result<NotificationStats, String> {
    Ok(manager.stats().await)
}

/// Update notification manager settings
#[tauri::command]
pub async fn update_notification_settings(
    manager: State<'_, NotificationManager>,
    settings: NotificationSettings,
) -> Result<(), String> {
    manager.update_settings(settings).await;
    Ok(())
}

/// Get current notification settings
#[tauri::command]
pub async fn get_notification_settings(
    manager: State<'_, NotificationManager>,
) -> Result<NotificationSettings, String> {
    Ok(manager.get_settings().await)
}

/// Clear all pending notifications
#[tauri::command]
pub async fn clear_notifications(
    manager: State<'_, NotificationManager>,
) -> Result<(), String> {
    manager.clear_all().await;
    Ok(())
}

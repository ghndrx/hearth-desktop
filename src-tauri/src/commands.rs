use tauri_plugin_notification::NotificationExt;
use serde::{Deserialize, Serialize};

use crate::tray;

/// Represents a notification action that users can interact with
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationAction {
    pub id: String,
    pub title: String,
}

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
    // Update tray state, menu, and tooltip
    tray::update_unread(&app, count);

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

/// Get whether minimize-to-tray is enabled
#[tauri::command]
pub fn get_minimize_to_tray(app: tauri::AppHandle) -> bool {
    tray::should_minimize_to_tray(&app)
}

/// Set whether minimize-to-tray is enabled
#[tauri::command]
pub fn set_minimize_to_tray(app: tauri::AppHandle, enabled: bool) {
    tray::set_minimize_to_tray(&app, enabled);
}

/// Send a rich notification with additional features
#[tauri::command]
pub async fn send_rich_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    icon: Option<String>,
    channel_id: Option<String>,
    actions: Option<Vec<NotificationAction>>,
) -> Result<(), String> {
    let mut builder = app.notification().builder().title(&title).body(&body);

    // Set icon if provided
    if let Some(icon_path) = icon {
        builder = builder.icon(&icon_path);
    }

    // Set channel ID if provided (for notification grouping)
    if let Some(channel) = channel_id {
        builder = builder.tag(&channel);
    }

    // Add actions if provided
    if let Some(action_list) = actions {
        for action in action_list {
            builder = builder.action(&action.id, &action.title);
        }
    }

    builder.show().map_err(|e| e.to_string())?;
    Ok(())
}

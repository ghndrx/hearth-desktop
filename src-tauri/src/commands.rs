use serde::{Deserialize, Serialize};
use tauri_plugin_notification::NotificationExt;
use nokhwa::utils::ApiBackend;
use nokhwa::query;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    /// Unique identifier for the source
    pub id: String,
    /// Display name of the source
    pub name: String,
    /// Type of source: "camera", "screen", or "window"
    pub source_type: String,
    /// Width in pixels (if available)
    pub width: Option<u32>,
    /// Height in pixels (if available)
    pub height: Option<u32>,
}

impl From<nokhwa::utils::CameraInfo> for Source {
    fn from(info: nokhwa::utils::CameraInfo) -> Self {
        let id = match info.index() {
            nokhwa::utils::CameraIndex::Index(i) => i.to_string(),
            nokhwa::utils::CameraIndex::String(s) => s.to_string(),
        };
        Source {
            id,
            name: info.human_name().to_string(),
            source_type: "camera".to_string(),
            width: None,
            height: None,
        }
    }
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

/// Enumerate available capture sources.
///
/// Note: nokhwa is a camera capture library and does not natively support
/// screen or window enumeration. This returns camera devices only.
/// For true screen/window capture, a different library like xcap would be needed.
#[tauri::command]
pub async fn enumerate_sources() -> Result<Vec<Source>, String> {
    match query(ApiBackend::Auto) {
        Ok(cameras) => Ok(cameras.into_iter().map(Source::from).collect()),
        Err(e) => Err(format!("Failed to enumerate sources: {}", e)),
    }
}

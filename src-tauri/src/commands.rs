use tauri_plugin_notification::NotificationExt;
use serde::{Deserialize, Serialize};

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

/// Represents a screen or window source for capture
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CaptureSource {
    pub id: String,
    pub name: String,
    pub source_type: String, // "screen" or "window"
    pub thumbnail: Option<String>, // base64 encoded thumbnail (future)
}

/// Enumerate available screens and windows for capture
#[tauri::command]
pub async fn enumerate_sources() -> Result<Vec<CaptureSource>, String> {
    let mut sources = Vec::new();

    // Add primary screen as a source
    sources.push(CaptureSource {
        id: "screen_0".to_string(),
        name: "Primary Screen".to_string(),
        source_type: "screen".to_string(),
        thumbnail: None,
    });

    // Platform-specific implementation to enumerate actual screens and windows
    #[cfg(target_os = "windows")]
    {
        // TODO: Implement Windows-specific screen/window enumeration
        sources.push(CaptureSource {
            id: "screen_1".to_string(),
            name: "Secondary Screen".to_string(),
            source_type: "screen".to_string(),
            thumbnail: None,
        });
    }

    #[cfg(target_os = "macos")]
    {
        // TODO: Implement macOS-specific screen/window enumeration
        sources.push(CaptureSource {
            id: "window_finder".to_string(),
            name: "Finder".to_string(),
            source_type: "window".to_string(),
            thumbnail: None,
        });
    }

    #[cfg(target_os = "linux")]
    {
        // TODO: Implement Linux-specific screen/window enumeration (X11/Wayland)
        sources.push(CaptureSource {
            id: "window_terminal".to_string(),
            name: "Terminal".to_string(),
            source_type: "window".to_string(),
            thumbnail: None,
        });
    }

    Ok(sources)
}

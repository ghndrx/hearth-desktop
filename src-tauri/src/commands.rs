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

/// Data structure for screen/window sources
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DesktopSource {
    pub id: String,
    pub name: String,
    pub r#type: String, // 'screen' or 'window'
    pub thumbnail: Option<String>, // base64 preview (optional)
}

/// Enumerate available screens and windows for screen sharing
#[tauri::command]
pub async fn enumerate_sources() -> Result<Vec<DesktopSource>, String> {
    let mut sources = Vec::new();

    // Get available screens using the screenshots crate
    match screenshots::Screen::all() {
        Ok(screens) => {
            for (index, screen) in screens.iter().enumerate() {
                let display_info = screen.display_info;
                sources.push(DesktopSource {
                    id: format!("screen_{}", index),
                    name: format!("Screen {} ({}x{})",
                        index + 1,
                        display_info.width,
                        display_info.height
                    ),
                    r#type: "screen".to_string(),
                    thumbnail: None, // TODO: Generate thumbnails in future iteration
                });
            }
        }
        Err(e) => {
            eprintln!("Failed to enumerate screens: {}", e);
            return Err(format!("Failed to enumerate screens: {}", e));
        }
    }

    // TODO: Add window enumeration in future iteration
    // For now, we'll focus on screens which are the primary use case

    Ok(sources)
}

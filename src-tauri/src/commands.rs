use tauri_plugin_notification::NotificationExt;
use screenshots::Screen;
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

/// Screen information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenInfo {
    pub id: u32,
    pub width: u32,
    pub height: u32,
    pub name: String,
}

/// Get list of available displays
#[tauri::command]
pub async fn get_displays() -> Result<Vec<ScreenInfo>, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;

    let screen_info: Vec<ScreenInfo> = screens
        .into_iter()
        .enumerate()
        .map(|(index, screen)| ScreenInfo {
            id: index as u32,
            width: screen.display_info.width,
            height: screen.display_info.height,
            name: format!("Display {}", index + 1),
        })
        .collect();

    Ok(screen_info)
}

/// Capture a screenshot of all displays
#[tauri::command]
pub async fn capture_all_screens() -> Result<Vec<String>, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;

    let mut screenshots = Vec::new();

    for screen in screens {
        let image = screen.capture().map_err(|e| e.to_string())?;

        // Convert to base64 encoded PNG
        let mut buffer = Vec::new();
        image.save_with_format(&mut std::io::Cursor::new(&mut buffer), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;

        let base64_image = base64::encode(&buffer);
        screenshots.push(format!("data:image/png;base64,{}", base64_image));
    }

    Ok(screenshots)
}

/// Capture a screenshot of a specific display
#[tauri::command]
pub async fn capture_screen(display_id: u32) -> Result<String, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;

    let screen = screens
        .get(display_id as usize)
        .ok_or_else(|| "Display not found".to_string())?;

    let image = screen.capture().map_err(|e| e.to_string())?;

    // Convert to base64 encoded PNG
    let mut buffer = Vec::new();
    image.save_with_format(&mut std::io::Cursor::new(&mut buffer), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    let base64_image = base64::encode(&buffer);
    Ok(format!("data:image/png;base64,{}", base64_image))
}

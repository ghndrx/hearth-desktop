use tauri_plugin_notification::NotificationExt;

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

/// Get available displays for screen capture
#[tauri::command]
pub async fn get_screens() -> Result<Vec<String>, String> {
    // Return mock display information for now
    // TODO: Implement actual screen enumeration when compatible screen capture crate is available
    Ok(vec![
        "Primary Display (1920x1080)".to_string(),
        "Secondary Display (1920x1080)".to_string(),
    ])
}

/// Capture a screenshot from the specified screen
#[tauri::command]
pub async fn capture_screen(screen_index: usize) -> Result<Vec<u8>, String> {
    if screen_index > 1 {
        return Err("Invalid screen index".to_string());
    }

    // Return mock RGB data for a 100x100 red square
    // TODO: Implement actual screen capture when compatible screen capture crate is available
    let width = 100;
    let height = 100;
    let mut rgb_data = Vec::with_capacity(width * height * 3);

    // Create a red square
    for _y in 0..height {
        for _x in 0..width {
            rgb_data.push(255); // R
            rgb_data.push(0);   // G
            rgb_data.push(0);   // B
        }
    }

    Ok(rgb_data)
}

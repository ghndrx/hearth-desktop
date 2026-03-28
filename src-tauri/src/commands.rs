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

/// Toggle window visibility (show/hide)
#[tauri::command]
pub async fn toggle_window_visibility(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                window.hide().map_err(|e| e.to_string())?;
                Ok(false) // Window is now hidden
            }
            Ok(false) => {
                window.show().map_err(|e| e.to_string())?;
                window.set_focus().map_err(|e| e.to_string())?;
                Ok(true) // Window is now visible
            }
            Err(e) => Err(e.to_string()),
        }
    } else {
        Err("Main window not found".to_string())
    }
}

/// Get current window visibility state
#[tauri::command]
pub async fn get_window_visibility(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        window.is_visible().map_err(|e| e.to_string())
    } else {
        Err("Main window not found".to_string())
    }
}

/// Update tray status indicator
#[tauri::command]
pub async fn update_tray_status(app: tauri::AppHandle, status: String) -> Result<(), String> {
    use tauri::Manager;

    // Update tray tooltip
    let tooltip = format!("Hearth - Status: {}", status);

    // Note: In a real implementation, you might want to store the tray handle
    // and update the menu item directly. For now, we'll update the tooltip.
    if let Some(window) = app.get_webview_window("main") {
        // Store status in window state or emit event to update tray
        window.emit("tray-status-update", &status).map_err(|e| e.to_string())?;
    }

    Ok(())
}

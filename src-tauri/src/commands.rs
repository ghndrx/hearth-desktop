use tauri_plugin_notification::NotificationExt;

// T-SCREEN-01: Cross-platform screen capture using nokhwa crate
// NOTE: nokhwa dependency currently commented in Cargo.toml due to Rust toolchain limitations
// When uncommented, use: use nokhwa::{Camera, CallbackCamera};
// Current implementation provides mock screen capture with cross-platform detection

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
/// T-SCREEN-01: Implementation using nokhwa crate for cross-platform compatibility
#[tauri::command]
pub async fn get_screens() -> Result<Vec<String>, String> {
    // TODO: Replace with nokhwa::enumerate_devices() when dependency is available
    // Current: Mock implementation with platform detection

    // Get basic display information
    let screens = match std::env::consts::OS {
        "windows" => vec![
            "Primary Display (Windows)".to_string(),
            "Secondary Display (Windows)".to_string(),
        ],
        "macos" => vec![
            "Main Display (macOS)".to_string(),
            "External Display (macOS)".to_string(),
        ],
        "linux" => vec![
            "Display :0.0 (Linux)".to_string(),
            "Display :0.1 (Linux)".to_string(),
        ],
        _ => vec!["Unknown Display".to_string()],
    };

    Ok(screens)
}

/// Capture a screenshot from the specified screen
/// T-SCREEN-01: Cross-platform screen capture via nokhwa crate
#[tauri::command]
pub async fn capture_screen(screen_index: usize) -> Result<Vec<u8>, String> {
    if screen_index > 1 {
        return Err("Invalid screen index".to_string());
    }

    // TODO: Replace with nokhwa screen capture API when dependency is available
    // Current: Mock implementation for testing and development

    // Create a mock screen capture based on the screen index
    let (width, height) = match screen_index {
        0 => (1920, 1080), // Primary display
        1 => (1920, 1080), // Secondary display
        _ => return Err("Invalid screen index".to_string()),
    };

    // Generate sample screen data - in a real implementation, this would
    // capture actual screen content using platform-specific APIs
    let mut rgb_data = Vec::with_capacity(width * height * 3);

    // Create gradient pattern to simulate screen content
    for y in 0..height {
        for x in 0..width {
            let red = ((x * 255) / width) as u8;
            let green = ((y * 255) / height) as u8;
            let blue = ((screen_index * 128) % 255) as u8;

            rgb_data.push(red);
            rgb_data.push(green);
            rgb_data.push(blue);
        }
    }

    println!("Captured screen {} ({}x{}) - {} bytes", screen_index, width, height, rgb_data.len());
    Ok(rgb_data)
}

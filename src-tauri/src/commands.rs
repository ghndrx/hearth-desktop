use tauri_plugin_notification::NotificationExt;

// T-SCREEN-01: Cross-platform screen capture using nokhwa crate
// use nokhwa::{Camera, query::query_devices, CaptureAPIBackend};
// Commented until Cargo 1.80+ available for edition2024 feature

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
    // TODO: Uncomment when nokhwa dependency is available (requires Cargo 1.80+)
    /*
    // Use nokhwa to query available capture devices
    match query_devices(CaptureAPIBackend::Auto) {
        Ok(devices) => {
            let screen_names: Vec<String> = devices
                .into_iter()
                .map(|device| device.human_name().to_string())
                .collect();

            // If no devices found, return a fallback list
            if screen_names.is_empty() {
                Ok(vec!["Default Screen".to_string()])
            } else {
                Ok(screen_names)
            }
        },
        Err(e) => {
            println!("Failed to query devices with nokhwa: {}", e);
            // Fallback continues below
        }
    }
    */

    // Current implementation: Platform-specific mock data
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

/// Capture from the specified camera device
/// T-SCREEN-01: Cross-platform camera capture via nokhwa crate
/// Note: nokhwa is designed for camera capture. Screen capture would require platform-specific APIs.
#[tauri::command]
pub async fn capture_screen(screen_index: usize) -> Result<Vec<u8>, String> {
    if screen_index > 1 {
        return Err("Invalid screen index".to_string());
    }

    // TODO: Uncomment when nokhwa dependency is available (requires Cargo 1.80+)
    /*
    // Get available devices
    let devices = query_devices(CaptureAPIBackend::Auto)
        .map_err(|e| format!("Failed to query devices: {}", e))?;

    if screen_index >= devices.len() {
        return Err("Invalid device index".to_string());
    }

    // Create camera from the selected device
    let device_info = &devices[screen_index];
    let mut camera = Camera::new(
        device_info.index().clone(),
        None, // Use default resolution
    ).map_err(|e| format!("Failed to create camera: {}", e))?;

    // Start streaming
    camera.open_stream().map_err(|e| format!("Failed to open stream: {}", e))?;

    // Capture a frame
    let frame = camera.frame().map_err(|e| format!("Failed to capture frame: {}", e))?;

    // Convert frame to RGB bytes
    let rgb_data = frame.decode_image::<nokhwa::pixel_format::RgbFormat>()
        .map_err(|e| format!("Failed to decode image: {}", e))?
        .into_raw();

    println!("Captured from device {} - {} bytes", device_info.human_name(), rgb_data.len());
    Ok(rgb_data)
    */

    // Current implementation: Mock screen capture for testing and development
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

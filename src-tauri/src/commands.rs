use tauri_plugin_notification::NotificationExt;
use nokhwa::{Camera, CameraInfo, pixel_format::RgbFormat, utils::{RequestedFormat, RequestedFormatType}};

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

/// Get available camera devices for screen capture
#[tauri::command]
pub async fn get_camera_devices() -> Result<Vec<CameraInfo>, String> {
    nokhwa::query(nokhwa::utils::ApiBackend::Auto)
        .map_err(|e| format!("Failed to query camera devices: {}", e))
}

/// Capture a frame from the specified camera
#[tauri::command]
pub async fn capture_frame(camera_index: u32) -> Result<Vec<u8>, String> {
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestResolution);
    let mut camera = Camera::new(camera_index, requested)
        .map_err(|e| format!("Failed to initialize camera: {}", e))?;

    // Open the camera
    camera.open_stream()
        .map_err(|e| format!("Failed to open camera stream: {}", e))?;

    // Capture a frame
    let frame = camera.frame()
        .map_err(|e| format!("Failed to capture frame: {}", e))?;

    // Convert to bytes
    Ok(frame.buffer().to_vec())
}

/// Take a screenshot using the default camera (for screen sharing)
#[tauri::command]
pub async fn take_screenshot() -> Result<Vec<u8>, String> {
    let cameras = get_camera_devices().await?;
    if cameras.is_empty() {
        return Err("No cameras available".to_string());
    }

    // Use the first available camera
    capture_frame(cameras[0].index().clone()).await
}

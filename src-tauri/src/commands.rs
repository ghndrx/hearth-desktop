use tauri_plugin_notification::NotificationExt;
use nokhwa::{Camera, CameraIndex, RequestedFormat, RequestedFormatType, Resolution, FrameFormat};
use base64::{Engine as _, engine::general_purpose};

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

/// Capture a screenshot using the default camera/screen capture device
#[tauri::command]
pub async fn capture_screen() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        // Try to get the first available camera device
        let camera_index = CameraIndex::Index(0);

        // Set up camera format preferences
        let requested_format = RequestedFormat::new::<FrameFormat>(
            RequestedFormatType::AbsoluteHighestResolution
        );

        // Initialize the camera
        let mut camera = Camera::new(camera_index, requested_format)
            .map_err(|e| format!("Failed to initialize camera: {}", e))?;

        // Open the camera stream
        camera.open_stream()
            .map_err(|e| format!("Failed to open camera stream: {}", e))?;

        // Capture a frame
        let frame = camera.frame()
            .map_err(|e| format!("Failed to capture frame: {}", e))?;

        // Stop the camera stream
        camera.stop_stream()
            .map_err(|e| format!("Failed to stop camera stream: {}", e))?;

        // Convert the frame to JPEG bytes
        let image_bytes = frame.buffer_bytes().to_vec();

        // Encode to base64
        let base64_image = general_purpose::STANDARD.encode(&image_bytes);

        Ok(base64_image)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

/// List available cameras/capture devices
#[tauri::command]
pub async fn list_cameras() -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(|| {
        let cameras = nokhwa::query_devices()
            .map_err(|e| format!("Failed to query devices: {}", e))?;

        let camera_names: Vec<String> = cameras
            .iter()
            .map(|info| info.human_name().to_string())
            .collect();

        Ok(camera_names)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

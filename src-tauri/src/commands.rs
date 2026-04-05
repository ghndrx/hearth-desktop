use tauri_plugin_notification::NotificationExt;
use nokhwa::{pixel_format::RgbFormat, utils::{RequestedFormat, RequestedFormatType, Resolution, FrameFormat}, Camera};
use std::sync::{Arc, Mutex};
use tauri::State;

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
pub async fn get_cameras() -> Result<Vec<String>, String> {
    use nokhwa::utils::CameraIndex;

    let cameras = nokhwa::query(nokhwa::utils::ApiBackend::Auto)
        .map_err(|e| format!("Failed to query cameras: {}", e))?;

    let camera_names = cameras
        .into_iter()
        .map(|info| format!("{}: {}", info.index().as_index().unwrap_or(0), info.human_name()))
        .collect();

    Ok(camera_names)
}

/// Initialize camera for screen capture
#[tauri::command]
pub async fn init_camera(camera_index: u32) -> Result<String, String> {
    use nokhwa::utils::CameraIndex;

    let index = CameraIndex::Index(camera_index);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    match Camera::new(index, requested) {
        Ok(mut camera) => {
            camera.open_stream().map_err(|e| format!("Failed to open camera stream: {}", e))?;
            Ok("Camera initialized successfully".to_string())
        }
        Err(e) => Err(format!("Failed to initialize camera: {}", e))
    }
}

/// Capture a single frame from the camera
#[tauri::command]
pub async fn capture_frame(camera_index: u32) -> Result<Vec<u8>, String> {
    use nokhwa::utils::CameraIndex;

    let index = CameraIndex::Index(camera_index);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    let mut camera = Camera::new(index, requested)
        .map_err(|e| format!("Failed to create camera: {}", e))?;

    camera.open_stream()
        .map_err(|e| format!("Failed to open camera stream: {}", e))?;

    let frame = camera.frame()
        .map_err(|e| format!("Failed to capture frame: {}", e))?;

    Ok(frame.buffer().to_vec())
}

/// Get camera resolution
#[tauri::command]
pub async fn get_camera_resolution(camera_index: u32) -> Result<(u32, u32), String> {
    use nokhwa::utils::CameraIndex;

    let index = CameraIndex::Index(camera_index);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    let camera = Camera::new(index, requested)
        .map_err(|e| format!("Failed to create camera: {}", e))?;

    let resolution = camera.resolution();
    Ok((resolution.width(), resolution.height()))
}

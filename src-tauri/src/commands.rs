use tauri_plugin_notification::NotificationExt;
use nokhwa::{Camera, CameraFormat, FrameFormat, Resolution, CameraIndex};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

/// Camera information structure for frontend
#[derive(Serialize, Deserialize)]
pub struct CameraInfo {
    pub index: u32,
    pub name: String,
    pub description: String,
}

/// List available cameras for screen capture
#[tauri::command]
pub async fn list_cameras() -> Result<Vec<CameraInfo>, String> {
    use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};

    match nokhwa::query(CameraIndex::Any) {
        Ok(cameras) => {
            let camera_list: Vec<CameraInfo> = cameras
                .into_iter()
                .enumerate()
                .map(|(index, camera_info)| CameraInfo {
                    index: index as u32,
                    name: camera_info.human_name().to_string(),
                    description: camera_info.description().to_string(),
                })
                .collect();
            Ok(camera_list)
        }
        Err(e) => Err(format!("Failed to query cameras: {}", e)),
    }
}

/// Capture a screenshot from the specified camera
#[tauri::command]
pub async fn capture_screen(camera_index: u32) -> Result<String, String> {
    use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};

    // Set up camera format - requesting highest framerate available
    let requested_format = RequestedFormat::new::<nokhwa::pixel_format::RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    // Initialize camera
    let camera_index = CameraIndex::Index(camera_index);
    let mut camera = Camera::new(camera_index, requested_format)
        .map_err(|e| format!("Failed to initialize camera: {}", e))?;

    // Open camera stream
    camera.open_stream()
        .map_err(|e| format!("Failed to open camera stream: {}", e))?;

    // Capture frame
    let frame = camera.frame()
        .map_err(|e| format!("Failed to capture frame: {}", e))?;

    // Convert frame to base64 string for easy transport to frontend
    let image_buffer = frame.buffer_bytes();
    let base64_image = base64::encode(image_buffer);

    // Stop camera
    let _ = camera.stop_stream();

    Ok(base64_image)
}

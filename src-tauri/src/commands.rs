use tauri_plugin_notification::NotificationExt;
use nokhwa::{Camera, pixel_format::RgbFormat, utils::{RequestedFormat, RequestedFormatType, Resolution, CameraIndex}};
use std::io::Cursor;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CameraInfo {
    pub index: u32,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenCaptureResult {
    pub success: bool,
    pub image_data: Option<Vec<u8>>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub error: Option<String>,
}

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

/// List available cameras for screen/video capture
#[tauri::command]
pub async fn list_cameras() -> Result<Vec<CameraInfo>, String> {
    match nokhwa::query_devices() {
        Ok(devices) => {
            let camera_list = devices
                .into_iter()
                .enumerate()
                .map(|(index, device)| CameraInfo {
                    index: index as u32,
                    name: device.human_name(),
                    description: device.description(),
                })
                .collect();
            Ok(camera_list)
        }
        Err(e) => Err(format!("Failed to query cameras: {}", e)),
    }
}

/// Capture a frame from the specified camera
#[tauri::command]
pub async fn capture_screen(camera_index: Option<u32>) -> Result<ScreenCaptureResult, String> {
    let index = match camera_index {
        Some(idx) => CameraIndex::Index(idx),
        None => CameraIndex::Index(0), // Default to first camera
    };

    // Request format for capture
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestResolution);

    // Open camera
    let mut camera = match Camera::new(index, requested) {
        Ok(cam) => cam,
        Err(e) => {
            return Ok(ScreenCaptureResult {
                success: false,
                image_data: None,
                width: None,
                height: None,
                error: Some(format!("Failed to open camera: {}", e)),
            });
        }
    };

    // Capture frame
    match camera.frame() {
        Ok(frame) => {
            let resolution = frame.resolution();
            let image_data = frame.buffer_bytes().to_vec();

            Ok(ScreenCaptureResult {
                success: true,
                image_data: Some(image_data),
                width: Some(resolution.width()),
                height: Some(resolution.height()),
                error: None,
            })
        }
        Err(e) => Ok(ScreenCaptureResult {
            success: false,
            image_data: None,
            width: None,
            height: None,
            error: Some(format!("Failed to capture frame: {}", e)),
        }),
    }
}

use tauri_plugin_notification::NotificationExt;
use serde::{Deserialize, Serialize};
use nokhwa::{Camera, CameraInfo};
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};

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

/// Information about an available camera device
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CameraDeviceInfo {
    pub index: u32,
    pub name: String,
    pub description: String,
}

/// Get information about all available camera devices
/// Using nokhwa crate for cross-platform screen capture
#[tauri::command]
pub async fn get_camera_devices() -> Result<Vec<CameraDeviceInfo>, String> {
    match nokhwa::query_devices() {
        Ok(devices) => {
            let camera_info: Vec<CameraDeviceInfo> = devices
                .into_iter()
                .enumerate()
                .map(|(i, info)| CameraDeviceInfo {
                    index: i as u32,
                    name: info.human_name().to_string(),
                    description: format!("{:?}", info),
                })
                .collect();
            Ok(camera_info)
        }
        Err(e) => Err(format!("Failed to query camera devices: {}", e)),
    }
}

/// Test camera/capture system readiness using nokhwa
#[tauri::command]
pub async fn test_camera_connection(camera_index: u32) -> Result<String, String> {
    // Test camera initialization with nokhwa
    let format = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    match Camera::new(CameraIndex::Index(camera_index), format) {
        Ok(mut camera) => {
            match camera.open_stream() {
                Ok(_) => {
                    let _ = camera.stop_stream();
                    Ok(format!("Camera {} successfully tested with nokhwa", camera_index))
                }
                Err(e) => Err(format!("Failed to open camera stream: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to initialize camera {}: {}", camera_index, e)),
    }
}

use tauri_plugin_notification::NotificationExt;
use nokhwa::{Camera, CallbackCamera};
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
use std::sync::Mutex;
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

/// Get available cameras/capture devices
#[tauri::command]
pub async fn get_capture_devices() -> Result<Vec<String>, String> {
    match nokhwa::query_devices() {
        Ok(devices) => {
            let device_names = devices
                .into_iter()
                .map(|device| device.human_name().to_string())
                .collect();
            Ok(device_names)
        }
        Err(e) => Err(format!("Failed to query capture devices: {}", e)),
    }
}

/// Initialize camera capture
#[tauri::command]
pub async fn init_camera_capture(camera_index: u32) -> Result<String, String> {
    let index = CameraIndex::Index(camera_index);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    match Camera::new(index, requested) {
        Ok(mut camera) => {
            match camera.open_stream() {
                Ok(_) => Ok("Camera capture initialized successfully".to_string()),
                Err(e) => Err(format!("Failed to open camera stream: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to initialize camera: {}", e)),
    }
}

/// Capture a frame from the camera
#[tauri::command]
pub async fn capture_frame(camera_index: u32) -> Result<Vec<u8>, String> {
    let index = CameraIndex::Index(camera_index);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    match Camera::new(index, requested) {
        Ok(mut camera) => {
            match camera.open_stream() {
                Ok(_) => {
                    match camera.frame() {
                        Ok(frame) => {
                            let buffer = frame.buffer().to_vec();
                            Ok(buffer)
                        }
                        Err(e) => Err(format!("Failed to capture frame: {}", e)),
                    }
                }
                Err(e) => Err(format!("Failed to open camera stream: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to initialize camera: {}", e)),
    }
}

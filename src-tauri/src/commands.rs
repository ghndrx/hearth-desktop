use tauri_plugin_notification::NotificationExt;
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType, Resolution};
use nokhwa::{Camera, CallbackCamera};
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

/// Get list of available cameras/capture devices
#[tauri::command]
pub fn get_capture_devices() -> Result<Vec<HashMap<String, String>>, String> {
    match nokhwa::query(nokhwa::utils::ApiBackend::Auto) {
        Ok(devices) => {
            let device_list = devices
                .iter()
                .map(|info| {
                    let mut device = HashMap::new();
                    device.insert("index".to_string(), info.index().to_string());
                    device.insert("name".to_string(), info.human_name().to_string());
                    device.insert("description".to_string(), info.description().to_string());
                    device
                })
                .collect();
            Ok(device_list)
        }
        Err(e) => Err(format!("Failed to query capture devices: {}", e)),
    }
}

/// Start screen/camera capture
#[tauri::command]
pub async fn start_capture(device_index: u32, width: u32, height: u32) -> Result<String, String> {
    let index = CameraIndex::Index(device_index);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestResolution);

    match Camera::new(index, requested) {
        Ok(mut camera) => {
            match camera.open_stream() {
                Ok(_) => {
                    // Camera opened successfully
                    Ok(format!("Capture started on device {} at {}x{}", device_index, width, height))
                }
                Err(e) => Err(format!("Failed to open camera stream: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to initialize camera: {}", e)),
    }
}

/// Capture a single frame from the camera
#[tauri::command]
pub async fn capture_frame(device_index: u32) -> Result<Vec<u8>, String> {
    let index = CameraIndex::Index(device_index);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestResolution);

    match Camera::new(index, requested) {
        Ok(mut camera) => {
            match camera.open_stream() {
                Ok(_) => {
                    match camera.frame() {
                        Ok(frame) => {
                            // Convert frame to bytes that can be sent to frontend
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

/// Stop capture for a specific device
#[tauri::command]
pub async fn stop_capture(device_index: u32) -> Result<String, String> {
    // Since Camera automatically stops when dropped, this is mainly for cleanup
    Ok(format!("Capture stopped for device {}", device_index))
}

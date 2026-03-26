use tauri_plugin_notification::NotificationExt;
use nokhwa::{Camera, CameraFormat, FrameFormat, CameraInfo, utils::{RequestedFormat, RequestedFormatType}};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;

/// Screen capture device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenCaptureDevice {
    pub index: u32,
    pub name: String,
    pub description: Option<String>,
}

/// Screen capture state manager
pub type ScreenCaptureState = Arc<Mutex<HashMap<u32, Camera>>>;

/// Initialize screen capture state
pub fn init_screen_capture_state() -> ScreenCaptureState {
    Arc::new(Mutex::new(HashMap::new()))
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

/// List available screen capture devices
#[tauri::command]
pub async fn list_screen_capture_devices() -> Result<Vec<ScreenCaptureDevice>, String> {
    match nokhwa::query_devices() {
        Ok(devices) => {
            let screen_devices: Vec<ScreenCaptureDevice> = devices
                .into_iter()
                .enumerate()
                .map(|(index, info)| ScreenCaptureDevice {
                    index: index as u32,
                    name: info.human_name().to_string(),
                    description: info.description().map(|s| s.to_string()),
                })
                .collect();
            Ok(screen_devices)
        }
        Err(e) => Err(format!("Failed to query screen capture devices: {}", e)),
    }
}

/// Initialize screen capture for a specific device
#[tauri::command]
pub async fn init_screen_capture(
    device_index: u32,
    state: State<'_, ScreenCaptureState>,
) -> Result<(), String> {
    let format = RequestedFormat::new::<FrameFormat>(RequestedFormatType::AbsoluteHighestResolution);

    match Camera::new(device_index, format) {
        Ok(camera) => {
            let mut capture_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
            capture_state.insert(device_index, camera);
            Ok(())
        }
        Err(e) => Err(format!("Failed to initialize screen capture: {}", e)),
    }
}

/// Start screen capture for a device
#[tauri::command]
pub async fn start_screen_capture(
    device_index: u32,
    state: State<'_, ScreenCaptureState>,
) -> Result<(), String> {
    let mut capture_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(camera) = capture_state.get_mut(&device_index) {
        camera.open_stream().map_err(|e| format!("Failed to start capture: {}", e))?;
        Ok(())
    } else {
        Err("Device not initialized".to_string())
    }
}

/// Stop screen capture for a device
#[tauri::command]
pub async fn stop_screen_capture(
    device_index: u32,
    state: State<'_, ScreenCaptureState>,
) -> Result<(), String> {
    let mut capture_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(camera) = capture_state.get_mut(&device_index) {
        camera.stop_stream().map_err(|e| format!("Failed to stop capture: {}", e))?;
        Ok(())
    } else {
        Err("Device not initialized".to_string())
    }
}

/// Capture a single frame from the device
#[tauri::command]
pub async fn capture_frame(
    device_index: u32,
    state: State<'_, ScreenCaptureState>,
) -> Result<Vec<u8>, String> {
    let mut capture_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(camera) = capture_state.get_mut(&device_index) {
        match camera.frame() {
            Ok(frame) => {
                // Convert frame to JPEG bytes for frontend consumption
                let image = frame.decode_image::<FrameFormat>()
                    .map_err(|e| format!("Failed to decode frame: {}", e))?;

                // Convert to JPEG bytes
                let mut jpeg_bytes = Vec::new();
                image.write_to(&mut std::io::Cursor::new(&mut jpeg_bytes), image::ImageFormat::Jpeg)
                    .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

                Ok(jpeg_bytes)
            }
            Err(e) => Err(format!("Failed to capture frame: {}", e)),
        }
    } else {
        Err("Device not initialized".to_string())
    }
}

/// Get device information for a specific capture device
#[tauri::command]
pub async fn get_device_info(
    device_index: u32,
    state: State<'_, ScreenCaptureState>,
) -> Result<ScreenCaptureDevice, String> {
    let capture_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(camera) = capture_state.get(&device_index) {
        let info = camera.info();
        Ok(ScreenCaptureDevice {
            index: device_index,
            name: info.human_name().to_string(),
            description: info.description().map(|s| s.to_string()),
        })
    } else {
        Err("Device not initialized".to_string())
    }
}

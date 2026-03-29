use tauri_plugin_notification::NotificationExt;
use nokhwa::{Camera, CallbackCamera};
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
use std::sync::Mutex;
use tauri::State;
use screenshots::Screen;

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

/// Get available screens/displays for capture
#[tauri::command]
pub async fn get_screens() -> Result<Vec<String>, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let screen_names = screens
        .into_iter()
        .enumerate()
        .map(|(index, screen)| {
            format!("Display {} ({}x{})", index, screen.display_info.width, screen.display_info.height)
        })
        .collect();
    Ok(screen_names)
}

/// Capture the entire screen (primary display)
#[tauri::command]
pub async fn capture_screen() -> Result<Vec<u8>, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let primary_screen = screens.into_iter().next()
        .ok_or("No screens available")?;

    let image = primary_screen.capture()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;

    // Convert image to PNG bytes
    let mut png_data = Vec::new();
    image.save_png(&mut png_data)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    Ok(png_data)
}

/// Capture a specific screen by index
#[tauri::command]
pub async fn capture_screen_by_index(screen_index: usize) -> Result<Vec<u8>, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let screen = screens.into_iter().nth(screen_index)
        .ok_or(format!("Screen with index {} not found", screen_index))?;

    let image = screen.capture()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;

    // Convert image to PNG bytes
    let mut png_data = Vec::new();
    image.save_png(&mut png_data)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    Ok(png_data)
}

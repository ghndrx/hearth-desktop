use tauri_plugin_notification::NotificationExt;
use nokhwa::{Camera, CameraInfo, native_api_backend};
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

/// Get list of available cameras and capture devices
#[tauri::command]
pub async fn list_capture_devices() -> Result<Vec<HashMap<String, String>>, String> {
    let cameras = nokhwa::query(native_api_backend())
        .map_err(|e| format!("Failed to query cameras: {}", e))?;

    let mut devices = Vec::new();
    for camera in cameras {
        let mut device_info = HashMap::new();
        device_info.insert("index".to_string(), camera.index().to_string());
        device_info.insert("name".to_string(), camera.human_name().to_string());
        device_info.insert("description".to_string(), camera.description().to_string());
        device_info.insert("misc".to_string(), camera.misc().to_string());
        devices.push(device_info);
    }

    Ok(devices)
}

/// Capture a screenshot/frame from specified camera
#[tauri::command]
pub async fn capture_frame(camera_index: usize) -> Result<String, String> {
    let camera_info = CameraInfo::new(
        &format!("Camera {}", camera_index),
        &format!("Camera device {}", camera_index),
        "",
        camera_index,
    );

    let mut camera = Camera::new(camera_info, nokhwa::utils::RequestedFormat::new::<nokhwa::utils::RgbFormat>(nokhwa::utils::RequestedFormatType::AbsoluteHighestResolution))
        .map_err(|e| format!("Failed to initialize camera: {}", e))?;

    // Open the camera stream
    camera.open_stream()
        .map_err(|e| format!("Failed to open camera stream: {}", e))?;

    // Capture a frame
    let frame = camera.frame()
        .map_err(|e| format!("Failed to capture frame: {}", e))?;

    // Convert frame to base64 string for transmission
    let image_buffer = frame.decode_image::<nokhwa::utils::RgbFormat>()
        .map_err(|e| format!("Failed to decode frame: {}", e))?;

    // Convert to PNG bytes
    let mut png_bytes = Vec::new();
    let width = image_buffer.width();
    let height = image_buffer.height();
    let raw_data = image_buffer.as_raw();

    // Create PNG encoder
    let mut encoder = png::Encoder::new(&mut png_bytes, width, height);
    encoder.set_color(png::ColorType::Rgb);
    encoder.set_depth(png::BitDepth::Eight);

    let mut writer = encoder.write_header()
        .map_err(|e| format!("Failed to write PNG header: {}", e))?;

    writer.write_image_data(raw_data)
        .map_err(|e| format!("Failed to write PNG data: {}", e))?;

    writer.finish()
        .map_err(|e| format!("Failed to finish PNG: {}", e))?;

    // Encode to base64
    let base64_image = base64::encode(&png_bytes);

    // Stop the camera stream
    camera.stop_stream()
        .map_err(|e| format!("Failed to stop camera stream: {}", e))?;

    Ok(format!("data:image/png;base64,{}", base64_image))
}

/// Get camera information and capabilities
#[tauri::command]
pub async fn get_camera_info(camera_index: usize) -> Result<HashMap<String, String>, String> {
    let camera_info = CameraInfo::new(
        &format!("Camera {}", camera_index),
        &format!("Camera device {}", camera_index),
        "",
        camera_index,
    );

    let camera = Camera::new(camera_info, nokhwa::utils::RequestedFormat::new::<nokhwa::utils::RgbFormat>(nokhwa::utils::RequestedFormatType::AbsoluteHighestResolution))
        .map_err(|e| format!("Failed to initialize camera: {}", e))?;

    let mut info = HashMap::new();
    info.insert("index".to_string(), camera_index.to_string());
    info.insert("backend".to_string(), camera.backend().to_string());

    if let Ok(resolution) = camera.resolution() {
        info.insert("width".to_string(), resolution.width().to_string());
        info.insert("height".to_string(), resolution.height().to_string());
    }

    if let Ok(framerate) = camera.frame_rate() {
        info.insert("framerate".to_string(), framerate.to_string());
    }

    Ok(info)
}

use tauri_plugin_notification::NotificationExt;
use nokhwa::{pixel_format::RgbFormat, utils::{CameraIndex, RequestedFormat, RequestedFormatType}, Camera};
use std::io::Cursor;
use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CameraInfo {
    pub index: usize,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenCaptureResult {
    pub success: bool,
    pub data: Option<String>, // Base64 encoded image data
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

/// Get available cameras for screen capture
#[tauri::command]
pub async fn get_available_cameras() -> Result<Vec<CameraInfo>, String> {
    let cameras = nokhwa::query(nokhwa::utils::ApiBackend::Auto)
        .map_err(|e| format!("Failed to query cameras: {}", e))?;

    let camera_list: Vec<CameraInfo> = cameras
        .into_iter()
        .enumerate()
        .map(|(index, info)| CameraInfo {
            index,
            name: info.human_name().to_string(),
        })
        .collect();

    Ok(camera_list)
}

/// Capture a screenshot from the specified camera
#[tauri::command]
pub async fn capture_screen(camera_index: usize) -> Result<ScreenCaptureResult, String> {
    let index = CameraIndex::Index(camera_index as u32);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    match Camera::new(index, requested) {
        Ok(mut camera) => {
            match camera.open_stream() {
                Ok(_) => {
                    // Wait a moment for the camera to initialize
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

                    match camera.frame() {
                        Ok(frame) => {
                            let image = frame.decode_image::<RgbFormat>().map_err(|e| e.to_string())?;

                            // Convert to PNG format
                            let mut png_data = Vec::new();
                            {
                                let mut cursor = Cursor::new(&mut png_data);
                                image.write_to(&mut cursor, image::ImageFormat::Png)
                                    .map_err(|e| format!("Failed to encode PNG: {}", e))?;
                            }

                            // Encode to base64
                            let base64_data = general_purpose::STANDARD.encode(&png_data);

                            Ok(ScreenCaptureResult {
                                success: true,
                                data: Some(base64_data),
                                error: None,
                            })
                        }
                        Err(e) => Ok(ScreenCaptureResult {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to capture frame: {}", e)),
                        })
                    }
                }
                Err(e) => Ok(ScreenCaptureResult {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to open camera stream: {}", e)),
                })
            }
        }
        Err(e) => Ok(ScreenCaptureResult {
            success: false,
            data: None,
            error: Some(format!("Failed to initialize camera: {}", e)),
        })
    }
}

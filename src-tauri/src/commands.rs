use tauri_plugin_notification::NotificationExt;
use tauri::Manager;
use nokhwa::{utils::CameraInfo, query, utils::CameraIndex};
use serde::{Deserialize, Serialize};

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

/// Toggle main window visibility (show/hide/focus)
#[tauri::command]
pub async fn toggle_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                window.hide().map_err(|e| e.to_string())?;
            }
            _ => {
                window.show().map_err(|e| e.to_string())?;
                window.set_focus().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Screen capture information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenInfo {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
}

/// Get list of available screens/displays for capture
#[tauri::command]
pub async fn get_available_screens() -> Result<Vec<ScreenInfo>, String> {
    let cameras = query(nokhwa::utils::ApiBackend::Auto).map_err(|e| e.to_string())?;

    let screens: Vec<ScreenInfo> = cameras
        .into_iter()
        .enumerate()
        .map(|(i, info)| ScreenInfo {
            id: i.to_string(),
            name: info.human_name().to_string(),
            width: 1920, // Default resolution - would need platform-specific code to get actual
            height: 1080,
        })
        .collect();

    Ok(screens)
}

/// Capture a screenshot from the specified screen
#[tauri::command]
pub async fn capture_screenshot(screen_id: String) -> Result<String, String> {
    let camera_index = screen_id.parse::<usize>().map_err(|_| "Invalid screen ID")?;

    // Use nokhwa to capture from camera/screen
    let mut camera = nokhwa::Camera::new(
        CameraIndex::Index(camera_index as u32),
        None,
    ).map_err(|e| format!("Failed to open camera: {}", e))?;

    // Open the camera stream
    camera.open_stream().map_err(|e| format!("Failed to open stream: {}", e))?;

    // Capture a frame
    let frame = camera.frame().map_err(|e| format!("Failed to capture frame: {}", e))?;

    // Convert frame to base64 for frontend
    let image_buffer = frame.buffer();
    let encoded = base64::encode(image_buffer);

    // Stop the camera stream
    camera.stop_stream().map_err(|e| format!("Failed to stop stream: {}", e))?;

    Ok(format!("data:image/jpeg;base64,{}", encoded))
}

/// Check screen capture permissions (platform-specific)
#[tauri::command]
pub async fn check_screen_capture_permissions() -> Result<bool, String> {
    // On macOS, we need to check screen recording permissions
    #[cfg(target_os = "macos")]
    {
        // This is a simplified check - in a real app you'd use CGPreflightScreenCaptureAccess
        Ok(true)
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On other platforms, assume permissions are available
        Ok(true)
    }
}

/// Request screen capture permissions (platform-specific)
#[tauri::command]
pub async fn request_screen_capture_permissions() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, we'd need to request screen recording permission
        // This would typically open System Preferences
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

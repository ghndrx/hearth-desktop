use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size};
use tauri_plugin_notification::NotificationExt;
use serde::{Deserialize, Serialize};

/// Position data for PiP window
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiPPosition {
    pub x: f64,
    pub y: f64,
}

/// Size data for PiP window
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiPSize {
    pub width: f64,
    pub height: f64,
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

/// Create a picture-in-picture window for voice channel
#[tauri::command]
pub async fn create_pip_window(
    app: AppHandle,
    position: PiPPosition,
    size: PiPSize,
) -> Result<(), String> {
    // Check if PiP window already exists
    if app.get_webview_window("pip").is_some() {
        return Err("PiP window already exists".to_string());
    }

    let pip_window = tauri::WebviewWindowBuilder::new(
        &app,
        "pip",
        tauri::WebviewUrl::App("pip".into()),
    )
    .title("Hearth Voice")
    .inner_size(size.width, size.height)
    .min_inner_size(250.0, 150.0)
    .position(position.x, position.y)
    .resizable(true)
    .decorations(false)
    .always_on_top(true)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    // Set window properties for better PiP experience
    #[cfg(target_os = "windows")]
    {
        // On Windows, make the window topmost
        pip_window.set_always_on_top(true).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, set window level to floating
        pip_window.set_always_on_top(true).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Close the picture-in-picture window
#[tauri::command]
pub async fn close_pip_window(app: AppHandle) -> Result<(), String> {
    if let Some(pip_window) = app.get_webview_window("pip") {
        pip_window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Update PiP window position
#[tauri::command]
pub async fn update_pip_position(app: AppHandle, position: PiPPosition) -> Result<(), String> {
    if let Some(pip_window) = app.get_webview_window("pip") {
        pip_window
            .set_position(Position::Physical(PhysicalPosition {
                x: position.x as i32,
                y: position.y as i32,
            }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Update PiP window size
#[tauri::command]
pub async fn update_pip_size(app: AppHandle, size: PiPSize) -> Result<(), String> {
    if let Some(pip_window) = app.get_webview_window("pip") {
        pip_window
            .set_size(Size::Physical(PhysicalSize {
                width: size.width as u32,
                height: size.height as u32,
            }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Set PiP window transparency
#[tauri::command]
pub async fn set_pip_transparency(app: AppHandle, alpha: f64) -> Result<(), String> {
    if let Some(pip_window) = app.get_webview_window("pip") {
        // Clamp alpha between 0.5 and 1.0
        let clamped_alpha = alpha.max(0.5).min(1.0);

        // Note: Transparency setting varies by platform
        // This is a basic implementation - platform-specific enhancements may be needed
        #[cfg(target_os = "windows")]
        {
            // On Windows, we might need to use SetLayeredWindowAttributes
            // For now, we'll use the basic transparency support
        }

        // For cross-platform transparency, we rely on the CSS opacity in the frontend
        // and the transparent window flag set during creation
    }
    Ok(())
}

/// Toggle PiP window always on top
#[tauri::command]
pub async fn toggle_pip_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(pip_window) = app.get_webview_window("pip") {
        pip_window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get current screen dimensions for snap zone calculations
#[tauri::command]
pub async fn get_screen_size(app: AppHandle) -> Result<PiPSize, String> {
    // Get the current monitor information
    // For now, we'll use basic screen dimensions
    // In a more advanced implementation, you could use platform-specific APIs
    // to get the actual monitor dimensions and work area

    #[cfg(target_os = "windows")]
    {
        // On Windows, you could use GetSystemMetrics
        // For now, we'll use a reasonable default
        Ok(PiPSize {
            width: 1920.0,
            height: 1080.0,
        })
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, you could use NSScreen
        // For now, we'll use a reasonable default
        Ok(PiPSize {
            width: 1920.0,
            height: 1080.0,
        })
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, you could use X11 or Wayland APIs
        // For now, we'll use a reasonable default
        Ok(PiPSize {
            width: 1920.0,
            height: 1080.0,
        })
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(PiPSize {
            width: 1920.0,
            height: 1080.0,
        })
    }
}

/// Show PiP window if hidden
#[tauri::command]
pub async fn show_pip_window(app: AppHandle) -> Result<(), String> {
    if let Some(pip_window) = app.get_webview_window("pip") {
        pip_window.show().map_err(|e| e.to_string())?;
        pip_window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide PiP window
#[tauri::command]
pub async fn hide_pip_window(app: AppHandle) -> Result<(), String> {
    if let Some(pip_window) = app.get_webview_window("pip") {
        pip_window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get work area (available screen space excluding taskbars, docks, etc.)
#[tauri::command]
pub async fn get_work_area(app: AppHandle) -> Result<PiPSize, String> {
    // Get the work area which excludes taskbars, docks, and other system UI
    // This provides more accurate positioning for PiP windows

    // For now, estimate work area as slightly smaller than screen size
    // In a real implementation, you'd use platform-specific APIs:
    // - Windows: GetMonitorInfo with MONITORINFOEX
    // - macOS: NSScreen.visibleFrame
    // - Linux: _NET_WORKAREA from window manager

    Ok(PiPSize {
        width: 1920.0 - 40.0, // Account for potential side panels
        height: 1080.0 - 80.0, // Account for taskbar/dock
    })
}

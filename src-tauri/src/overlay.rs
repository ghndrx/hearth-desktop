use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewWindow, LogicalPosition, LogicalSize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlaySize {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayState {
    pub visible: bool,
    pub position: OverlayPosition,
    pub size: OverlaySize,
    pub opacity: f64,
}

impl Default for OverlayState {
    fn default() -> Self {
        Self {
            visible: false,
            position: OverlayPosition { x: 50.0, y: 50.0 },
            size: OverlaySize { width: 320.0, height: 180.0 },
            opacity: 0.9,
        }
    }
}

/// Get the overlay window instance
pub fn get_overlay_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("overlay")
        .ok_or_else(|| "Overlay window not found".to_string())
}

/// Show the overlay window
pub async fn show_overlay(app: &AppHandle) -> Result<(), String> {
    let overlay = get_overlay_window(app)?;

    // Ensure window properties are set correctly
    overlay.set_always_on_top(true).map_err(|e| e.to_string())?;
    overlay.set_skip_taskbar(true).map_err(|e| e.to_string())?;
    overlay.set_decorations(false).map_err(|e| e.to_string())?;

    overlay.show().map_err(|e| e.to_string())?;

    Ok(())
}

/// Hide the overlay window
pub async fn hide_overlay(app: &AppHandle) -> Result<(), String> {
    let overlay = get_overlay_window(app)?;
    overlay.hide().map_err(|e| e.to_string())?;
    Ok(())
}

/// Toggle the overlay window visibility
pub async fn toggle_overlay(app: &AppHandle) -> Result<bool, String> {
    let overlay = get_overlay_window(app)?;
    let is_visible = overlay.is_visible().map_err(|e| e.to_string())?;

    if is_visible {
        hide_overlay(app).await?;
        Ok(false)
    } else {
        show_overlay(app).await?;
        Ok(true)
    }
}

/// Set overlay position
pub async fn set_overlay_position(app: &AppHandle, position: OverlayPosition) -> Result<(), String> {
    let overlay = get_overlay_window(app)?;
    let logical_position = LogicalPosition::new(position.x, position.y);
    overlay.set_position(logical_position).map_err(|e| e.to_string())?;
    Ok(())
}

/// Set overlay size
pub async fn set_overlay_size(app: &AppHandle, size: OverlaySize) -> Result<(), String> {
    let overlay = get_overlay_window(app)?;
    let logical_size = LogicalSize::new(size.width, size.height);
    overlay.set_size(logical_size).map_err(|e| e.to_string())?;
    Ok(())
}

/// Set overlay opacity (0.0 to 1.0)
pub async fn set_overlay_opacity(app: &AppHandle, opacity: f64) -> Result<(), String> {
    let overlay = get_overlay_window(app)?;
    let clamped_opacity = opacity.clamp(0.0, 1.0);

    // Note: Tauri doesn't have a direct set_opacity method in v2
    // We'll use CSS-based opacity control through the frontend
    overlay.emit("overlay-opacity-changed", clamped_opacity)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get current overlay state
pub async fn get_overlay_state(app: &AppHandle) -> Result<OverlayState, String> {
    let overlay = get_overlay_window(app)?;

    let visible = overlay.is_visible().map_err(|e| e.to_string())?;
    let position = overlay.outer_position().map_err(|e| e.to_string())?;
    let size = overlay.outer_size().map_err(|e| e.to_string())?;

    Ok(OverlayState {
        visible,
        position: OverlayPosition {
            x: position.x as f64,
            y: position.y as f64,
        },
        size: OverlaySize {
            width: size.width as f64,
            height: size.height as f64,
        },
        opacity: 0.9, // Default value since we can't get this directly from Tauri v2
    })
}

/// Initialize overlay window setup
pub fn setup_overlay(app: &AppHandle) -> Result<(), String> {
    let overlay = get_overlay_window(app)?;

    // Set initial properties
    overlay.set_always_on_top(true).map_err(|e| e.to_string())?;
    overlay.set_skip_taskbar(true).map_err(|e| e.to_string())?;
    overlay.set_decorations(false).map_err(|e| e.to_string())?;

    // Start hidden
    overlay.hide().map_err(|e| e.to_string())?;

    println!("Overlay window initialized successfully");
    Ok(())
}

/// Check if the system supports overlay functionality
pub fn check_overlay_support() -> bool {
    // Basic platform checks - all major platforms support overlay windows
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    return true;

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return false;
}
use tauri::{AppHandle, Manager, Window, WindowBuilder, WindowUrl};
use std::collections::HashMap;

/// Create the overlay window if it doesn't exist
#[tauri::command]
pub async fn create_overlay(app: AppHandle) -> Result<(), String> {
    // Check if overlay window already exists
    if app.get_webview_window("overlay").is_some() {
        return Ok(());
    }

    // Create overlay window
    let _window = WindowBuilder::new(&app, "overlay", WindowUrl::App("overlay".into()))
        .title("Hearth Overlay")
        .inner_size(300.0, 200.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .visible(false)
        .skip_taskbar(true)
        .closable(false)
        .minimizable(false)
        .maximizable(false)
        .center(false)
        .focused(false)
        .position(50.0, 50.0)
        .build()
        .map_err(|e| format!("Failed to create overlay window: {}", e))?;

    Ok(())
}

/// Show the overlay window
#[tauri::command]
pub async fn show_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.show().map_err(|e| e.to_string())?;
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
    } else {
        return Err("Overlay window not found".to_string());
    }
    Ok(())
}

/// Hide the overlay window
#[tauri::command]
pub async fn hide_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        return Err("Overlay window not found".to_string());
    }
    Ok(())
}

/// Close the overlay window
#[tauri::command]
pub async fn close_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.close().map_err(|e| e.to_string())?;
    } else {
        return Err("Overlay window not found".to_string());
    }
    Ok(())
}

/// Set overlay window opacity (0.0 to 1.0)
#[tauri::command]
pub async fn set_overlay_opacity(app: AppHandle, opacity: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let clamped_opacity = opacity.clamp(0.0, 1.0);
        window.set_opacity(clamped_opacity).map_err(|e| e.to_string())?;
    } else {
        return Err("Overlay window not found".to_string());
    }
    Ok(())
}

/// Check if overlay window is visible
#[tauri::command]
pub async fn is_overlay_visible(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}

/// Get currently running fullscreen applications
#[tauri::command]
pub async fn detect_fullscreen_apps() -> Result<Vec<String>, String> {
    // This is a simplified implementation
    // In a real application, you'd want to use platform-specific APIs
    // to detect actual fullscreen applications

    #[cfg(target_os = "windows")]
    {
        // Windows-specific fullscreen detection would go here
        // For now, return empty list
        Ok(vec![])
    }

    #[cfg(target_os = "macos")]
    {
        // macOS-specific fullscreen detection would go here
        // For now, return empty list
        Ok(vec![])
    }

    #[cfg(target_os = "linux")]
    {
        // Linux-specific fullscreen detection would go here
        // For now, return empty list
        Ok(vec![])
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(vec![])
    }
}

/// Move overlay to position
#[tauri::command]
pub async fn move_overlay(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 }))
            .map_err(|e| e.to_string())?;
    } else {
        return Err("Overlay window not found".to_string());
    }
    Ok(())
}

/// Get overlay window position
#[tauri::command]
pub async fn get_overlay_position(app: AppHandle) -> Result<Option<(f64, f64)>, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        match window.outer_position() {
            Ok(position) => Ok(Some((position.x as f64, position.y as f64))),
            Err(e) => Err(e.to_string()),
        }
    } else {
        Ok(None)
    }
}
use tauri::{Manager, Window, AppHandle};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Get the application version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Minimize the window
#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Maximize/restore the window
#[tauri::command]
pub async fn toggle_maximize(window: Window) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

/// Close the window
#[tauri::command]
pub async fn close_window(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Hide the window
#[tauri::command]
pub async fn hide_window(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

/// Show and focus the window
#[tauri::command]
pub async fn show_window(window: Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

/// Check if window is visible
#[tauri::command]
pub async fn is_window_visible(window: Window) -> Result<bool, String> {
    window.is_visible().map_err(|e| e.to_string())
}

/// Set window always on top
#[tauri::command]
pub async fn set_always_on_top(window: Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

/// Toggle fullscreen
#[tauri::command]
pub async fn toggle_fullscreen(window: Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())
}

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
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
pub async fn set_badge_count(app: AppHandle, count: u32) -> Result<(), String> {
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

/// Get auto-start status
#[tauri::command]
pub fn is_auto_start_enabled(app: AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// Enable auto-start
#[tauri::command]
pub fn enable_auto_start(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().enable().map_err(|e| e.to_string())
}

/// Disable auto-start
#[tauri::command]
pub fn disable_auto_start(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().disable().map_err(|e| e.to_string())
}

// ============================================================================
// Clipboard Commands
// ============================================================================

/// Copy text to the system clipboard
#[tauri::command]
pub async fn clipboard_write_text(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(&text)
        .map_err(|e| e.to_string())
}

/// Read text from the system clipboard
#[tauri::command]
pub async fn clipboard_read_text(app: AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| e.to_string())
}

/// Check if clipboard has text content
#[tauri::command]
pub async fn clipboard_has_text(app: AppHandle) -> Result<bool, String> {
    match app.clipboard().read_text() {
        Ok(text) => Ok(!text.is_empty()),
        Err(_) => Ok(false),
    }
}

/// Clear the clipboard
#[tauri::command]
pub async fn clipboard_clear(app: AppHandle) -> Result<(), String> {
    app.clipboard()
        .write_text("")
        .map_err(|e| e.to_string())
}

// ============================================================================
// Quick Mute Commands
// ============================================================================

use std::sync::atomic::{AtomicBool, Ordering};

static NOTIFICATIONS_MUTED: AtomicBool = AtomicBool::new(false);

/// Toggle notification mute state
#[tauri::command]
pub fn toggle_mute() -> Result<bool, String> {
    let current = NOTIFICATIONS_MUTED.load(Ordering::Relaxed);
    let new_state = !current;
    NOTIFICATIONS_MUTED.store(new_state, Ordering::Relaxed);
    Ok(new_state)
}

/// Get current mute state
#[tauri::command]
pub fn is_muted() -> Result<bool, String> {
    Ok(NOTIFICATIONS_MUTED.load(Ordering::Relaxed))
}

/// Set mute state explicitly
#[tauri::command]
pub fn set_mute(muted: bool) -> Result<bool, String> {
    NOTIFICATIONS_MUTED.store(muted, Ordering::Relaxed);
    Ok(muted)
}

// ============================================================================
// Tray Badge Commands
// ============================================================================

/// Update the tray icon with unread message count
#[tauri::command]
pub fn update_tray_badge(app: AppHandle, count: u32) -> Result<(), String> {
    crate::tray::set_unread_count(&app, count).map_err(|e| e.to_string())
}

/// Get current unread count from tray
#[tauri::command]
pub fn get_tray_badge() -> u32 {
    crate::tray::get_unread_count()
}

// ============================================================================
// Focus Mode Commands
// ============================================================================

static FOCUS_MODE_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Toggle focus mode state
#[tauri::command]
pub fn toggle_focus_mode() -> Result<bool, String> {
    let current = FOCUS_MODE_ACTIVE.load(Ordering::Relaxed);
    let new_state = !current;
    FOCUS_MODE_ACTIVE.store(new_state, Ordering::Relaxed);
    Ok(new_state)
}

/// Get current focus mode state
#[tauri::command]
pub fn is_focus_mode_active() -> Result<bool, String> {
    Ok(FOCUS_MODE_ACTIVE.load(Ordering::Relaxed))
}

/// Set focus mode state explicitly
#[tauri::command]
pub fn set_focus_mode(active: bool) -> Result<bool, String> {
    FOCUS_MODE_ACTIVE.store(active, Ordering::Relaxed);
    Ok(active)
}

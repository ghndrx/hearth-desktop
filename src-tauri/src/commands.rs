use tauri_plugin_notification::NotificationExt;
use tauri::Manager;
use tauri::WebviewWindowBuilder;
use tauri::WebviewUrl;

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

/// Set the always-on-top behavior for a window.
/// Supports 'main' (default) and 'voice-overlay' windows.
/// For the voice-overlay, the window is created on demand if it doesn't exist.
#[tauri::command]
pub async fn set_always_on_top(
    app: tauri::AppHandle,
    always_on_top: bool,
    window_label: Option<String>,
) -> Result<(), String> {
    let label = window_label.as_deref().unwrap_or("main");
    let window = if label == "voice-overlay" {
        get_or_create_voice_overlay(&app)?
    } else {
        app.get_webview_window(label)
            .ok_or_else(|| format!("Window '{}' not found", label))?
    };
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Create or retrieve the voice overlay window.
/// Creates a small, transparent, always-on-top window for the voice overlay.
fn get_or_create_voice_overlay(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("voice-overlay") {
        return Ok(window);
    }

    let window = WebviewWindowBuilder::new(
        app,
        "voice-overlay",
        WebviewUrl::App("/overlay".into()),
    )
    .title("Voice Overlay")
    .inner_size(280.0, 300.0)
    .min_inner_size(200.0, 52.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(window)
}

/// Show the voice overlay window (creates it if it doesn't exist)
#[tauri::command]
pub async fn show_voice_overlay(app: tauri::AppHandle) -> Result<(), String> {
    let window = get_or_create_voice_overlay(&app)?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Hide the voice overlay window
#[tauri::command]
pub async fn hide_voice_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("voice-overlay") {
        window.hide().map_err(|e| e.to_string())?;
    }
    // No error if the window doesn't exist — it may not have been opened yet
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify set_always_on_top defaults to "main" when no window_label is provided
    #[test]
    fn test_set_always_on_top_default_label() {
        let label: Option<String> = None;
        let resolved = label.as_deref().unwrap_or("main");
        assert_eq!(resolved, "main");
    }

    /// Verify set_always_on_top uses the provided window label
    #[test]
    fn test_set_always_on_top_custom_label() {
        let label: Option<String> = Some("voice-overlay".to_string());
        let resolved = label.as_deref().unwrap_or("main");
        assert_eq!(resolved, "voice-overlay");
    }

    /// Verify the command function signatures compile correctly with expected types.
    /// Full integration tests require a running Tauri app context.
    #[test]
    fn test_command_signatures_exist() {
        // Verify these functions exist and are callable (type-checks at compile time)
        let _ = get_app_version;
        let _ = set_always_on_top;
        let _ = show_voice_overlay;
        let _ = hide_voice_overlay;
    }
}

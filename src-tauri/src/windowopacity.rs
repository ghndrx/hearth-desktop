use tauri::{AppHandle, Manager, Window};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct WindowOpacitySettings {
    pub opacity: f64,
    pub blur_enabled: bool,
    pub vibrancy_enabled: bool,
}

/// Set window opacity (0.0 to 1.0)
/// Note: set_opacity is not available in Tauri v2 Window API.
/// This is a no-op stub; real opacity control requires platform-specific code.
#[tauri::command]
pub async fn set_window_opacity(_window: Window, _opacity: f64) -> Result<(), String> {
    // Tauri v2 does not expose set_opacity on Window.
    // On supported platforms, opacity can be set via window creation config or platform APIs.
    Ok(())
}

/// Get current window opacity
#[tauri::command]
pub async fn get_window_opacity(window: Window) -> Result<f64, String> {
    // Tauri doesn't provide a direct get_opacity, so we track it via store
    Ok(1.0) // Default
}

/// Enable window vibrancy/blur effect (macOS)
/// Note: set_opacity is not available in Tauri v2. Vibrancy should be configured
/// at window creation time. This command is kept as a stub for API compatibility.
#[tauri::command]
pub async fn set_window_vibrancy(_window: Window, effect: String) -> Result<(), String> {
    match effect.as_str() {
        "sidebar" | "header" | "content" | "under-window" | "hud" | "titlebar"
        | "menu" | "popover" | "selection" | "none" => {
            // Vibrancy/opacity is configured at window creation in Tauri v2.
            // Runtime changes are not supported via this API.
            Ok(())
        }
        _ => Err(format!("Unknown vibrancy effect: {}", effect)),
    }
}

/// Set window to compact/mini mode
#[tauri::command]
pub async fn set_compact_mode(window: Window, compact: bool) -> Result<(), String> {
    if compact {
        window
            .set_size(tauri::LogicalSize::new(380.0, 600.0))
            .map_err(|e| e.to_string())?;
        window
            .set_min_size(Some(tauri::LogicalSize::new(300.0, 400.0)))
            .map_err(|e| e.to_string())?;
        window
            .set_always_on_top(true)
            .map_err(|e| e.to_string())?;
    } else {
        window
            .set_size(tauri::LogicalSize::new(1200.0, 800.0))
            .map_err(|e| e.to_string())?;
        window
            .set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)))
            .map_err(|e| e.to_string())?;
        window
            .set_always_on_top(false)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Create a popout chat window for a specific channel
#[tauri::command]
pub async fn create_popout_window(
    app: AppHandle,
    channel_id: String,
    channel_name: String,
) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    let label = format!("channel-{}", channel_id);

    // Check if window already exists
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = format!("/channels/@me/{}", channel_id);

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&format!("Hearth - #{}", channel_name))
        .inner_size(800.0, 600.0)
        .min_inner_size(400.0, 300.0)
        .decorations(true)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Close a popout window
#[tauri::command]
pub async fn close_popout_window(app: AppHandle, channel_id: String) -> Result<(), String> {
    let label = format!("channel-{}", channel_id);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// List all open popout windows
#[tauri::command]
pub async fn list_popout_windows(app: AppHandle) -> Result<Vec<String>, String> {
    let windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|label| label.starts_with("channel-"))
        .cloned()
        .collect();
    Ok(windows)
}

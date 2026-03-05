use tauri::{AppHandle, Manager, Window};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct WindowOpacitySettings {
    pub opacity: f64,
    pub blur_enabled: bool,
    pub vibrancy_enabled: bool,
}

/// Set window opacity (0.0 to 1.0)
#[tauri::command]
pub async fn set_window_opacity(window: Window, opacity: f64) -> Result<(), String> {
    let clamped = opacity.clamp(0.1, 1.0);
    window.set_opacity(clamped).map_err(|e| e.to_string())
}

/// Get current window opacity
#[tauri::command]
pub async fn get_window_opacity(window: Window) -> Result<f64, String> {
    // Tauri doesn't provide a direct get_opacity, so we track it via store
    Ok(1.0) // Default
}

/// Enable window vibrancy/blur effect (macOS)
#[tauri::command]
pub async fn set_window_vibrancy(window: Window, effect: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::utils::TitleBarStyle;
        // macOS vibrancy effects
        match effect.as_str() {
            "sidebar" | "header" | "content" | "under-window" | "hud" | "titlebar"
            | "menu" | "popover" | "selection" => {
                // Vibrancy is set through window configuration in Tauri 2
                // For runtime changes, we adjust opacity to simulate the effect
                window.set_opacity(0.92).map_err(|e| e.to_string())?;
            }
            "none" => {
                window.set_opacity(1.0).map_err(|e| e.to_string())?;
            }
            _ => return Err(format!("Unknown vibrancy effect: {}", effect)),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On Windows/Linux, simulate with opacity
        match effect.as_str() {
            "none" => window.set_opacity(1.0).map_err(|e| e.to_string())?,
            _ => window.set_opacity(0.95).map_err(|e| e.to_string())?,
        }
    }

    Ok(())
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

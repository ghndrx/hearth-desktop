use tauri_plugin_notification::NotificationExt;
use tauri::{Manager, WebviewWindow, WebviewWindowBuilder};

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

/// Create or show the picture-in-picture voice overlay window
#[tauri::command]
pub async fn create_pip_window(app: tauri::AppHandle) -> Result<(), String> {
    // Check if PiP window already exists
    if let Some(window) = app.get_webview_window("pip") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create new PiP window
    let _window = WebviewWindowBuilder::new(&app, "pip", tauri::WebviewUrl::App("/pip".into()))
        .title("Voice Channel")
        .inner_size(300.0, 200.0)
        .min_inner_size(250.0, 150.0)
        .max_inner_size(400.0, 300.0)
        .resizable(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .transparent(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Close the picture-in-picture voice overlay window
#[tauri::command]
pub async fn close_pip_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pip") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Toggle the picture-in-picture voice overlay window
#[tauri::command]
pub async fn toggle_pip_window(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("pip") {
        if window.is_visible().map_err(|e| e.to_string())? {
            window.hide().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            Ok(true)
        }
    } else {
        // Create window if it doesn't exist
        create_pip_window(app).await?;
        Ok(true)
    }
}

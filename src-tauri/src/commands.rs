use tauri_plugin_notification::NotificationExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

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

/// Register a global shortcut
#[tauri::command]
pub async fn register_global_shortcut(
    app: tauri::AppHandle,
    accelerator: String,
    id: String,
) -> Result<(), String> {
    let shortcut = accelerator.parse::<Shortcut>().map_err(|e| e.to_string())?;

    app.global_shortcut()
        .register(shortcut)
        .map_err(|e| e.to_string())?;

    println!("Registered global shortcut: {} with id: {}", accelerator, id);
    Ok(())
}

/// Unregister a global shortcut
#[tauri::command]
pub async fn unregister_global_shortcut(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<(), String> {
    let shortcut = accelerator.parse::<Shortcut>().map_err(|e| e.to_string())?;

    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|e| e.to_string())?;

    println!("Unregistered global shortcut: {}", accelerator);
    Ok(())
}

/// Check if a global shortcut is registered
#[tauri::command]
pub async fn is_global_shortcut_registered(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<bool, String> {
    let shortcut = accelerator.parse::<Shortcut>().map_err(|e| e.to_string())?;

    let is_registered = app.global_shortcut()
        .is_registered(shortcut)
        .map_err(|e| e.to_string())?;

    Ok(is_registered)
}

/// Unregister all global shortcuts
#[tauri::command]
pub async fn unregister_all_global_shortcuts(app: tauri::AppHandle) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())?;

    println!("Unregistered all global shortcuts");
    Ok(())
}

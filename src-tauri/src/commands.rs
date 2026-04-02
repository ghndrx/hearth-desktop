use tauri::Emitter;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_notification::NotificationExt;

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

/// Register a global shortcut for Push-to-Talk (PTT)
#[tauri::command]
pub async fn register_ptt_shortcut(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<(), String> {
    app.global_shortcut()
        .register(&accelerator, move |_app, _shortcut| {
            // Emit PTT press event to frontend
            if let Err(e) = _app.emit("ptt-pressed", ()) {
                eprintln!("Failed to emit ptt-pressed event: {}", e);
            }
        })
        .map_err(|e| format!("Failed to register PTT shortcut '{}': {}", accelerator, e))?;

    Ok(())
}

/// Unregister a global shortcut
#[tauri::command]
pub async fn unregister_global_shortcut(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<(), String> {
    app.global_shortcut()
        .unregister(&accelerator)
        .map_err(|e| format!("Failed to unregister shortcut '{}': {}", accelerator, e))?;

    Ok(())
}

/// Check if a global shortcut is registered
#[tauri::command]
pub async fn is_global_shortcut_registered(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<bool, String> {
    app.global_shortcut()
        .is_registered(&accelerator)
        .map_err(|e| format!("Failed to check shortcut '{}': {}", accelerator, e))
}

/// Unregister all global shortcuts
#[tauri::command]
pub async fn unregister_all_global_shortcuts(
    app: tauri::AppHandle,
) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| format!("Failed to unregister all shortcuts: {}", e))?;

    Ok(())
}

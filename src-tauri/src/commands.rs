use tauri_plugin_notification::NotificationExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

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

/// Register a global hotkey shortcut (T-HOTKEY-02)
#[tauri::command]
pub async fn register_hotkey(
    app: tauri::AppHandle,
    id: String,
    shortcut: String,
) -> Result<(), String> {
    let shortcut: Shortcut = shortcut
        .parse()
        .map_err(|e: tauri_plugin_global_shortcut::Error| e.to_string())?;

    let app_handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _scut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app_handle.emit("hotkey-triggered", serde_json::json!({
                    "id": id,
                    "shortcut": _scut.to_string(),
                }));
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Unregister a specific global hotkey by its shortcut string
#[tauri::command]
pub async fn unregister_hotkey(
    app: tauri::AppHandle,
    shortcut: String,
) -> Result<(), String> {
    let shortcut: Shortcut = shortcut
        .parse()
        .map_err(|e: tauri_plugin_global_shortcut::Error| e.to_string())?;

    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Unregister all registered global hotkeys
#[tauri::command]
pub async fn unregister_all_hotkeys(app: tauri::AppHandle) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Check if a specific hotkey shortcut is currently registered
#[tauri::command]
pub async fn is_hotkey_registered(
    app: tauri::AppHandle,
    shortcut: String,
) -> Result<bool, String> {
    let shortcut: Shortcut = shortcut
        .parse()
        .map_err(|e: tauri_plugin_global_shortcut::Error| e.to_string())?;

    app.global_shortcut()
        .is_registered(&shortcut)
        .map_err(|e| e.to_string())
}

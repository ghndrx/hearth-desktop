use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
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
pub async fn set_badge_count(_app: tauri::AppHandle, _count: u32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(window) = _app.get_webview_window("main") {
            if _count > 0 {
                window.set_badge_count(Some(_count as i64)).map_err(|e| e.to_string())?;
            } else {
                window.set_badge_count(None).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

fn parse_shortcut(accelerator: &str) -> Result<Shortcut, String> {
    accelerator
        .parse::<Shortcut>()
        .map_err(|e| format!("Invalid shortcut '{}': {}", accelerator, e))
}

/// Register a global shortcut for Push-to-Talk (PTT).
/// The handler is configured at plugin init in main.rs and emits "ptt-pressed" events.
#[tauri::command]
pub async fn register_ptt_shortcut(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<(), String> {
    let shortcut = parse_shortcut(&accelerator)?;
    let gs = app.global_shortcut();

    // Unregister first if already registered
    if gs.is_registered(shortcut) {
        gs.unregister(shortcut)
            .map_err(|e| format!("Failed to unregister existing shortcut: {}", e))?;
    }

    gs.on_shortcut(shortcut, {
        let app = app.clone();
        move |_app_handle, _shortcut, event| {
            if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                use tauri::Emitter;
                let _ = app.emit("ptt-pressed", ());
            }
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
    let shortcut = parse_shortcut(&accelerator)?;
    let gs = app.global_shortcut();

    if gs.is_registered(shortcut) {
        gs.unregister(shortcut)
            .map_err(|e| format!("Failed to unregister shortcut '{}': {}", accelerator, e))?;
    }

    Ok(())
}

/// Check if a global shortcut is registered
#[tauri::command]
pub async fn is_global_shortcut_registered(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<bool, String> {
    let shortcut = parse_shortcut(&accelerator)?;
    Ok(app.global_shortcut().is_registered(shortcut))
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

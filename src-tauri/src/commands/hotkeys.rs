//! Global hotkey registration via `tauri-plugin-global-shortcut`.
//!
//! Note: `rdev` is included for low-level raw input hooks (future use).
//! On Linux, `rdev` requires `libxdo-dev` / `xdotool` system dependency.

use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Stores registered hotkey callbacks by shortcut string.
static HOTKEY_REGISTRY: std::sync::OnceLock<HashMap<String, Box<dyn Fn() + Send + Sync>>> =
    std::sync::OnceLock::new();

fn registry() -> &'static HashMap<String, Box<dyn Fn() + Send + Sync>> {
    HOTKEY_REGISTRY.get_or_init(HashMap::new)
}

/// Register a global hotkey with the app.
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `shortcut` - Hotkey string (e.g., "CommandOrControl+Shift+P")
/// * `callback_id` - An identifier for the callback to invoke when the hotkey fires
///
/// Returns Ok(()) on success, or an error string on failure.
#[tauri::command]
pub async fn register_hotkey(
    app: AppHandle,
    shortcut: String,
    callback_id: String,
) -> Result<(), String> {
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("Failed to parse shortcut '{}': {}", shortcut, e))?;

    // Clone for the callback closure
    let cb_id = callback_id.clone();

    app.global_shortcut()
        .on_shortcut(parsed, move |_app, _scut, event| {
            if event.state == ShortcutState::Pressed {
                // Emit event to the frontend with the callback_id
                if let Some(window) = _app.get_webview_window("main") {
                    let _: Result<(), _> = window.emit("hotkey-triggered", &cb_id);
                }
            }
        })
        .map_err(|e| format!("Failed to register shortcut '{}': {}", shortcut, e))?;

    Ok(())
}

/// Unregister a global hotkey from the app.
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `shortcut` - Hotkey string to unregister (e.g., "CommandOrControl+Shift+P")
///
/// Returns Ok(()) on success, or an error string on failure.
#[tauri::command]
pub async fn unregister_hotkey(app: AppHandle, shortcut: String) -> Result<(), String> {
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("Failed to parse shortcut '{}': {}", shortcut, e))?;

    app.global_shortcut()
        .unregister(parsed)
        .map_err(|e| format!("Failed to unregister shortcut '{}': {}", shortcut, e))?;

    Ok(())
}

/// Unregister all global shortcuts.
#[tauri::command]
pub async fn unregister_all_hotkeys(app: AppHandle) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| format!("Failed to unregister all shortcuts: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shortcut_parsing() {
        // Valid shortcuts should parse without error
        assert!("CommandOrControl+Shift+P".parse::<Shortcut>().is_ok());
        assert!("CommandOrControl+Shift+Space".parse::<Shortcut>().is_ok());
        assert!("Alt+Tab".parse::<Shortcut>().is_ok());
    }
}

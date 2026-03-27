use tauri_plugin_notification::NotificationExt;
use global_hotkey::{GlobalHotKeyManager, GlobalHotKeyEvent, hotkey::{HotKey, Modifiers, Code}};
use std::collections::HashMap;
use std::sync::Mutex;

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

// Global state to store hotkeys and manager
lazy_static::lazy_static! {
    static ref HOTKEY_MANAGER: Mutex<Option<GlobalHotKeyManager>> = Mutex::new(None);
    static ref REGISTERED_HOTKEYS: Mutex<HashMap<String, HotKey>> = Mutex::new(HashMap::new());
}

/// Parse accelerator string to HotKey
fn parse_accelerator(accelerator: &str) -> Result<HotKey, String> {
    let parts: Vec<&str> = accelerator.split('+').collect();
    if parts.is_empty() {
        return Err("Empty accelerator".to_string());
    }

    let mut modifiers = Modifiers::empty();
    let mut code = None;

    for part in parts {
        let part = part.trim();
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            "super" | "cmd" | "meta" => modifiers |= Modifiers::SUPER,
            "cmdorctrl" | "cmdorcontrol" => {
                #[cfg(target_os = "macos")]
                { modifiers |= Modifiers::SUPER; }
                #[cfg(not(target_os = "macos"))]
                { modifiers |= Modifiers::CONTROL; }
            }
            key => {
                code = Some(match key {
                    "space" => Code::Space,
                    "enter" | "return" => Code::Enter,
                    "tab" => Code::Tab,
                    "escape" | "esc" => Code::Escape,
                    "f1" => Code::F1,
                    "f2" => Code::F2,
                    "f3" => Code::F3,
                    "f4" => Code::F4,
                    "f5" => Code::F5,
                    "f6" => Code::F6,
                    "f7" => Code::F7,
                    "f8" => Code::F8,
                    "f9" => Code::F9,
                    "f10" => Code::F10,
                    "f11" => Code::F11,
                    "f12" => Code::F12,
                    "a" => Code::KeyA,
                    "b" => Code::KeyB,
                    "c" => Code::KeyC,
                    "d" => Code::KeyD,
                    "e" => Code::KeyE,
                    "f" => Code::KeyF,
                    "g" => Code::KeyG,
                    "h" => Code::KeyH,
                    "i" => Code::KeyI,
                    "j" => Code::KeyJ,
                    "k" => Code::KeyK,
                    "l" => Code::KeyL,
                    "m" => Code::KeyM,
                    "n" => Code::KeyN,
                    "o" => Code::KeyO,
                    "p" => Code::KeyP,
                    "q" => Code::KeyQ,
                    "r" => Code::KeyR,
                    "s" => Code::KeyS,
                    "t" => Code::KeyT,
                    "u" => Code::KeyU,
                    "v" => Code::KeyV,
                    "w" => Code::KeyW,
                    "x" => Code::KeyX,
                    "y" => Code::KeyY,
                    "z" => Code::KeyZ,
                    _ => return Err(format!("Unknown key: {}", key)),
                });
            }
        }
    }

    if let Some(code) = code {
        Ok(HotKey::new(Some(modifiers), code))
    } else {
        Err("No key specified".to_string())
    }
}

/// Initialize the global hotkey manager
#[tauri::command]
pub async fn init_hotkey_manager() -> Result<(), String> {
    let mut manager_guard = HOTKEY_MANAGER.lock().map_err(|e| e.to_string())?;
    if manager_guard.is_none() {
        let manager = GlobalHotKeyManager::new().map_err(|e| e.to_string())?;
        *manager_guard = Some(manager);
    }
    Ok(())
}

/// Register a global hotkey
#[tauri::command]
pub async fn register_hotkey(
    hotkey_id: String,
    accelerator: String,
) -> Result<(), String> {
    // Parse the accelerator
    let hotkey = parse_accelerator(&accelerator)?;

    // Get the manager
    let mut manager_guard = HOTKEY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = manager_guard.as_mut().ok_or("Hotkey manager not initialized")?;

    // Register the hotkey
    manager.register(hotkey).map_err(|e| e.to_string())?;

    // Store in our registry
    let mut hotkeys = REGISTERED_HOTKEYS.lock().map_err(|e| e.to_string())?;
    hotkeys.insert(hotkey_id, hotkey);

    Ok(())
}

/// Unregister a global hotkey
#[tauri::command]
pub async fn unregister_hotkey(
    hotkey_id: String,
) -> Result<(), String> {
    // Get the hotkey
    let mut hotkeys = REGISTERED_HOTKEYS.lock().map_err(|e| e.to_string())?;
    let hotkey = hotkeys.remove(&hotkey_id).ok_or("Hotkey not found")?;

    // Get the manager and unregister
    let mut manager_guard = HOTKEY_MANAGER.lock().map_err(|e| e.to_string())?;
    let manager = manager_guard.as_mut().ok_or("Hotkey manager not initialized")?;

    manager.unregister(hotkey).map_err(|e| e.to_string())?;

    Ok(())
}

/// Check if a hotkey is registered
#[tauri::command]
pub async fn is_hotkey_registered(
    hotkey_id: String,
) -> Result<bool, String> {
    let hotkeys = REGISTERED_HOTKEYS.lock().map_err(|e| e.to_string())?;
    Ok(hotkeys.contains_key(&hotkey_id))
}

/// Get all registered hotkeys
#[tauri::command]
pub async fn get_registered_hotkeys() -> Result<Vec<String>, String> {
    let hotkeys = REGISTERED_HOTKEYS.lock().map_err(|e| e.to_string())?;
    Ok(hotkeys.keys().cloned().collect())
}

/// Enumerate available screen/camera capture sources
#[tauri::command]
pub async fn enumerate_sources() -> Result<Vec<String>, String> {
    // Stub: return empty list for now; will be wired to nokhwa in a follow-up task
    Ok(Vec::new())
}

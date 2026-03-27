use tauri_plugin_notification::NotificationExt;
use std::sync::Mutex;
use crate::game_detection::{GameDetectionEngine, GameDetectionResult};

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

// Global game detection engine instance
static GAME_ENGINE: Mutex<Option<GameDetectionEngine>> = Mutex::new(None);

/// Initialize the game detection engine
#[tauri::command]
pub fn init_game_detection() -> Result<(), String> {
    let mut engine = GAME_ENGINE.lock().map_err(|e| e.to_string())?;
    *engine = Some(GameDetectionEngine::new());
    Ok(())
}

/// Scan for currently running games
#[tauri::command]
pub fn scan_for_games() -> Result<GameDetectionResult, String> {
    let mut engine_guard = GAME_ENGINE.lock().map_err(|e| e.to_string())?;

    // Initialize engine if not already done
    if engine_guard.is_none() {
        *engine_guard = Some(GameDetectionEngine::new());
    }

    if let Some(ref mut engine) = engine_guard.as_mut() {
        Ok(engine.scan_for_games())
    } else {
        Err("Game detection engine not initialized".to_string())
    }
}

/// Check if user is currently gaming
#[tauri::command]
pub fn is_gaming() -> Result<bool, String> {
    let result = scan_for_games()?;
    Ok(result.is_gaming)
}

/// Get the list of currently detected games
#[tauri::command]
pub fn get_detected_games() -> Result<Vec<crate::game_detection::DetectedGame>, String> {
    let result = scan_for_games()?;
    Ok(result.detected_games)
}

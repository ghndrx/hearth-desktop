//! Privacy mode module for Hearth Desktop
//! 
//! Provides a "boss key" feature that quickly obscures window content
//! when activated. Can be triggered via keyboard shortcut or tray menu.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// Global privacy mode state
static PRIVACY_MODE_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Check if privacy mode is currently active
#[tauri::command]
pub fn is_privacy_mode_active() -> bool {
    PRIVACY_MODE_ACTIVE.load(Ordering::Relaxed)
}

/// Set privacy mode state
#[tauri::command]
pub fn set_privacy_mode<R: Runtime>(app: AppHandle<R>, active: bool) -> Result<(), String> {
    let previous = PRIVACY_MODE_ACTIVE.swap(active, Ordering::Relaxed);
    
    // Only emit event if state actually changed
    if previous != active {
        // Emit event to all windows
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("privacy-mode-changed", serde_json::json!({
                "active": active
            }));
        }
        
        // Update tray tooltip to indicate privacy mode
        if let Some(tray) = app.tray_by_id("main") {
            let tooltip = if active {
                "Hearth (Privacy Mode)"
            } else {
                "Hearth"
            };
            let _ = tray.set_tooltip(Some(tooltip));
        }
        
        // Log state change for debugging
        #[cfg(debug_assertions)]
        {
            if active {
                println!("[Hearth] Privacy mode activated");
            } else {
                println!("[Hearth] Privacy mode deactivated");
            }
        }
    }
    
    Ok(())
}

/// Toggle privacy mode and return the new state
#[tauri::command]
pub fn toggle_privacy_mode<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    let new_state = !PRIVACY_MODE_ACTIVE.load(Ordering::Relaxed);
    set_privacy_mode(app, new_state)?;
    Ok(new_state)
}

/// Emit a toggle event to the frontend (for use from tray menu)
pub fn emit_privacy_toggle<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("privacy-mode-toggle", ());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_privacy_mode_state() {
        // Reset state
        PRIVACY_MODE_ACTIVE.store(false, Ordering::Relaxed);
        
        assert!(!is_privacy_mode_active());
        
        PRIVACY_MODE_ACTIVE.store(true, Ordering::Relaxed);
        assert!(is_privacy_mode_active());
        
        // Reset for other tests
        PRIVACY_MODE_ACTIVE.store(false, Ordering::Relaxed);
    }
}

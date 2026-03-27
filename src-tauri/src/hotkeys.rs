use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState, ShortcutEvent};

pub struct HotkeyState {
    shortcuts: Mutex<HashMap<String, Shortcut>>,
}

impl Default for HotkeyState {
    fn default() -> Self {
        Self {
            shortcuts: Mutex::new(HashMap::new()),
        }
    }
}

fn parse_shortcut(keys: &str) -> Result<Shortcut, String> {
    keys.parse().map_err(|e| format!("Failed to parse shortcut '{}': {}", keys, e))
}

/// Register a global hotkey
#[tauri::command]
pub async fn register_hotkey(
    app: AppHandle,
    action: String,
    keys: String,
) -> Result<(), String> {
    let shortcut = parse_shortcut(&keys)?;
    
    let state = app.state::<HotkeyState>();
    
    // Unregister existing shortcut for this action if any
    {
        let mut shortcuts = state.shortcuts.lock().map_err(|e| e.to_string())?;
        if let Some(existing) = shortcuts.remove(&action) {
            app.global_shortcut().unregister(existing)
                .map_err(|e| e.to_string())?;
        }
    }
    
    // Clone for the closure
    let action_name = action.clone();
    let app_handle = app.clone();
    
    // Register with callback
    app.global_shortcut()
        .on_shortcut(shortcut.clone(), move |_app: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent| {
            if event.state == ShortcutState::Pressed {
                let _ = app_handle.emit(&action_name, ());
            }
        })
        .map_err(|e| e.to_string())?;
    
    // Store it
    {
        let mut shortcuts = state.shortcuts.lock().map_err(|e| e.to_string())?;
        shortcuts.insert(action.clone(), shortcut);
    }
    
    Ok(())
}

/// Unregister a global hotkey
#[tauri::command]
pub async fn unregister_hotkey(
    app: AppHandle,
    action: String,
) -> Result<(), String> {
    let state = app.state::<HotkeyState>();
    
    let mut shortcuts = state.shortcuts.lock().map_err(|e| e.to_string())?;
    
    if let Some(shortcut) = shortcuts.remove(&action) {
        app.global_shortcut()
            .unregister(shortcut)
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// Initialize the global hotkey state
pub fn init_state(app: &AppHandle) {
    app.manage(HotkeyState::default());
}

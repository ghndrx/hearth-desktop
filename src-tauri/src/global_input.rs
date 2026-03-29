use rdev::{listen, Event, EventType, Key};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputEvent {
    pub event_type: String,
    pub key: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalShortcut {
    pub keys: Vec<String>,
    pub action: String,
}

static INPUT_MONITOR_RUNNING: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));

/// Register a global shortcut
#[tauri::command]
pub async fn register_global_shortcut(
    app: AppHandle,
    keys: Vec<String>,
    action: String,
) -> Result<(), String> {
    println!("Registering global shortcut: {:?} -> {}", keys, action);

    // Store shortcut registration for future reference
    // In a real implementation, you'd want to persist these

    Ok(())
}

/// Unregister a global shortcut
#[tauri::command]
pub async fn unregister_global_shortcut(
    app: AppHandle,
    keys: Vec<String>,
) -> Result<(), String> {
    println!("Unregistering global shortcut: {:?}", keys);

    Ok(())
}

/// Start global input monitoring
#[tauri::command]
pub async fn start_input_monitoring(app: AppHandle) -> Result<(), String> {
    let mut is_running = INPUT_MONITOR_RUNNING.lock().map_err(|e| e.to_string())?;

    if *is_running {
        return Err("Input monitoring is already running".to_string());
    }

    *is_running = true;

    let app_handle = app.clone();
    thread::spawn(move || {
        if let Err(error) = listen(move |event| {
            // Check if monitoring should still be running
            if let Ok(running) = INPUT_MONITOR_RUNNING.lock() {
                if !*running {
                    return;
                }
            }

            let input_event = match event.event_type {
                EventType::KeyPress(key) => InputEvent {
                    event_type: "keypress".to_string(),
                    key: Some(format!("{:?}", key)),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                },
                EventType::KeyRelease(key) => InputEvent {
                    event_type: "keyrelease".to_string(),
                    key: Some(format!("{:?}", key)),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                },
                EventType::ButtonPress(_) => InputEvent {
                    event_type: "mousepress".to_string(),
                    key: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                },
                EventType::ButtonRelease(_) => InputEvent {
                    event_type: "mouserelease".to_string(),
                    key: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                },
                _ => return, // Ignore other events
            };

            // Emit event to frontend
            if let Err(e) = app_handle.emit("input-event", &input_event) {
                eprintln!("Failed to emit input event: {}", e);
            }
        }) {
            eprintln!("Error in input monitoring: {:?}", error);
        }
    });

    println!("Global input monitoring started");
    Ok(())
}

/// Stop global input monitoring
#[tauri::command]
pub async fn stop_input_monitoring() -> Result<(), String> {
    let mut is_running = INPUT_MONITOR_RUNNING.lock().map_err(|e| e.to_string())?;
    *is_running = false;

    println!("Global input monitoring stopped");
    Ok(())
}

/// Check if input monitoring is currently running
#[tauri::command]
pub async fn is_input_monitoring_active() -> Result<bool, String> {
    let is_running = INPUT_MONITOR_RUNNING.lock().map_err(|e| e.to_string())?;
    Ok(*is_running)
}

/// Get available key codes for shortcut configuration
#[tauri::command]
pub async fn get_available_keys() -> Result<Vec<String>, String> {
    let keys = vec![
        "KeyA", "KeyB", "KeyC", "KeyD", "KeyE", "KeyF", "KeyG", "KeyH",
        "KeyI", "KeyJ", "KeyK", "KeyL", "KeyM", "KeyN", "KeyO", "KeyP",
        "KeyQ", "KeyR", "KeyS", "KeyT", "KeyU", "KeyV", "KeyW", "KeyX",
        "KeyY", "KeyZ", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
        "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Space", "Enter",
        "Tab", "Escape", "Backspace", "Delete", "ArrowUp", "ArrowDown",
        "ArrowLeft", "ArrowRight", "F1", "F2", "F3", "F4", "F5", "F6",
        "F7", "F8", "F9", "F10", "F11", "F12", "ControlLeft", "ControlRight",
        "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight"
    ];

    Ok(keys.into_iter().map(String::from).collect())
}

pub fn setup_global_shortcuts(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    println!("Setting up global shortcuts system");

    // Initialize global shortcut system
    // Any default shortcuts can be registered here

    Ok(())
}
use rdev::{listen, Event, EventType, Key};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalShortcut {
    pub id: String,
    pub keys: Vec<String>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputEvent {
    pub event_type: String,
    pub key: Option<String>,
    pub timestamp: u64,
}

pub struct GlobalInputManager {
    shortcuts: Arc<Mutex<Vec<GlobalShortcut>>>,
    active_keys: Arc<Mutex<Vec<Key>>>,
    app_handle: Option<tauri::AppHandle>,
}

impl GlobalInputManager {
    pub fn new() -> Self {
        Self {
            shortcuts: Arc::new(Mutex::new(Vec::new())),
            active_keys: Arc::new(Mutex::new(Vec::new())),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, handle: tauri::AppHandle) {
        self.app_handle = Some(handle);
    }

    pub fn start_monitoring(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let shortcuts = Arc::clone(&self.shortcuts);
        let active_keys = Arc::clone(&self.active_keys);
        let app_handle = self.app_handle.clone();

        thread::spawn(move || {
            if let Err(error) = listen(move |event| {
                Self::handle_event(event, &shortcuts, &active_keys, &app_handle);
            }) {
                eprintln!("Error listening for global input events: {:?}", error);
            }
        });

        Ok(())
    }

    fn handle_event(
        event: Event,
        shortcuts: &Arc<Mutex<Vec<GlobalShortcut>>>,
        active_keys: &Arc<Mutex<Vec<Key>>>,
        app_handle: &Option<tauri::AppHandle>,
    ) {
        match event.event_type {
            EventType::KeyPress(key) => {
                // Track pressed keys for shortcut detection
                if let Ok(mut keys) = active_keys.lock() {
                    if !keys.contains(&key) {
                        keys.push(key);
                    }
                }

                // Check for shortcut matches
                Self::check_shortcuts(shortcuts, active_keys, app_handle);

                // Emit input event to frontend
                if let Some(handle) = app_handle {
                    let input_event = InputEvent {
                        event_type: "keypress".to_string(),
                        key: Some(format!("{:?}", key)),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                    };
                    let _ = handle.emit("global-input-event", &input_event);
                }
            }
            EventType::KeyRelease(key) => {
                // Remove released key from active keys
                if let Ok(mut keys) = active_keys.lock() {
                    keys.retain(|&k| k != key);
                }

                // Emit input event to frontend
                if let Some(handle) = app_handle {
                    let input_event = InputEvent {
                        event_type: "keyrelease".to_string(),
                        key: Some(format!("{:?}", key)),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                    };
                    let _ = handle.emit("global-input-event", &input_event);
                }
            }
            EventType::ButtonPress(_button) => {
                // Emit mouse button press event
                if let Some(handle) = app_handle {
                    let input_event = InputEvent {
                        event_type: "mousepress".to_string(),
                        key: None,
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                    };
                    let _ = handle.emit("global-input-event", &input_event);
                }
            }
            EventType::ButtonRelease(_button) => {
                // Emit mouse button release event
                if let Some(handle) = app_handle {
                    let input_event = InputEvent {
                        event_type: "mouserelease".to_string(),
                        key: None,
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                    };
                    let _ = handle.emit("global-input-event", &input_event);
                }
            }
            _ => {}
        }
    }

    fn check_shortcuts(
        shortcuts: &Arc<Mutex<Vec<GlobalShortcut>>>,
        active_keys: &Arc<Mutex<Vec<Key>>>,
        app_handle: &Option<tauri::AppHandle>,
    ) {
        if let (Ok(shortcuts_guard), Ok(keys_guard)) = (shortcuts.lock(), active_keys.lock()) {
            for shortcut in shortcuts_guard.iter() {
                if Self::is_shortcut_active(shortcut, &keys_guard) {
                    if let Some(handle) = app_handle {
                        let _ = handle.emit("global-shortcut-triggered", shortcut);
                    }
                }
            }
        }
    }

    fn is_shortcut_active(shortcut: &GlobalShortcut, active_keys: &[Key]) -> bool {
        // Simple implementation - check if all shortcut keys are currently pressed
        shortcut.keys.iter().all(|key_str| {
            active_keys.iter().any(|active_key| {
                format!("{:?}", active_key).to_lowercase() == key_str.to_lowercase()
            })
        })
    }

    pub fn register_shortcut(&self, shortcut: GlobalShortcut) -> Result<(), String> {
        if let Ok(mut shortcuts) = self.shortcuts.lock() {
            // Remove any existing shortcut with the same ID
            shortcuts.retain(|s| s.id != shortcut.id);
            shortcuts.push(shortcut);
            Ok(())
        } else {
            Err("Failed to acquire shortcuts lock".to_string())
        }
    }

    pub fn unregister_shortcut(&self, shortcut_id: &str) -> Result<(), String> {
        if let Ok(mut shortcuts) = self.shortcuts.lock() {
            let initial_len = shortcuts.len();
            shortcuts.retain(|s| s.id != shortcut_id);

            if shortcuts.len() < initial_len {
                Ok(())
            } else {
                Err(format!("Shortcut with ID '{}' not found", shortcut_id))
            }
        } else {
            Err("Failed to acquire shortcuts lock".to_string())
        }
    }

    pub fn get_shortcuts(&self) -> Result<Vec<GlobalShortcut>, String> {
        if let Ok(shortcuts) = self.shortcuts.lock() {
            Ok(shortcuts.clone())
        } else {
            Err("Failed to acquire shortcuts lock".to_string())
        }
    }
}
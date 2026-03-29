use std::collections::HashMap;
use std::sync::Mutex;
use global_hotkey::{GlobalHotKeyManager, HotKeyState, GlobalHotKeyEvent};
use global_hotkey::hotkey::{HotKey, Modifiers, Code};
use serde::{Deserialize, Serialize};
use tauri::{Manager, AppHandle, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub id: String,
    pub description: String,
    pub modifiers: Vec<String>,
    pub key: String,
    pub action: String,
    pub enabled: bool,
}

impl HotkeyConfig {
    pub fn to_hotkey(&self) -> Result<HotKey, String> {
        // Parse modifiers
        let mut modifiers = Modifiers::empty();
        for modifier in &self.modifiers {
            match modifier.to_lowercase().as_str() {
                "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
                "shift" => modifiers |= Modifiers::SHIFT,
                "alt" => modifiers |= Modifiers::ALT,
                "super" | "cmd" | "meta" => modifiers |= Modifiers::SUPER,
                _ => return Err(format!("Invalid modifier: {}", modifier)),
            }
        }

        // Parse key code
        let code = match self.key.to_lowercase().as_str() {
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
            "1" => Code::Digit1,
            "2" => Code::Digit2,
            "3" => Code::Digit3,
            "4" => Code::Digit4,
            "5" => Code::Digit5,
            "6" => Code::Digit6,
            "7" => Code::Digit7,
            "8" => Code::Digit8,
            "9" => Code::Digit9,
            "0" => Code::Digit0,
            "space" => Code::Space,
            "enter" => Code::Enter,
            "escape" => Code::Escape,
            "backspace" => Code::Backspace,
            "tab" => Code::Tab,
            "delete" => Code::Delete,
            "home" => Code::Home,
            "end" => Code::End,
            "pageup" => Code::PageUp,
            "pagedown" => Code::PageDown,
            "arrowleft" => Code::ArrowLeft,
            "arrowright" => Code::ArrowRight,
            "arrowup" => Code::ArrowUp,
            "arrowdown" => Code::ArrowDown,
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
            _ => return Err(format!("Invalid key: {}", self.key)),
        };

        Ok(HotKey::new(Some(modifiers), code))
    }
}

pub struct HotkeyManager {
    manager: GlobalHotKeyManager,
    registered_hotkeys: Mutex<HashMap<String, HotKey>>,
    hotkey_configs: Mutex<HashMap<String, HotkeyConfig>>,
}

impl HotkeyManager {
    pub fn new() -> Result<Self, String> {
        let manager = GlobalHotKeyManager::new()
            .map_err(|e| format!("Failed to create hotkey manager: {}", e))?;

        Ok(Self {
            manager,
            registered_hotkeys: Mutex::new(HashMap::new()),
            hotkey_configs: Mutex::new(HashMap::new()),
        })
    }

    pub fn register_hotkey(&self, config: HotkeyConfig) -> Result<(), String> {
        if !config.enabled {
            return Ok(());
        }

        let hotkey = config.to_hotkey()?;

        // Register with system
        self.manager
            .register(hotkey)
            .map_err(|e| format!("Failed to register hotkey: {}", e))?;

        // Store locally
        let mut registered = self.registered_hotkeys.lock().unwrap();
        let mut configs = self.hotkey_configs.lock().unwrap();

        registered.insert(config.id.clone(), hotkey);
        configs.insert(config.id.clone(), config);

        Ok(())
    }

    pub fn unregister_hotkey(&self, id: &str) -> Result<(), String> {
        let mut registered = self.registered_hotkeys.lock().unwrap();
        let mut configs = self.hotkey_configs.lock().unwrap();

        if let Some(hotkey) = registered.remove(id) {
            self.manager
                .unregister(hotkey)
                .map_err(|e| format!("Failed to unregister hotkey: {}", e))?;
        }

        configs.remove(id);
        Ok(())
    }

    pub fn update_hotkey(&self, config: HotkeyConfig) -> Result<(), String> {
        // Unregister old hotkey if it exists
        let _ = self.unregister_hotkey(&config.id);

        // Register new hotkey
        self.register_hotkey(config)
    }

    pub fn get_registered_hotkeys(&self) -> HashMap<String, HotkeyConfig> {
        self.hotkey_configs.lock().unwrap().clone()
    }

    pub fn handle_hotkey_event(&self, event: GlobalHotKeyEvent, app: &AppHandle) {
        if event.state() == HotKeyState::Pressed {
            let configs = self.hotkey_configs.lock().unwrap();
            let registered = self.registered_hotkeys.lock().unwrap();

            // Find which hotkey was triggered
            for (id, hotkey) in registered.iter() {
                if event.id() == hotkey.id() {
                    if let Some(config) = configs.get(id) {
                        self.execute_hotkey_action(config, app);
                    }
                    break;
                }
            }
        }
    }

    fn execute_hotkey_action(&self, config: &HotkeyConfig, app: &AppHandle) {
        match config.action.as_str() {
            "toggle_main_window" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = match window.is_visible() {
                        Ok(true) => window.hide(),
                        _ => window.show(),
                    };
                }
            },
            "show_main_window" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            },
            "hide_main_window" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            },
            "quit_app" => {
                app.exit(0);
            },
            _ => {
                // Emit custom event to frontend for handling
                let _ = app.emit("hotkey_triggered", config.clone());
            }
        }
    }
}

pub fn setup_hotkey_manager(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let hotkey_manager = HotkeyManager::new()?;
    app.manage(hotkey_manager);
    Ok(())
}

pub fn setup_hotkey_event_listener(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    std::thread::spawn(move || {
        use global_hotkey::GlobalHotKeyEvent;

        if let Ok(receiver) = GlobalHotKeyEvent::receiver() {
            loop {
                if let Ok(event) = receiver.recv() {
                    if let Some(manager) = app_handle.try_state::<HotkeyManager>() {
                        manager.handle_hotkey_event(event, &app_handle);
                    }
                }
            }
        }
    });

    Ok(())
}
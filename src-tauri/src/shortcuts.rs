use tauri::{App, Manager, Result as TauriResult};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Custom global shortcut manager for Hearth Desktop
pub struct HearthShortcutManager {
    shortcuts: HashMap<String, Shortcut>,
}

/// Configuration for Hearth-specific shortcuts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    /// Push-to-talk shortcut (default: Ctrl+Space)
    pub push_to_talk: Option<String>,
    /// Toggle mute shortcut (default: Ctrl+M)
    pub toggle_mute: Option<String>,
    /// Show/hide window shortcut (default: Ctrl+Shift+H)
    pub toggle_window: Option<String>,
    /// Quick screenshot shortcut (default: Ctrl+Shift+S)
    pub quick_screenshot: Option<String>,
    /// Set status to away (default: Ctrl+Alt+A)
    pub status_away: Option<String>,
    /// Set status to available (default: Ctrl+Alt+O)
    pub status_available: Option<String>,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            push_to_talk: Some("Ctrl+Space".to_string()),
            toggle_mute: Some("Ctrl+M".to_string()),
            toggle_window: Some("Ctrl+Shift+H".to_string()),
            quick_screenshot: Some("Ctrl+Shift+S".to_string()),
            status_away: Some("Ctrl+Alt+A".to_string()),
            status_available: Some("Ctrl+Alt+O".to_string()),
        }
    }
}

impl HearthShortcutManager {
    pub fn new() -> Self {
        Self {
            shortcuts: HashMap::new(),
        }
    }

    /// Initialize global shortcuts for the Hearth application
    pub fn setup_shortcuts(&mut self, app: &App, config: ShortcutConfig) -> TauriResult<()> {
        let window = app.get_webview_window("main").unwrap();

        // Register push-to-talk shortcut
        if let Some(shortcut_str) = config.push_to_talk {
            let shortcut = shortcut_str.parse::<Shortcut>().unwrap();
            let window_clone = window.clone();
            app.global_shortcut().on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                match event {
                    ShortcutState::Pressed => {
                        let _ = window_clone.emit("push-to-talk-start", ());
                    }
                    ShortcutState::Released => {
                        let _ = window_clone.emit("push-to-talk-end", ());
                    }
                }
            })?;
            self.shortcuts.insert("push_to_talk".to_string(), shortcut);
        }

        // Register toggle mute shortcut
        if let Some(shortcut_str) = config.toggle_mute {
            let shortcut = shortcut_str.parse::<Shortcut>().unwrap();
            let window_clone = window.clone();
            app.global_shortcut().on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                if event == ShortcutState::Pressed {
                    let _ = window_clone.emit("toggle-mute", ());
                }
            })?;
            self.shortcuts.insert("toggle_mute".to_string(), shortcut);
        }

        // Register toggle window visibility shortcut
        if let Some(shortcut_str) = config.toggle_window {
            let shortcut = shortcut_str.parse::<Shortcut>().unwrap();
            let window_clone = window.clone();
            app.global_shortcut().on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                if event == ShortcutState::Pressed {
                    if window_clone.is_visible().unwrap_or(true) {
                        let _ = window_clone.hide();
                    } else {
                        let _ = window_clone.show();
                        let _ = window_clone.set_focus();
                    }
                }
            })?;
            self.shortcuts.insert("toggle_window".to_string(), shortcut);
        }

        // Register quick screenshot shortcut
        if let Some(shortcut_str) = config.quick_screenshot {
            let shortcut = shortcut_str.parse::<Shortcut>().unwrap();
            let window_clone = window.clone();
            app.global_shortcut().on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                if event == ShortcutState::Pressed {
                    let _ = window_clone.emit("take-screenshot", ());
                }
            })?;
            self.shortcuts.insert("quick_screenshot".to_string(), shortcut);
        }

        // Register status shortcuts
        if let Some(shortcut_str) = config.status_away {
            let shortcut = shortcut_str.parse::<Shortcut>().unwrap();
            let window_clone = window.clone();
            app.global_shortcut().on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                if event == ShortcutState::Pressed {
                    let _ = window_clone.emit("set-status", "away");
                }
            })?;
            self.shortcuts.insert("status_away".to_string(), shortcut);
        }

        if let Some(shortcut_str) = config.status_available {
            let shortcut = shortcut_str.parse::<Shortcut>().unwrap();
            let window_clone = window.clone();
            app.global_shortcut().on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
                if event == ShortcutState::Pressed {
                    let _ = window_clone.emit("set-status", "available");
                }
            })?;
            self.shortcuts.insert("status_available".to_string(), shortcut);
        }

        Ok(())
    }

    /// Update a specific shortcut
    pub fn update_shortcut(&mut self, app: &App, name: &str, new_shortcut: &str) -> TauriResult<()> {
        // Unregister old shortcut if it exists
        if let Some(old_shortcut) = self.shortcuts.remove(name) {
            app.global_shortcut().unregister(old_shortcut)?;
        }

        // Parse and register new shortcut
        let shortcut = new_shortcut.parse::<Shortcut>().map_err(|e| {
            tauri::Error::Anyhow(anyhow::anyhow!("Failed to parse shortcut: {}", e))
        })?;

        // TODO: Re-register shortcut with appropriate handler based on name
        // This would require refactoring the handler registration logic

        self.shortcuts.insert(name.to_string(), shortcut);
        Ok(())
    }

    /// Get all registered shortcuts
    pub fn get_shortcuts(&self) -> &HashMap<String, Shortcut> {
        &self.shortcuts
    }

    /// Unregister all shortcuts
    pub fn cleanup(&mut self, app: &App) -> TauriResult<()> {
        for (_, shortcut) in self.shortcuts.drain() {
            app.global_shortcut().unregister(shortcut)?;
        }
        Ok(())
    }
}
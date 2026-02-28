//! QuickCapture - System-wide floating message capture window
//!
//! Provides a lightweight popup window that can be summoned from anywhere
//! for rapid message composition without switching to the main app.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, Listener, LogicalPosition, LogicalSize, Manager, Runtime, WebviewUrl,
    WebviewWindowBuilder, Window,
};

/// Quick capture window configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickCaptureConfig {
    pub width: u32,
    pub height: u32,
    pub always_on_top: bool,
    pub center_on_screen: bool,
    pub remember_position: bool,
}

impl Default for QuickCaptureConfig {
    fn default() -> Self {
        Self {
            width: 480,
            height: 400,
            always_on_top: true,
            center_on_screen: true,
            remember_position: false,
        }
    }
}

/// Quick capture window state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QuickCaptureState {
    pub is_visible: bool,
    pub last_x: Option<f64>,
    pub last_y: Option<f64>,
}

/// Manager for the quick capture floating window
pub struct QuickCaptureManager {
    config: Mutex<QuickCaptureConfig>,
    state: Mutex<QuickCaptureState>,
}

impl Default for QuickCaptureManager {
    fn default() -> Self {
        Self::new()
    }
}

impl QuickCaptureManager {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(QuickCaptureConfig::default()),
            state: Mutex::new(QuickCaptureState::default()),
        }
    }

    /// Get or create the quick capture window
    pub fn get_or_create_window<R: Runtime>(
        &self,
        app: &AppHandle<R>,
    ) -> tauri::Result<tauri::WebviewWindow<R>> {
        let label = "quick-capture";

        // Try to get existing window
        if let Some(window) = app.get_webview_window(label) {
            return Ok(window);
        }

        // Create new window
        let config = self.config.lock().unwrap();

        let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("/quick-capture".into()))
            .title("Quick Capture")
            .inner_size(config.width as f64, config.height as f64)
            .min_inner_size(400.0, 300.0)
            .resizable(true)
            .decorations(false)
            .transparent(true)
            .always_on_top(config.always_on_top)
            .visible(false)
            .skip_taskbar(true)
            .build()?;

        Ok(window)
    }

    /// Show the quick capture window
    pub fn show<R: Runtime>(&self, app: &AppHandle<R>) -> tauri::Result<()> {
        let window = self.get_or_create_window(app)?;
        let config = self.config.lock().unwrap();
        let mut state = self.state.lock().unwrap();

        // Position the window
        if config.center_on_screen {
            if let Some(monitor) = window.current_monitor()? {
                let monitor_size = monitor.size();
                let window_size = window.inner_size()?;
                let x = (monitor_size.width - window_size.width) / 2;
                let y = monitor_size.height / 5; // 20% from top

                window.set_position(LogicalPosition::new(x as f64, y as f64))?;
            }
        } else if config.remember_position {
            if let (Some(x), Some(y)) = (state.last_x, state.last_y) {
                window.set_position(LogicalPosition::new(x, y))?;
            }
        }

        window.show()?;
        window.set_focus()?;

        state.is_visible = true;

        // Emit event to frontend
        app.emit("quick-capture:shown", ())?;

        Ok(())
    }

    /// Hide the quick capture window
    pub fn hide<R: Runtime>(&self, app: &AppHandle<R>) -> tauri::Result<()> {
        let label = "quick-capture";
        let config = self.config.lock().unwrap();
        let mut state = self.state.lock().unwrap();

        if let Some(window) = app.get_webview_window(label) {
            // Save position if configured
            if config.remember_position {
                if let Ok(position) = window.outer_position() {
                    state.last_x = Some(position.x as f64);
                    state.last_y = Some(position.y as f64);
                }
            }

            window.hide()?;
        }

        state.is_visible = false;

        // Emit event to frontend
        app.emit("quick-capture:hidden", ())?;

        Ok(())
    }

    /// Toggle the quick capture window visibility
    pub fn toggle<R: Runtime>(&self, app: &AppHandle<R>) -> tauri::Result<()> {
        let is_visible = {
            let state = self.state.lock().unwrap();
            state.is_visible
        };

        if is_visible {
            self.hide(app)
        } else {
            self.show(app)
        }
    }

    /// Update configuration
    pub fn update_config(&self, new_config: QuickCaptureConfig) {
        let mut config = self.config.lock().unwrap();
        *config = new_config;
    }

    /// Get current configuration
    pub fn get_config(&self) -> QuickCaptureConfig {
        self.config.lock().unwrap().clone()
    }

    /// Get current state
    pub fn get_state(&self) -> QuickCaptureState {
        self.state.lock().unwrap().clone()
    }

    /// Check if window is visible
    pub fn is_visible(&self) -> bool {
        self.state.lock().unwrap().is_visible
    }
}

// Tauri commands

/// Show the quick capture window
#[tauri::command]
pub async fn quick_capture_show<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let manager = app.state::<QuickCaptureManager>();
    manager.show(&app).map_err(|e| e.to_string())
}

/// Hide the quick capture window
#[tauri::command]
pub async fn quick_capture_hide<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let manager = app.state::<QuickCaptureManager>();
    manager.hide(&app).map_err(|e| e.to_string())
}

/// Toggle the quick capture window
#[tauri::command]
pub async fn quick_capture_toggle<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let manager = app.state::<QuickCaptureManager>();
    manager.toggle(&app).map_err(|e| e.to_string())
}

/// Get quick capture configuration
#[tauri::command]
pub fn quick_capture_get_config<R: Runtime>(app: AppHandle<R>) -> QuickCaptureConfig {
    let manager = app.state::<QuickCaptureManager>();
    manager.get_config()
}

/// Update quick capture configuration
#[tauri::command]
pub fn quick_capture_set_config<R: Runtime>(
    app: AppHandle<R>,
    config: QuickCaptureConfig,
) -> Result<(), String> {
    let manager = app.state::<QuickCaptureManager>();
    manager.update_config(config);
    Ok(())
}

/// Get quick capture state
#[tauri::command]
pub fn quick_capture_get_state<R: Runtime>(app: AppHandle<R>) -> QuickCaptureState {
    let manager = app.state::<QuickCaptureManager>();
    manager.get_state()
}

/// Check if quick capture is visible
#[tauri::command]
pub fn quick_capture_is_visible<R: Runtime>(app: AppHandle<R>) -> bool {
    let manager = app.state::<QuickCaptureManager>();
    manager.is_visible()
}

/// Initialize quick capture event listeners
pub fn init<R: Runtime>(app: &AppHandle<R>) {
    // Listen for show/hide events from frontend
    let app_handle = app.clone();
    app.listen("quick-capture:show", move |_| {
        let manager = app_handle.state::<QuickCaptureManager>();
        let _ = manager.show(&app_handle);
    });

    let app_handle = app.clone();
    app.listen("quick-capture:hide", move |_| {
        let manager = app_handle.state::<QuickCaptureManager>();
        let _ = manager.hide(&app_handle);
    });

    let app_handle = app.clone();
    app.listen("quick-capture:toggle", move |_| {
        let manager = app_handle.state::<QuickCaptureManager>();
        let _ = manager.toggle(&app_handle);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = QuickCaptureConfig::default();
        assert_eq!(config.width, 480);
        assert_eq!(config.height, 400);
        assert!(config.always_on_top);
        assert!(config.center_on_screen);
        assert!(!config.remember_position);
    }

    #[test]
    fn test_default_state() {
        let state = QuickCaptureState::default();
        assert!(!state.is_visible);
        assert!(state.last_x.is_none());
        assert!(state.last_y.is_none());
    }

    #[test]
    fn test_manager_creation() {
        let manager = QuickCaptureManager::new();
        assert!(!manager.is_visible());
        assert_eq!(manager.get_config().width, 480);
    }

    #[test]
    fn test_config_update() {
        let manager = QuickCaptureManager::new();
        let new_config = QuickCaptureConfig {
            width: 600,
            height: 500,
            always_on_top: false,
            center_on_screen: false,
            remember_position: true,
        };

        manager.update_config(new_config.clone());

        let config = manager.get_config();
        assert_eq!(config.width, 600);
        assert_eq!(config.height, 500);
        assert!(!config.always_on_top);
        assert!(!config.center_on_screen);
        assert!(config.remember_position);
    }
}

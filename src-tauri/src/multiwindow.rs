use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::LogicalPosition;
use tauri::LogicalSize;

// Window types supported by the multi-window system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum WindowKind {
    Main,
    Settings,
    FloatingPanel,
    Popout,
    Custom,
}

// Configuration for creating a new window
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowConfig {
    pub label: String,
    pub title: String,
    pub url: String,
    pub width: f64,
    pub height: f64,
    pub min_width: Option<f64>,
    pub min_height: Option<f64>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub resizable: bool,
    pub decorations: bool,
    pub transparent: bool,
    pub always_on_top: bool,
    pub skip_taskbar: bool,
    pub center: bool,
    pub kind: WindowKind,
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            label: String::new(),
            title: "Hearth".to_string(),
            url: "/".to_string(),
            width: 800.0,
            height: 600.0,
            min_width: None,
            min_height: None,
            x: None,
            y: None,
            resizable: true,
            decorations: true,
            transparent: false,
            always_on_top: false,
            skip_taskbar: false,
            center: true,
            kind: WindowKind::Custom,
        }
    }
}

// Tracked state for each window
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub label: String,
    pub title: String,
    pub kind: WindowKind,
    pub visible: bool,
    pub focused: bool,
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
}

// IPC message sent between windows
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMessage {
    pub from: String,
    pub to: String,
    pub channel: String,
    pub payload: serde_json::Value,
}

// Events emitted by the multi-window system
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowEvent {
    pub label: String,
    pub event_type: String,
    pub data: Option<serde_json::Value>,
}

// Global registry of all managed windows
static REGISTRY: RwLock<Option<HashMap<String, WindowState>>> = RwLock::new(None);

fn ensure_registry() {
    let mut reg = REGISTRY.write().unwrap();
    if reg.is_none() {
        let mut map = HashMap::new();
        // Seed with the main window which always exists at startup
        map.insert(
            "main".to_string(),
            WindowState {
                label: "main".to_string(),
                title: "Hearth".to_string(),
                kind: WindowKind::Main,
                visible: true,
                focused: true,
                width: 1200.0,
                height: 800.0,
                x: 0.0,
                y: 0.0,
            },
        );
        *reg = Some(map);
    }
}

fn emit_window_event(app: &AppHandle, event: &WindowEvent) {
    let _ = app.emit("mw:event", event);
}

// --- Tauri Commands ---

/// Create a new window with the given configuration
#[tauri::command]
pub fn mw_create_window(app: AppHandle, config: WindowConfig) -> Result<WindowState, String> {
    ensure_registry();

    if config.label.is_empty() {
        return Err("Window label cannot be empty".to_string());
    }

    // Check if a window with this label already exists
    {
        let reg = REGISTRY.read().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_ref() {
            if map.contains_key(&config.label) {
                // If the window already exists, just focus it
                if let Some(win) = app.get_webview_window(&config.label) {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                return Err(format!("Window '{}' already exists", config.label));
            }
        }
    }

    let url = WebviewUrl::App(config.url.clone().into());
    let mut builder = WebviewWindowBuilder::new(&app, &config.label, url)
        .title(&config.title)
        .inner_size(config.width, config.height)
        .resizable(config.resizable)
        .decorations(config.decorations)
        .transparent(config.transparent)
        .always_on_top(config.always_on_top)
        .skip_taskbar(config.skip_taskbar);

    if let (Some(min_w), Some(min_h)) = (config.min_width, config.min_height) {
        builder = builder.min_inner_size(min_w, min_h);
    }

    if let (Some(x), Some(y)) = (config.x, config.y) {
        builder = builder.position(x, y);
    } else if config.center {
        builder = builder.center();
    }

    let _window = builder.build().map_err(|e| e.to_string())?;

    let state = WindowState {
        label: config.label.clone(),
        title: config.title.clone(),
        kind: config.kind.clone(),
        visible: true,
        focused: true,
        width: config.width,
        height: config.height,
        x: config.x.unwrap_or(0.0),
        y: config.y.unwrap_or(0.0),
    };

    {
        let mut reg = REGISTRY.write().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_mut() {
            map.insert(config.label.clone(), state.clone());
        }
    }

    emit_window_event(
        &app,
        &WindowEvent {
            label: config.label,
            event_type: "created".to_string(),
            data: None,
        },
    );

    Ok(state)
}

/// Close and destroy a window by label
#[tauri::command]
pub fn mw_close_window(app: AppHandle, label: String) -> Result<(), String> {
    ensure_registry();

    // Prevent closing the main window through this command
    if label == "main" {
        return Err("Cannot close the main window via mw_close_window. Use minimize_to_tray instead.".to_string());
    }

    if let Some(window) = app.get_webview_window(&label) {
        window.destroy().map_err(|e| e.to_string())?;
    }

    {
        let mut reg = REGISTRY.write().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_mut() {
            map.remove(&label);
        }
    }

    emit_window_event(
        &app,
        &WindowEvent {
            label,
            event_type: "closed".to_string(),
            data: None,
        },
    );

    Ok(())
}

/// Focus a window by label
#[tauri::command]
pub fn mw_focus_window(app: AppHandle, label: String) -> Result<(), String> {
    ensure_registry();

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    // Update focus tracking
    {
        let mut reg = REGISTRY.write().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_mut() {
            // Unfocus all windows
            for state in map.values_mut() {
                state.focused = false;
            }
            // Focus the target window
            if let Some(state) = map.get_mut(&label) {
                state.focused = true;
                state.visible = true;
            }
        }
    }

    emit_window_event(
        &app,
        &WindowEvent {
            label,
            event_type: "focused".to_string(),
            data: None,
        },
    );

    Ok(())
}

/// Show a window by label
#[tauri::command]
pub fn mw_show_window(app: AppHandle, label: String) -> Result<(), String> {
    ensure_registry();

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    window.show().map_err(|e| e.to_string())?;

    {
        let mut reg = REGISTRY.write().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_mut() {
            if let Some(state) = map.get_mut(&label) {
                state.visible = true;
            }
        }
    }

    emit_window_event(
        &app,
        &WindowEvent {
            label,
            event_type: "shown".to_string(),
            data: None,
        },
    );

    Ok(())
}

/// Hide a window by label
#[tauri::command]
pub fn mw_hide_window(app: AppHandle, label: String) -> Result<(), String> {
    ensure_registry();

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    window.hide().map_err(|e| e.to_string())?;

    {
        let mut reg = REGISTRY.write().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_mut() {
            if let Some(state) = map.get_mut(&label) {
                state.visible = false;
                state.focused = false;
            }
        }
    }

    emit_window_event(
        &app,
        &WindowEvent {
            label,
            event_type: "hidden".to_string(),
            data: None,
        },
    );

    Ok(())
}

/// Resize a window by label
#[tauri::command]
pub fn mw_resize_window(
    app: AppHandle,
    label: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    ensure_registry();

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;

    {
        let mut reg = REGISTRY.write().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_mut() {
            if let Some(state) = map.get_mut(&label) {
                state.width = width;
                state.height = height;
            }
        }
    }

    emit_window_event(
        &app,
        &WindowEvent {
            label,
            event_type: "resized".to_string(),
            data: Some(serde_json::json!({ "width": width, "height": height })),
        },
    );

    Ok(())
}

/// Move a window to a specific position
#[tauri::command]
pub fn mw_move_window(
    app: AppHandle,
    label: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    ensure_registry();

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;

    {
        let mut reg = REGISTRY.write().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_mut() {
            if let Some(state) = map.get_mut(&label) {
                state.x = x;
                state.y = y;
            }
        }
    }

    Ok(())
}

/// Get the state of a specific window
#[tauri::command]
pub fn mw_get_window_state(label: String) -> Result<WindowState, String> {
    ensure_registry();

    let reg = REGISTRY.read().map_err(|e| e.to_string())?;
    let map = reg.as_ref().unwrap();
    map.get(&label)
        .cloned()
        .ok_or_else(|| format!("Window '{}' not found in registry", label))
}

/// List all managed windows
#[tauri::command]
pub fn mw_list_windows() -> Result<Vec<WindowState>, String> {
    ensure_registry();

    let reg = REGISTRY.read().map_err(|e| e.to_string())?;
    let map = reg.as_ref().unwrap();
    Ok(map.values().cloned().collect())
}

/// Send a message from one window to another via IPC
#[tauri::command]
pub fn mw_send_message(app: AppHandle, message: WindowMessage) -> Result<(), String> {
    ensure_registry();

    // Broadcast to a specific window or all windows
    if message.to == "*" {
        // Broadcast to all windows
        let reg = REGISTRY.read().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_ref() {
            for label in map.keys() {
                if label != &message.from {
                    if let Some(window) = app.get_webview_window(label) {
                        let _ = window.emit("mw:message", &message);
                    }
                }
            }
        }
    } else {
        // Send to specific window
        let window = app
            .get_webview_window(&message.to)
            .ok_or_else(|| format!("Target window '{}' not found", message.to))?;
        window
            .emit("mw:message", &message)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Set window always-on-top property
#[tauri::command]
pub fn mw_set_always_on_top(
    app: AppHandle,
    label: String,
    always_on_top: bool,
) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())
}

/// Set window title
#[tauri::command]
pub fn mw_set_title(app: AppHandle, label: String, title: String) -> Result<(), String> {
    ensure_registry();

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    window.set_title(&title).map_err(|e| e.to_string())?;

    {
        let mut reg = REGISTRY.write().map_err(|e| e.to_string())?;
        if let Some(map) = reg.as_mut() {
            if let Some(state) = map.get_mut(&label) {
                state.title = title;
            }
        }
    }

    Ok(())
}

/// Center a window on screen
#[tauri::command]
pub fn mw_center_window(app: AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    window.center().map_err(|e| e.to_string())
}

// Called during app setup to sync the registry with actual window state
pub fn sync_registry_with_app(app: &AppHandle) {
    ensure_registry();

    if let Some(main_win) = app.get_webview_window("main") {
        let mut reg = REGISTRY.write().unwrap();
        if let Some(map) = reg.as_mut() {
            if let Some(state) = map.get_mut("main") {
                if let Ok(size) = main_win.inner_size() {
                    if let Ok(scale) = main_win.scale_factor() {
                        state.width = size.width as f64 / scale;
                        state.height = size.height as f64 / scale;
                    }
                }
                if let Ok(pos) = main_win.outer_position() {
                    if let Ok(scale) = main_win.scale_factor() {
                        state.x = pos.x as f64 / scale;
                        state.y = pos.y as f64 / scale;
                    }
                }
            }
        }
    }

    // Also register the floating window if it exists
    if let Some(_floating) = app.get_webview_window("floating") {
        let mut reg = REGISTRY.write().unwrap();
        if let Some(map) = reg.as_mut() {
            if !map.contains_key("floating") {
                map.insert(
                    "floating".to_string(),
                    WindowState {
                        label: "floating".to_string(),
                        title: "Hearth Mini".to_string(),
                        kind: WindowKind::FloatingPanel,
                        visible: false,
                        focused: false,
                        width: 380.0,
                        height: 520.0,
                        x: 0.0,
                        y: 0.0,
                    },
                );
            }
        }
    }
}

// Called when a window emits focus/blur/close events to keep the registry in sync
pub fn handle_window_focus(label: &str, focused: bool) {
    ensure_registry();
    let mut reg = REGISTRY.write().unwrap();
    if let Some(map) = reg.as_mut() {
        if focused {
            for state in map.values_mut() {
                state.focused = false;
            }
        }
        if let Some(state) = map.get_mut(label) {
            state.focused = focused;
        }
    }
}

pub fn handle_window_destroyed(label: &str) {
    ensure_registry();
    // Don't remove main or floating from registry on destroy
    if label == "main" || label == "floating" {
        return;
    }
    let mut reg = REGISTRY.write().unwrap();
    if let Some(map) = reg.as_mut() {
        map.remove(label);
    }
}

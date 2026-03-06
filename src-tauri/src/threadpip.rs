//! Thread Picture-in-Picture - floating mini-windows for threads and DMs
//!
//! Creates individual always-on-top windows for specific conversations,
//! letting users monitor or reply while working in other apps.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager};

static PIP_WINDOWS: RwLock<Option<HashMap<String, PipWindowState>>> = RwLock::new(None);
static PIP_CONFIG: RwLock<Option<PipConfig>> = RwLock::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipWindowState {
    pub window_id: String,
    pub conversation_id: String,
    pub conversation_type: ConversationType,
    pub title: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub opacity: f64,
    pub always_on_top: bool,
    pub compact_mode: bool,
    pub created_at: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConversationType {
    Thread,
    Dm,
    Channel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipConfig {
    pub default_width: f64,
    pub default_height: f64,
    pub default_opacity: f64,
    pub always_on_top: bool,
    pub compact_mode: bool,
    pub max_windows: usize,
    pub remember_positions: bool,
}

impl Default for PipConfig {
    fn default() -> Self {
        Self {
            default_width: 360.0,
            default_height: 480.0,
            default_opacity: 1.0,
            always_on_top: true,
            compact_mode: false,
            max_windows: 5,
            remember_positions: true,
        }
    }
}

fn get_windows() -> HashMap<String, PipWindowState> {
    PIP_WINDOWS.read().unwrap().clone().unwrap_or_default()
}

fn get_config() -> PipConfig {
    PIP_CONFIG.read().unwrap().clone().unwrap_or_default()
}

fn now_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Open a new PiP window for a conversation
#[tauri::command]
pub fn pip_open_window(
    app: AppHandle,
    conversation_id: String,
    conversation_type: ConversationType,
    title: String,
) -> Result<PipWindowState, String> {
    let window_label = format!("pip-{}", conversation_id.replace(['/', '\\', ' '], "-"));
    let config = get_config();
    let windows = get_windows();

    // Check max windows limit
    if windows.len() >= config.max_windows {
        return Err(format!(
            "Maximum PiP windows ({}) reached",
            config.max_windows
        ));
    }

    // Don't open duplicate windows for the same conversation
    if windows.contains_key(&window_label) {
        // Focus the existing window instead
        if let Some(existing) = app.get_webview_window(&window_label) {
            let _ = existing.set_focus();
        }
        return Err(format!(
            "PiP window already open for conversation {}",
            conversation_id
        ));
    }

    // Create the webview window
    let url = format!("/pip?id={}&type={:?}", conversation_id, conversation_type);
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        &window_label,
        tauri::WebviewUrl::App(url.into()),
    )
    .title(&title)
    .inner_size(config.default_width, config.default_height)
    .always_on_top(config.always_on_top)
    .decorations(true)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    // Read the actual position the OS assigned
    let position = window.outer_position().unwrap_or_default();

    let state = PipWindowState {
        window_id: window_label.clone(),
        conversation_id,
        conversation_type,
        title,
        x: position.x as f64,
        y: position.y as f64,
        width: config.default_width,
        height: config.default_height,
        opacity: config.default_opacity,
        always_on_top: config.always_on_top,
        compact_mode: config.compact_mode,
        created_at: now_timestamp(),
    };

    // Store the window state
    {
        let mut pip_windows = PIP_WINDOWS.write().unwrap();
        let map = pip_windows.get_or_insert_with(HashMap::new);
        map.insert(window_label, state.clone());
    }

    let _ = app.emit("pip:window-opened", &state);
    Ok(state)
}

/// Close a specific PiP window
#[tauri::command]
pub fn pip_close_window(app: AppHandle, window_id: String) -> Result<(), String> {
    // Close the actual window
    if let Some(window) = app.get_webview_window(&window_id) {
        window.close().map_err(|e| e.to_string())?;
    }

    // Remove from state
    {
        let mut pip_windows = PIP_WINDOWS.write().unwrap();
        if let Some(map) = pip_windows.as_mut() {
            map.remove(&window_id);
        }
    }

    let _ = app.emit("pip:window-closed", &window_id);
    Ok(())
}

/// Close all PiP windows
#[tauri::command]
pub fn pip_close_all(app: AppHandle) -> Result<(), String> {
    let windows = get_windows();
    for (label, _) in &windows {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.close();
        }
    }

    // Clear all state
    {
        let mut pip_windows = PIP_WINDOWS.write().unwrap();
        *pip_windows = Some(HashMap::new());
    }

    let _ = app.emit("pip:all-closed", ());
    Ok(())
}

/// List all open PiP windows
#[tauri::command]
pub fn pip_list_windows() -> Vec<PipWindowState> {
    get_windows().into_values().collect()
}

/// Set the opacity of a PiP window
#[tauri::command]
pub fn pip_set_opacity(
    app: AppHandle,
    window_id: String,
    opacity: f64,
) -> Result<(), String> {
    let opacity = opacity.clamp(0.1, 1.0);

    // WebviewWindow doesn't expose set_opacity directly;
    // just track the value in state for now.
    if app.get_webview_window(&window_id).is_none() {
        return Err(format!("Window {} not found", window_id));
    }

    // Update state
    {
        let mut pip_windows = PIP_WINDOWS.write().unwrap();
        if let Some(map) = pip_windows.as_mut() {
            if let Some(state) = map.get_mut(&window_id) {
                state.opacity = opacity;
            }
        }
    }

    Ok(())
}

/// Set always-on-top for a PiP window
#[tauri::command]
pub fn pip_set_always_on_top(
    app: AppHandle,
    window_id: String,
    on_top: bool,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_id) {
        window
            .set_always_on_top(on_top)
            .map_err(|e| e.to_string())?;
    } else {
        return Err(format!("Window {} not found", window_id));
    }

    // Update state
    {
        let mut pip_windows = PIP_WINDOWS.write().unwrap();
        if let Some(map) = pip_windows.as_mut() {
            if let Some(state) = map.get_mut(&window_id) {
                state.always_on_top = on_top;
            }
        }
    }

    Ok(())
}

/// Toggle compact mode for a PiP window (resizes to a smaller view)
#[tauri::command]
pub fn pip_set_compact(
    app: AppHandle,
    window_id: String,
    compact: bool,
) -> Result<(), String> {
    let config = get_config();

    if let Some(window) = app.get_webview_window(&window_id) {
        let (width, height) = if compact {
            (config.default_width * 0.75, 200.0)
        } else {
            (config.default_width, config.default_height)
        };
        window
            .set_size(tauri::LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
    } else {
        return Err(format!("Window {} not found", window_id));
    }

    // Update state
    {
        let mut pip_windows = PIP_WINDOWS.write().unwrap();
        if let Some(map) = pip_windows.as_mut() {
            if let Some(state) = map.get_mut(&window_id) {
                state.compact_mode = compact;
                if compact {
                    state.width = config.default_width * 0.75;
                    state.height = 200.0;
                } else {
                    state.width = config.default_width;
                    state.height = config.default_height;
                }
            }
        }
    }

    Ok(())
}

/// Get the current PiP configuration
#[tauri::command]
pub fn pip_get_config() -> PipConfig {
    get_config()
}

/// Update the PiP configuration
#[tauri::command]
pub fn pip_set_config(app: AppHandle, config: PipConfig) -> Result<(), String> {
    {
        let mut pip_config = PIP_CONFIG.write().unwrap();
        *pip_config = Some(config.clone());
    }

    let _ = app.emit("pip:config-changed", &config);
    Ok(())
}

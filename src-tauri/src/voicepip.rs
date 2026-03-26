//! Voice Picture-in-Picture - floating overlay for voice channel participants
//!
//! Creates a small always-on-top window showing who's in the current voice channel
//! and their speaking status, with drag repositioning and minimize/close controls.

use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager};

static STATE: RwLock<Option<VoicePipState>> = RwLock::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoicePipState {
    pub visible: bool,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub opacity: f64,
    pub channel_id: Option<String>,
    pub channel_name: Option<String>,
}

impl Default for VoicePipState {
    fn default() -> Self {
        Self {
            visible: false,
            x: 0.0,
            y: 0.0,
            width: 280.0,
            height: 200.0,
            opacity: 1.0,
            channel_id: None,
            channel_name: None,
        }
    }
}

fn get_state() -> VoicePipState {
    STATE.read().unwrap().clone().unwrap_or_default()
}

fn ensure_state() {
    let mut s = STATE.write().unwrap();
    if s.is_none() {
        *s = Some(VoicePipState::default());
    }
}

/// Show the voice PiP overlay, creating it if needed
#[tauri::command]
pub fn voice_pip_show(app: AppHandle, channel_id: String, channel_name: String) -> Result<VoicePipState, String> {
    ensure_state();

    // Check if window already exists
    if let Some(window) = app.get_webview_window("voice-pip") {
        // Update position if needed and show
        if let Ok(Some(monitor)) = window.current_monitor() {
            let mon_size = monitor.size();
            let mon_pos = monitor.position();
            let scale = monitor.scale_factor();

            let sw = (mon_size.width as f64 / scale) as f64;
            let sh = (mon_size.height as f64 / scale) as f64;
            let sx = (mon_pos.x as f64 / scale) as f64;
            let sy = (mon_pos.y as f64 / scale) as f64;

            let state = get_state();
            let pad = 16.0;

            // Default to bottom-right corner
            let nx = sx + sw - state.width - pad;
            let ny = sy + sh - state.height - pad - 40.0;

            let _ = window.set_position(tauri::LogicalPosition::new(nx, ny));
        }

        let _ = window.show();
        let _ = window.set_focus();
    } else {
        // Create the voice PiP window
        let url = format!("/voice-pip?id={}&name={}", channel_id, channel_name);
        
        let window = tauri::WebviewWindowBuilder::new(
            &app,
            "voice-pip",
            tauri::WebviewUrl::App(url.into()),
        )
        .title(format!("Voice: {}", channel_name))
        .inner_size(280.0, 200.0)
        .always_on_top(true)
        .decorations(false)
        .transparent(true)
        .resizable(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;

        // Position in bottom-right corner
        if let Ok(Some(monitor)) = window.current_monitor() {
            let mon_size = monitor.size();
            let mon_pos = monitor.position();
            let scale = monitor.scale_factor();

            let sw = (mon_size.width as f64 / scale) as f64;
            let sh = (mon_size.height as f64 / scale) as f64;
            let sx = (mon_pos.x as f64 / scale) as f64;
            let sy = (mon_pos.y as f64 / scale) as f64;

            let pad = 16.0;
            let nx = sx + sw - 280.0 - pad;
            let ny = sy + sh - 200.0 - pad - 40.0;

            let _ = window.set_position(tauri::LogicalPosition::new(nx, ny));
        }
    }

    // Update state
    {
        let mut state = STATE.write().map_err(|e| e.to_string())?;
        if let Some(ref mut s) = *state {
            s.visible = true;
            s.channel_id = Some(channel_id);
            s.channel_name = Some(channel_name);
        }
    }

    let result = get_state();
    let _ = app.emit("voice-pip:shown", &result);
    Ok(result)
}

/// Hide the voice PiP overlay
#[tauri::command]
pub fn voice_pip_hide(app: AppHandle) -> Result<(), String> {
    ensure_state();

    if let Some(window) = app.get_webview_window("voice-pip") {
        let _ = window.hide();
    }

    {
        let mut state = STATE.write().map_err(|e| e.to_string())?;
        if let Some(ref mut s) = *state {
            s.visible = false;
        }
    }

    Ok(())
}

/// Toggle the voice PiP overlay visibility
#[tauri::command]
pub fn voice_pip_toggle(app: AppHandle, channel_id: String, channel_name: String) -> Result<VoicePipState, String> {
    ensure_state();

    let visible = {
        let state = STATE.read().map_err(|e| e.to_string())?;
        state.as_ref().map(|s| s.visible).unwrap_or(false)
    };

    if visible {
        voice_pip_hide(app.clone())?;
        Ok(get_state())
    } else {
        voice_pip_show(app, channel_id, channel_name)
    }
}

/// Update the voice PiP overlay position
#[tauri::command]
pub fn voice_pip_move(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    ensure_state();

    if let Some(window) = app.get_webview_window("voice-pip") {
        window
            .set_position(tauri::LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
    }

    {
        let mut state = STATE.write().map_err(|e| e.to_string())?;
        if let Some(ref mut s) = *state {
            s.x = x;
            s.y = y;
        }
    }

    Ok(())
}

/// Resize the voice PiP overlay
#[tauri::command]
pub fn voice_pip_resize(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    ensure_state();

    let w = width.clamp(200.0, 400.0);
    let h = height.clamp(150.0, 400.0);

    if let Some(window) = app.get_webview_window("voice-pip") {
        window
            .set_size(tauri::LogicalSize::new(w, h))
            .map_err(|e| e.to_string())?;
    }

    {
        let mut state = STATE.write().map_err(|e| e.to_string())?;
        if let Some(ref mut s) = *state {
            s.width = w;
            s.height = h;
        }
    }

    Ok(())
}

/// Get current voice PiP state
#[tauri::command]
pub fn voice_pip_get_state() -> Result<VoicePipState, String> {
    Ok(get_state())
}

/// Update voice channel info in PiP
#[tauri::command]
pub fn voice_pip_update_channel(app: AppHandle, channel_id: String, channel_name: String) -> Result<(), String> {
    ensure_state();

    {
        let mut state = STATE.write().map_err(|e| e.to_string())?;
        if let Some(ref mut s) = *state {
            s.channel_id = Some(channel_id);
            s.channel_name = Some(channel_name);
        }
    }

    // Update window title
    if let Some(window) = app.get_webview_window("voice-pip") {
        window
            .set_title(&format!("Voice: {}", channel_name))
            .map_err(|e| e.to_string())?;
        
        // Emit event to frontend to update UI
        let _ = window.emit("voice-pip:channel-update", serde_json::json!({
            "channel_id": channel_id,
            "channel_name": channel_name
        }));
    }

    Ok(())
}

/// Close the voice PiP overlay
#[tauri::command]
pub fn voice_pip_close(app: AppHandle) -> Result<(), String> {
    ensure_state();

    if let Some(window) = app.get_webview_window("voice-pip") {
        window.close().map_err(|e| e.to_string())?;
    }

    {
        let mut state = STATE.write().map_err(|e| e.to_string())?;
        if let Some(ref mut s) = *state {
            s.visible = false;
            s.channel_id = None;
            s.channel_name = None;
        }
    }

    let _ = app.emit("voice-pip:closed", ());
    Ok(())
}

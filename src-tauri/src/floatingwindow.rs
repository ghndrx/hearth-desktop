use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager, LogicalPosition, LogicalSize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FloatingWindowState {
    pub visible: bool,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub opacity: f64,
    pub corner: String,
}

impl Default for FloatingWindowState {
    fn default() -> Self {
        Self {
            visible: false,
            width: 380,
            height: 520,
            x: 0,
            y: 0,
            opacity: 1.0,
            corner: "bottom-right".to_string(),
        }
    }
}

static STATE: RwLock<Option<FloatingWindowState>> = RwLock::new(None);

fn ensure_state() {
    let mut s = STATE.write().unwrap();
    if s.is_none() {
        *s = Some(FloatingWindowState::default());
    }
}

/// Show the floating window, creating it if needed
#[tauri::command]
pub fn floating_show(app: AppHandle, corner: Option<String>) -> Result<FloatingWindowState, String> {
    ensure_state();

    let selected_corner = corner.unwrap_or_else(|| {
        let s = STATE.read().unwrap();
        s.as_ref().map(|st| st.corner.clone()).unwrap_or_else(|| "bottom-right".to_string())
    });

    let window = match app.get_webview_window("floating") {
        Some(w) => w,
        None => return Err("Floating window not found".to_string()),
    };

    // Position in the selected corner
    if let Ok(Some(monitor)) = window.current_monitor() {
        let mon_size = monitor.size();
        let mon_pos = monitor.position();
        let scale = monitor.scale_factor();

        let sw = (mon_size.width as f64 / scale) as i32;
        let sh = (mon_size.height as f64 / scale) as i32;
        let sx = (mon_pos.x as f64 / scale) as i32;
        let sy = (mon_pos.y as f64 / scale) as i32;

        let mut state = STATE.write().map_err(|e| e.to_string())?;
        let st = state.as_mut().unwrap();
        let w = st.width as i32;
        let h = st.height as i32;
        let pad = 16;

        let (nx, ny) = match selected_corner.as_str() {
            "top-left" => (sx + pad, sy + pad + 30),
            "top-right" => (sx + sw - w - pad, sy + pad + 30),
            "bottom-left" => (sx + pad, sy + sh - h - pad - 40),
            _ => (sx + sw - w - pad, sy + sh - h - pad - 40),
        };

        st.x = nx;
        st.y = ny;
        st.corner = selected_corner;
        st.visible = true;

        let _ = window.set_position(LogicalPosition::new(nx as f64, ny as f64));
        let _ = window.set_size(LogicalSize::new(st.width as f64, st.height as f64));

        let result = st.clone();
        drop(state);

        let _ = window.show();
        let _ = window.set_focus();

        Ok(result)
    } else {
        let _ = window.show();
        let _ = window.set_focus();
        let mut state = STATE.write().map_err(|e| e.to_string())?;
        let st = state.as_mut().unwrap();
        st.visible = true;
        Ok(st.clone())
    }
}

/// Hide the floating window
#[tauri::command]
pub fn floating_hide(app: AppHandle) -> Result<(), String> {
    ensure_state();

    if let Some(window) = app.get_webview_window("floating") {
        let _ = window.hide();
    }

    let mut state = STATE.write().map_err(|e| e.to_string())?;
    if let Some(ref mut st) = *state {
        st.visible = false;
    }

    Ok(())
}

/// Toggle the floating window visibility
#[tauri::command]
pub fn floating_toggle(app: AppHandle, corner: Option<String>) -> Result<FloatingWindowState, String> {
    ensure_state();

    let visible = {
        let state = STATE.read().map_err(|e| e.to_string())?;
        state.as_ref().map(|s| s.visible).unwrap_or(false)
    };

    if visible {
        floating_hide(app.clone())?;
        let state = STATE.read().map_err(|e| e.to_string())?;
        Ok(state.as_ref().unwrap().clone())
    } else {
        floating_show(app, corner)
    }
}

/// Get current floating window state
#[tauri::command]
pub fn floating_get_state() -> Result<FloatingWindowState, String> {
    ensure_state();
    let state = STATE.read().map_err(|e| e.to_string())?;
    Ok(state.as_ref().unwrap().clone())
}

/// Set floating window opacity
#[tauri::command]
pub fn floating_set_opacity(app: AppHandle, opacity: f64) -> Result<(), String> {
    ensure_state();

    let clamped = opacity.clamp(0.2, 1.0);

    if let Some(window) = app.get_webview_window("floating") {
        let _ = window.set_shadow(clamped >= 0.95);
    }

    let mut state = STATE.write().map_err(|e| e.to_string())?;
    if let Some(ref mut st) = *state {
        st.opacity = clamped;
    }

    Ok(())
}

/// Move floating window to a different corner
#[tauri::command]
pub fn floating_move_corner(app: AppHandle, corner: String) -> Result<FloatingWindowState, String> {
    ensure_state();

    let visible = {
        let state = STATE.read().map_err(|e| e.to_string())?;
        state.as_ref().map(|s| s.visible).unwrap_or(false)
    };

    if visible {
        floating_show(app, Some(corner))
    } else {
        let mut state = STATE.write().map_err(|e| e.to_string())?;
        if let Some(ref mut st) = *state {
            st.corner = corner;
        }
        Ok(state.as_ref().unwrap().clone())
    }
}

/// Resize the floating window
#[tauri::command]
pub fn floating_resize(app: AppHandle, width: u32, height: u32) -> Result<(), String> {
    ensure_state();

    let w = width.clamp(280, 600);
    let h = height.clamp(360, 800);

    if let Some(window) = app.get_webview_window("floating") {
        let _ = window.set_size(LogicalSize::new(w as f64, h as f64));
    }

    let mut state = STATE.write().map_err(|e| e.to_string())?;
    if let Some(ref mut st) = *state {
        st.width = w;
        st.height = h;
    }

    Ok(())
}

/// Send a navigation event to the floating window
#[tauri::command]
pub fn floating_navigate(app: AppHandle, route: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating") {
        window.emit("floating:navigate", &route).map_err(|e| e.to_string())?;
    }
    Ok(())
}

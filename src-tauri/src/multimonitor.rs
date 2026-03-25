//! Multi-Monitor Detection and Configuration System
//!
//! Provides native multi-monitor detection and window positioning across monitors.
//! - Enumerate all connected displays with properties (resolution, position, scale, etc.)
//! - Query which monitor a window is currently on
//! - Persist per-monitor preferences
//! - Listen for monitor connect/disconnect events

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, WebviewWindow, Manager};

/// Represents a physical display/monitor
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Monitor {
    /// Unique identifier for the monitor (platform-specific)
    pub id: String,
    /// Human-readable name (e.g., "Dell U2720Q", "LG UltraWide")
    pub name: String,
    /// Is this the primary/built-in display?
    pub is_primary: bool,
    /// X position in virtual screen space (pixels)
    pub x: i32,
    /// Y position in virtual screen space (pixels)
    pub y: i32,
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
    /// Horizontal scale factor (1.0 = 100%)
    pub scale_factor: f64,
    /// Refresh rate in Hz (approximate)
    pub refresh_rate: f64,
    /// Monitor orientation (degrees: 0, 90, 180, 270)
    pub rotation: u16,
    /// Is the monitor currently connected?
    pub is_connected: bool,
}

/// User preferences for a specific monitor (by monitor id)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MonitorPreferences {
    /// Monitor ID these preferences apply to
    pub monitor_id: String,
    /// Should app windows prefer this monitor?
    pub preferred: bool,
    /// Custom label user assigned to this monitor
    pub label: Option<String>,
}

/// Global multi-monitor state
pub struct MultiMonitorState {
    /// Cached monitor list
    monitors: Mutex<Vec<Monitor>>,
    /// Per-monitor user preferences
    preferences: Mutex<HashMap<String, MonitorPreferences>>,
}

impl Default for MultiMonitorState {
    fn default() -> Self {
        Self {
            monitors: Mutex::new(Vec::new()),
            preferences: Mutex::new(HashMap::new()),
        }
    }
}

/// Get all available monitors with their properties
#[tauri::command]
pub fn get_monitors(window: WebviewWindow) -> Result<Vec<Monitor>, String> {
    let available = window.available_monitors().map_err(|e| e.to_string())?;
    
    let monitors: Vec<Monitor> = available
        .into_iter()
        .enumerate()
        .map(|(i, m)| {
            let position = m.position();
            let size = m.size();
            let scale = m.scale_factor();
            
            Monitor {
                id: m.name().unwrap_or_else(|| format!("monitor-{}", i)),
                name: m.name().unwrap_or_else(|| format!("Display {}", i + 1)),
                is_primary: i == 0, // First monitor is typically primary
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
                scale_factor: scale,
                refresh_rate: 60.0, // Note: Tauri's Monitor doesn't expose refresh rate
                rotation: 0,
                is_connected: true,
            }
        })
        .collect();
    
    Ok(monitors)
}

/// Get the monitor that currently contains the center of the given window
#[tauri::command]
pub fn get_window_monitor(window: WebviewWindow) -> Result<Option<Monitor>, String> {
    let available = window.available_monitors().map_err(|e| e.to_string())?;
    let window_pos = window.outer_position().map_err(|e| e.to_string())?;
    let window_size = window.outer_size().map_err(|e| e.to_string())?;
    
    // Get window center point
    let center_x = window_pos.x + (window_size.width as i32) / 2;
    let center_y = window_pos.y + (window_size.height as i32) / 2;
    
    for (i, m) in available.iter().enumerate() {
        let pos = m.position();
        let size = m.size();
        
        if center_x >= pos.x 
            && center_x < pos.x + size.width as i32
            && center_y >= pos.y
            && center_y < pos.y + size.height as i32
        {
            return Ok(Some(Monitor {
                id: m.name().unwrap_or_else(|| format!("monitor-{}", i)),
                name: m.name().unwrap_or_else(|| format!("Display {}", i + 1)),
                is_primary: i == 0,
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                scale_factor: m.scale_factor(),
                refresh_rate: 60.0,
                rotation: 0,
                is_connected: true,
            }));
        }
    }
    
    Ok(None)
}

/// Move the window to a specific monitor by its ID
#[tauri::command]
pub fn move_window_to_monitor(window: WebviewWindow, monitor_id: String) -> Result<(), String> {
    let available = window.available_monitors().map_err(|e| e.to_string())?;
    
    let target = available
        .iter()
        .find(|m| m.name().map_or(false, |n| n == monitor_id))
        .ok_or_else(|| format!("Monitor '{}' not found", monitor_id))?;
    
    let target_pos = target.position();
    let target_size = target.size();
    let window_size = window.outer_size().map_err(|e| e.to_string())?;
    
    // Center the window on the target monitor
    let new_x = target_pos.x + (target_size.width as i32 - window_size.width as i32) / 2;
    let new_y = target_pos.y + (target_size.height as i32 - window_size.height as i32) / 2;
    
    window
        .set_position(tauri::PhysicalPosition::new(new_x, new_y))
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Get the virtual screen bounds (all monitors combined as one rectangle)
#[tauri::command]
pub fn get_virtual_screen_bounds(window: WebviewWindow) -> Result<ScreenBounds, String> {
    let available = window.available_monitors().map_err(|e| e.to_string())?;
    
    if available.is_empty() {
        return Err("No monitors available".to_string());
    }
    
    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;
    
    for m in &available {
        let pos = m.position();
        let size = m.size();
        min_x = min_x.min(pos.x);
        min_y = min_y.min(pos.y);
        max_x = max_x.max(pos.x + size.width as i32);
        max_y = max_y.max(pos.y + size.height as i32);
    }
    
    Ok(ScreenBounds {
        x: min_x,
        y: min_y,
        width: (max_x - min_x) as u32,
        height: (max_y - min_y) as u32,
    })
}

/// Screen bounds rectangle
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Save monitor preferences (e.g., which monitor is preferred)
#[tauri::command]
pub fn save_monitor_preference(
    state: tauri::State<'_, MultiMonitorState>,
    preference: MonitorPreferences,
) -> Result<(), String> {
    let mut prefs = state.preferences.lock().map_err(|e| e.to_string())?;
    prefs.insert(preference.monitor_id.clone(), preference);
    Ok(())
}

/// Load all monitor preferences
#[tauri::command]
pub fn get_monitor_preferences(
    state: tauri::State<'_, MultiMonitorState>,
) -> Result<Vec<MonitorPreferences>, String> {
    let prefs = state.preferences.lock().map_err(|e| e.to_string())?;
    Ok(prefs.values().cloned().collect())
}

/// Set a monitor as the preferred display for the app
#[tauri::command]
pub fn set_preferred_monitor(
    state: tauri::State<'_, MultiMonitorState>,
    monitor_id: String,
) -> Result<(), String> {
    let mut prefs = state.preferences.lock().map_err(|e| e.to_string())?;
    
    // Clear preferred flag on all monitors
    for pref in prefs.values_mut() {
        pref.preferred = false;
    }
    
    // Set the specified monitor as preferred
    if let Some(p) = prefs.get_mut(&monitor_id) {
        p.preferred = true;
    } else {
        prefs.insert(monitor_id.clone(), MonitorPreferences {
            monitor_id,
            preferred: true,
            label: None,
        });
    }
    
    Ok(())
}

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::WebviewWindow;

/// Available snap zones for window positioning
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SnapZone {
    Left,
    Right,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Top,
    Center,
}

impl SnapZone {
    /// Get all zones in cycle order
    fn all_zones() -> &'static [SnapZone] {
        &[
            SnapZone::Left,
            SnapZone::TopLeft,
            SnapZone::Top,
            SnapZone::TopRight,
            SnapZone::Right,
            SnapZone::BottomRight,
            SnapZone::Center,
            SnapZone::BottomLeft,
        ]
    }

    /// Get the index of this zone in the cycle order
    fn cycle_index(&self) -> usize {
        Self::all_zones()
            .iter()
            .position(|z| z == self)
            .unwrap_or(0)
    }
}

/// Cycle direction for snap_cycle_zone
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CycleDirection {
    Next,
    Prev,
}

/// Stored window bounds for restore functionality
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Snap configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapConfig {
    pub enabled: bool,
    pub snap_threshold: u32,
    pub animation_enabled: bool,
    pub show_snap_preview: bool,
    pub gap: u32,
}

impl Default for SnapConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            snap_threshold: 20,
            animation_enabled: true,
            show_snap_preview: true,
            gap: 8,
        }
    }
}

/// Full snap state exposed to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapState {
    pub is_snapped: bool,
    pub current_zone: Option<SnapZone>,
    pub original_bounds: Option<WindowBounds>,
}

/// Monitor information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

/// Zone definition with screen coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoneDefinition {
    pub zone: SnapZone,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub label: String,
}

/// The main snap manager holding state
pub struct WindowSnapManager {
    pub config: Mutex<SnapConfig>,
    pub current_zone: Mutex<Option<SnapZone>>,
    pub original_bounds: Mutex<Option<WindowBounds>>,
}

impl Default for WindowSnapManager {
    fn default() -> Self {
        Self {
            config: Mutex::new(SnapConfig::default()),
            current_zone: Mutex::new(None),
            original_bounds: Mutex::new(None),
        }
    }
}

/// Helper: compute the target rect for a snap zone given monitor dimensions and gap
fn zone_rect(zone: &SnapZone, mon_x: f64, mon_y: f64, mon_w: f64, mon_h: f64, gap: f64) -> (f64, f64, f64, f64) {
    let half_w = (mon_w - gap * 3.0) / 2.0;
    let half_h = (mon_h - gap * 3.0) / 2.0;
    let full_w = mon_w - gap * 2.0;
    let full_h = mon_h - gap * 2.0;

    match zone {
        SnapZone::Left => (mon_x + gap, mon_y + gap, half_w, full_h),
        SnapZone::Right => (mon_x + gap * 2.0 + half_w, mon_y + gap, half_w, full_h),
        SnapZone::TopLeft => (mon_x + gap, mon_y + gap, half_w, half_h),
        SnapZone::TopRight => (mon_x + gap * 2.0 + half_w, mon_y + gap, half_w, half_h),
        SnapZone::BottomLeft => (mon_x + gap, mon_y + gap * 2.0 + half_h, half_w, half_h),
        SnapZone::BottomRight => (mon_x + gap * 2.0 + half_w, mon_y + gap * 2.0 + half_h, half_w, half_h),
        SnapZone::Top => (mon_x + gap, mon_y + gap, full_w, full_h), // maximize
        SnapZone::Center => {
            let center_w = mon_w * 0.6;
            let center_h = mon_h * 0.7;
            let cx = mon_x + (mon_w - center_w) / 2.0;
            let cy = mon_y + (mon_h - center_h) / 2.0;
            (cx, cy, center_w, center_h)
        }
    }
}

/// Snap window to a specific zone
#[tauri::command]
pub async fn snap_window(
    window: WebviewWindow,
    state: tauri::State<'_, WindowSnapManager>,
    zone: SnapZone,
) -> Result<(), String> {
    // Check if snapping is enabled
    let config = state.config.lock().map_err(|e| e.to_string())?;
    if !config.enabled {
        return Err("Window snapping is disabled".into());
    }
    let gap = config.gap as f64;
    drop(config);

    // Save original bounds if not already snapped
    {
        let mut orig = state.original_bounds.lock().map_err(|e| e.to_string())?;
        if orig.is_none() {
            let pos = window.outer_position().map_err(|e| e.to_string())?;
            let size = window.outer_size().map_err(|e| e.to_string())?;
            let scale = window.scale_factor().map_err(|e| e.to_string())?;
            *orig = Some(WindowBounds {
                x: pos.x as f64 / scale,
                y: pos.y as f64 / scale,
                width: size.width as f64 / scale,
                height: size.height as f64 / scale,
            });
        }
    }

    // Get monitor info
    let monitor = window.current_monitor().map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;
    let scale = monitor.scale_factor();
    let mon_pos = monitor.position();
    let mon_size = monitor.size();
    let mon_x = mon_pos.x as f64 / scale;
    let mon_y = mon_pos.y as f64 / scale;
    let mon_w = mon_size.width as f64 / scale;
    let mon_h = mon_size.height as f64 / scale;

    let (x, y, w, h) = zone_rect(&zone, mon_x, mon_y, mon_w, mon_h, gap);

    window
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::LogicalSize::new(w, h))
        .map_err(|e| e.to_string())?;

    // Update state
    {
        let mut current = state.current_zone.lock().map_err(|e| e.to_string())?;
        *current = Some(zone);
    }

    Ok(())
}

/// Restore window to pre-snap size and position
#[tauri::command]
pub async fn snap_restore(
    window: WebviewWindow,
    state: tauri::State<'_, WindowSnapManager>,
) -> Result<(), String> {
    let mut orig = state.original_bounds.lock().map_err(|e| e.to_string())?;
    let bounds = orig.take().ok_or_else(|| "No saved bounds to restore".to_string())?;

    window
        .set_position(tauri::LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::LogicalSize::new(bounds.width, bounds.height))
        .map_err(|e| e.to_string())?;

    let mut current = state.current_zone.lock().map_err(|e| e.to_string())?;
    *current = None;

    Ok(())
}

/// Get available snap zones with coordinates for the current monitor
#[tauri::command]
pub async fn snap_get_zones(
    window: WebviewWindow,
    state: tauri::State<'_, WindowSnapManager>,
) -> Result<Vec<ZoneDefinition>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let gap = config.gap as f64;
    drop(config);

    let monitor = window.current_monitor().map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;
    let scale = monitor.scale_factor();
    let mon_pos = monitor.position();
    let mon_size = monitor.size();
    let mon_x = mon_pos.x as f64 / scale;
    let mon_y = mon_pos.y as f64 / scale;
    let mon_w = mon_size.width as f64 / scale;
    let mon_h = mon_size.height as f64 / scale;

    let zones = SnapZone::all_zones();
    let definitions: Vec<ZoneDefinition> = zones
        .iter()
        .map(|z| {
            let (x, y, w, h) = zone_rect(z, mon_x, mon_y, mon_w, mon_h, gap);
            let label = match z {
                SnapZone::Left => "Left Half",
                SnapZone::Right => "Right Half",
                SnapZone::TopLeft => "Top Left",
                SnapZone::TopRight => "Top Right",
                SnapZone::BottomLeft => "Bottom Left",
                SnapZone::BottomRight => "Bottom Right",
                SnapZone::Top => "Maximize",
                SnapZone::Center => "Center",
            };
            ZoneDefinition {
                zone: *z,
                x,
                y,
                width: w,
                height: h,
                label: label.to_string(),
            }
        })
        .collect();

    Ok(definitions)
}

/// Get current snap configuration
#[tauri::command]
pub async fn snap_get_config(
    state: tauri::State<'_, WindowSnapManager>,
) -> Result<SnapConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

/// Update snap configuration
#[tauri::command]
pub async fn snap_set_config(
    state: tauri::State<'_, WindowSnapManager>,
    config: SnapConfig,
) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
    Ok(())
}

/// Check if the window is currently snapped
#[tauri::command]
pub async fn snap_is_snapped(
    state: tauri::State<'_, WindowSnapManager>,
) -> Result<bool, String> {
    let current = state.current_zone.lock().map_err(|e| e.to_string())?;
    Ok(current.is_some())
}

/// Get full snap state (zone + original bounds)
#[tauri::command]
pub async fn snap_get_state(
    state: tauri::State<'_, WindowSnapManager>,
) -> Result<SnapState, String> {
    let zone = state.current_zone.lock().map_err(|e| e.to_string())?;
    let bounds = state.original_bounds.lock().map_err(|e| e.to_string())?;

    Ok(SnapState {
        is_snapped: zone.is_some(),
        current_zone: zone.clone(),
        original_bounds: bounds.clone(),
    })
}

/// Cycle through snap zones in a direction
#[tauri::command]
pub async fn snap_cycle_zone(
    window: WebviewWindow,
    state: tauri::State<'_, WindowSnapManager>,
    direction: CycleDirection,
) -> Result<SnapZone, String> {
    let zones = SnapZone::all_zones();
    let total = zones.len();

    let current = state.current_zone.lock().map_err(|e| e.to_string())?;
    let current_idx = current.map(|z| z.cycle_index()).unwrap_or(0);
    drop(current);

    let next_idx = match direction {
        CycleDirection::Next => (current_idx + 1) % total,
        CycleDirection::Prev => {
            if current_idx == 0 {
                total - 1
            } else {
                current_idx - 1
            }
        }
    };

    let next_zone = zones[next_idx];

    // Reuse snap_window logic inline to avoid borrow issues
    let config = state.config.lock().map_err(|e| e.to_string())?;
    if !config.enabled {
        return Err("Window snapping is disabled".into());
    }
    let gap = config.gap as f64;
    drop(config);

    // Save original bounds if not already saved
    {
        let mut orig = state.original_bounds.lock().map_err(|e| e.to_string())?;
        if orig.is_none() {
            let pos = window.outer_position().map_err(|e| e.to_string())?;
            let size = window.outer_size().map_err(|e| e.to_string())?;
            let scale = window.scale_factor().map_err(|e| e.to_string())?;
            *orig = Some(WindowBounds {
                x: pos.x as f64 / scale,
                y: pos.y as f64 / scale,
                width: size.width as f64 / scale,
                height: size.height as f64 / scale,
            });
        }
    }

    let monitor = window.current_monitor().map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;
    let scale = monitor.scale_factor();
    let mon_pos = monitor.position();
    let mon_size = monitor.size();
    let mon_x = mon_pos.x as f64 / scale;
    let mon_y = mon_pos.y as f64 / scale;
    let mon_w = mon_size.width as f64 / scale;
    let mon_h = mon_size.height as f64 / scale;

    let (x, y, w, h) = zone_rect(&next_zone, mon_x, mon_y, mon_w, mon_h, gap);

    window
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::LogicalSize::new(w, h))
        .map_err(|e| e.to_string())?;

    {
        let mut current_zone = state.current_zone.lock().map_err(|e| e.to_string())?;
        *current_zone = Some(next_zone);
    }

    Ok(next_zone)
}

/// Move window to a specific monitor by index
#[tauri::command]
pub async fn snap_to_monitor(
    window: WebviewWindow,
    monitor_index: usize,
) -> Result<(), String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let monitor = monitors
        .get(monitor_index)
        .ok_or_else(|| format!("Monitor index {} out of range ({})", monitor_index, monitors.len()))?;

    let scale = monitor.scale_factor();
    let mon_pos = monitor.position();
    let mon_size = monitor.size();

    // Center the window on the target monitor
    let win_size = window.outer_size().map_err(|e| e.to_string())?;
    let win_w = win_size.width as f64 / scale;
    let win_h = win_size.height as f64 / scale;
    let mon_x = mon_pos.x as f64 / scale;
    let mon_y = mon_pos.y as f64 / scale;
    let mon_w = mon_size.width as f64 / scale;
    let mon_h = mon_size.height as f64 / scale;

    let x = mon_x + (mon_w - win_w) / 2.0;
    let y = mon_y + (mon_h - win_h) / 2.0;

    window
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Cascade position: offset window slightly for stacking effect
#[tauri::command]
pub async fn snap_cascade(window: WebviewWindow) -> Result<(), String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let offset = 30.0;

    let new_x = pos.x as f64 / scale + offset;
    let new_y = pos.y as f64 / scale + offset;

    window
        .set_position(tauri::LogicalPosition::new(new_x, new_y))
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// List available monitors with dimensions
#[tauri::command]
pub async fn snap_get_monitors(window: WebviewWindow) -> Result<Vec<MonitorInfo>, String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let current = window.current_monitor().map_err(|e| e.to_string())?;
    let empty_name = String::new();
    let current_name = current.map(|m| m.name().unwrap_or(&empty_name).to_string());

    let infos: Vec<MonitorInfo> = monitors
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let pos = m.position();
            let size = m.size();
            let name = m.name().unwrap_or(&empty_name).to_string();
            let is_primary = current_name.as_deref() == Some(&name) && i == 0;
            MonitorInfo {
                index: i,
                name,
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                scale_factor: m.scale_factor(),
                is_primary,
            }
        })
        .collect();

    Ok(infos)
}

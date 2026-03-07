//! PiP Gallery - manage multiple picture-in-picture windows
//!
//! Tracks and controls multiple floating PiP windows with position,
//! size, opacity, and always-on-top state. Supports auto-arranging
//! windows in a grid layout.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

static PIP_GALLERY: Mutex<Option<Vec<GalleryPipWindow>>> = Mutex::new(None);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PipSourceType {
    Channel,
    Voice,
    Media,
}

impl Default for PipSourceType {
    fn default() -> Self {
        Self::Media
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GalleryPipWindow {
    pub id: String,
    pub title: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub opacity: f64,
    pub always_on_top: bool,
    pub visible: bool,
    pub source_type: PipSourceType,
}

fn get_windows() -> Vec<GalleryPipWindow> {
    PIP_GALLERY.lock().unwrap().clone().unwrap_or_default()
}

fn set_windows(windows: Vec<GalleryPipWindow>) {
    let mut guard = PIP_GALLERY.lock().unwrap();
    *guard = Some(windows);
}

/// List all PiP gallery windows
#[tauri::command]
pub fn gallery_get_windows() -> Vec<GalleryPipWindow> {
    get_windows()
}

/// Create a new PiP gallery window and return it
#[tauri::command]
pub fn gallery_create_window(
    title: String,
    source_type: PipSourceType,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
) -> GalleryPipWindow {
    let mut windows = get_windows();

    let offset = (windows.len() as f64) * 30.0;
    let window = GalleryPipWindow {
        id: Uuid::new_v4().to_string(),
        title,
        x: x.unwrap_or(100.0 + offset),
        y: y.unwrap_or(100.0 + offset),
        width: width.unwrap_or(320.0),
        height: height.unwrap_or(240.0),
        opacity: 1.0,
        always_on_top: true,
        visible: true,
        source_type,
    };

    windows.push(window.clone());
    set_windows(windows);
    window
}

/// Close (remove) a PiP gallery window by ID
#[tauri::command]
pub fn gallery_close_window(id: String) -> Result<(), String> {
    let mut windows = get_windows();
    let before = windows.len();
    windows.retain(|w| w.id != id);
    if windows.len() == before {
        return Err(format!("PiP window {} not found", id));
    }
    set_windows(windows);
    Ok(())
}

/// Update position and size of a PiP gallery window
#[tauri::command]
pub fn gallery_update_position(
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<GalleryPipWindow, String> {
    let mut windows = get_windows();
    let win = windows
        .iter_mut()
        .find(|w| w.id == id)
        .ok_or_else(|| format!("PiP window {} not found", id))?;

    win.x = x;
    win.y = y;
    win.width = width;
    win.height = height;

    let result = win.clone();
    set_windows(windows);
    Ok(result)
}

/// Set the opacity of a PiP gallery window (0.1 - 1.0)
#[tauri::command]
pub fn gallery_set_opacity(id: String, opacity: f64) -> Result<GalleryPipWindow, String> {
    let opacity = opacity.clamp(0.1, 1.0);
    let mut windows = get_windows();
    let win = windows
        .iter_mut()
        .find(|w| w.id == id)
        .ok_or_else(|| format!("PiP window {} not found", id))?;

    win.opacity = opacity;

    let result = win.clone();
    set_windows(windows);
    Ok(result)
}

/// Toggle always-on-top for a PiP gallery window
#[tauri::command]
pub fn gallery_toggle_always_on_top(id: String) -> Result<GalleryPipWindow, String> {
    let mut windows = get_windows();
    let win = windows
        .iter_mut()
        .find(|w| w.id == id)
        .ok_or_else(|| format!("PiP window {} not found", id))?;

    win.always_on_top = !win.always_on_top;

    let result = win.clone();
    set_windows(windows);
    Ok(result)
}

/// Arrange all visible PiP gallery windows in a grid pattern
#[tauri::command]
pub fn gallery_arrange_grid(
    screen_width: Option<f64>,
    screen_height: Option<f64>,
    padding: Option<f64>,
) -> Vec<GalleryPipWindow> {
    let mut windows = get_windows();
    let visible: Vec<usize> = windows
        .iter()
        .enumerate()
        .filter(|(_, w)| w.visible)
        .map(|(i, _)| i)
        .collect();

    if visible.is_empty() {
        return windows;
    }

    let sw = screen_width.unwrap_or(1920.0);
    let sh = screen_height.unwrap_or(1080.0);
    let pad = padding.unwrap_or(16.0);

    let count = visible.len();
    let cols = (count as f64).sqrt().ceil() as usize;
    let rows = (count + cols - 1) / cols;

    let cell_w = (sw - pad * (cols as f64 + 1.0)) / cols as f64;
    let cell_h = (sh - pad * (rows as f64 + 1.0)) / rows as f64;

    let win_w = cell_w.min(480.0);
    let win_h = cell_h.min(360.0);

    for (seq, &idx) in visible.iter().enumerate() {
        let col = seq % cols;
        let row = seq / cols;
        let x = pad + col as f64 * (win_w + pad);
        let y = pad + row as f64 * (win_h + pad);

        windows[idx].x = x;
        windows[idx].y = y;
        windows[idx].width = win_w;
        windows[idx].height = win_h;
    }

    set_windows(windows.clone());
    windows
}

/// Close all PiP gallery windows
#[tauri::command]
pub fn gallery_close_all() {
    set_windows(Vec::new());
}

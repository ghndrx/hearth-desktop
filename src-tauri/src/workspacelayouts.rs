//! Workspace Layouts Manager - Save and restore window arrangements,
//! panel configurations, and sidebar states.
//!
//! Provides in-memory layout storage so users can quickly switch
//! between different workspace configurations.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelConfig {
    pub panel_type: String,
    pub width: f64,
    pub is_pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLayout {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub window_x: f64,
    pub window_y: f64,
    pub window_width: f64,
    pub window_height: f64,
    pub is_maximized: bool,
    pub is_fullscreen: bool,
    pub sidebar_visible: bool,
    pub sidebar_width: f64,
    pub member_list_visible: bool,
    pub member_list_width: f64,
    pub split_view_enabled: bool,
    pub split_view_panels: Vec<PanelConfig>,
    pub active_server_id: Option<String>,
    pub active_channel_id: Option<String>,
    pub zen_mode: bool,
    pub theme_override: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub is_default: bool,
    pub keyboard_shortcut: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutPreset {
    pub id: String,
    pub name: String,
    pub category: String,
    pub layout: WorkspaceLayout,
}

pub struct WorkspaceLayoutManager {
    layouts: Mutex<Vec<WorkspaceLayout>>,
    active_layout_id: Mutex<Option<String>>,
}

impl Default for WorkspaceLayoutManager {
    fn default() -> Self {
        Self {
            layouts: Mutex::new(Vec::new()),
            active_layout_id: Mutex::new(None),
        }
    }
}

impl WorkspaceLayoutManager {
    pub fn new() -> Self {
        Self::default()
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub fn layout_save(
    app: AppHandle,
    state: State<'_, WorkspaceLayoutManager>,
    layout: WorkspaceLayout,
) -> Result<WorkspaceLayout, String> {
    let mut layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    let now = now_ms();

    let mut saved = layout.clone();
    if saved.id.is_empty() {
        saved.id = uuid::Uuid::new_v4().to_string();
    }
    saved.created_at = now;
    saved.updated_at = now;

    // Update existing or insert new
    if let Some(existing) = layouts.iter_mut().find(|l| l.id == saved.id) {
        saved.created_at = existing.created_at;
        *existing = saved.clone();
    } else {
        layouts.push(saved.clone());
    }

    let _ = app.emit("layout:saved", &saved);
    Ok(saved)
}

#[tauri::command]
pub fn layout_load(
    app: AppHandle,
    state: State<'_, WorkspaceLayoutManager>,
    id: String,
) -> Result<WorkspaceLayout, String> {
    let layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    let layout = layouts
        .iter()
        .find(|l| l.id == id)
        .cloned()
        .ok_or_else(|| format!("Layout not found: {}", id))?;

    let mut active = state.active_layout_id.lock().map_err(|e| e.to_string())?;
    *active = Some(id);

    let _ = app.emit("layout:applied", &layout);
    Ok(layout)
}

#[tauri::command]
pub fn layout_delete(
    app: AppHandle,
    state: State<'_, WorkspaceLayoutManager>,
    id: String,
) -> Result<bool, String> {
    let mut layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    let len_before = layouts.len();
    layouts.retain(|l| l.id != id);
    let removed = layouts.len() < len_before;

    if removed {
        // Clear active if it was the deleted layout
        let mut active = state.active_layout_id.lock().map_err(|e| e.to_string())?;
        if active.as_deref() == Some(&id) {
            *active = None;
        }
        let _ = app.emit("layout:deleted", &id);
    }

    Ok(removed)
}

#[tauri::command]
pub fn layout_rename(
    app: AppHandle,
    state: State<'_, WorkspaceLayoutManager>,
    id: String,
    name: String,
) -> Result<bool, String> {
    let mut layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    if let Some(layout) = layouts.iter_mut().find(|l| l.id == id) {
        layout.name = name;
        layout.updated_at = now_ms();
        let _ = app.emit("layout:saved", &*layout);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn layout_get_all(
    state: State<'_, WorkspaceLayoutManager>,
) -> Result<Vec<WorkspaceLayout>, String> {
    let layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    Ok(layouts.clone())
}

#[tauri::command]
pub fn layout_get_active(
    state: State<'_, WorkspaceLayoutManager>,
) -> Result<Option<WorkspaceLayout>, String> {
    let active = state.active_layout_id.lock().map_err(|e| e.to_string())?;
    if let Some(ref active_id) = *active {
        let layouts = state.layouts.lock().map_err(|e| e.to_string())?;
        Ok(layouts.iter().find(|l| l.id == *active_id).cloned())
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn layout_set_default(
    app: AppHandle,
    state: State<'_, WorkspaceLayoutManager>,
    id: String,
) -> Result<bool, String> {
    let mut layouts = state.layouts.lock().map_err(|e| e.to_string())?;

    // Clear any existing default
    for layout in layouts.iter_mut() {
        layout.is_default = false;
    }

    if let Some(layout) = layouts.iter_mut().find(|l| l.id == id) {
        layout.is_default = true;
        layout.updated_at = now_ms();
        let _ = app.emit("layout:saved", &*layout);
        Ok(true)
    } else {
        Ok(false)
    }
}

fn make_preset_layout(name: &str, description: &str) -> WorkspaceLayout {
    let now = now_ms();
    let base = WorkspaceLayout {
        id: String::new(),
        name: name.to_string(),
        description: Some(description.to_string()),
        window_x: 0.0,
        window_y: 0.0,
        window_width: 1280.0,
        window_height: 720.0,
        is_maximized: false,
        is_fullscreen: false,
        sidebar_visible: true,
        sidebar_width: 240.0,
        member_list_visible: true,
        member_list_width: 240.0,
        split_view_enabled: false,
        split_view_panels: Vec::new(),
        active_server_id: None,
        active_channel_id: None,
        zen_mode: false,
        theme_override: None,
        created_at: now,
        updated_at: now,
        is_default: false,
        keyboard_shortcut: None,
    };
    base
}

#[tauri::command]
pub fn layout_get_presets() -> Result<Vec<LayoutPreset>, String> {
    let mut presets = Vec::new();

    // Focused preset
    let mut focused = make_preset_layout(
        "Focused",
        "Minimal distractions for deep work",
    );
    focused.id = "preset-focused".to_string();
    focused.sidebar_visible = false;
    focused.member_list_visible = false;
    focused.zen_mode = true;
    focused.is_maximized = true;
    presets.push(LayoutPreset {
        id: "preset-focused".to_string(),
        name: "Focused".to_string(),
        category: "Productivity".to_string(),
        layout: focused,
    });

    // Collaborative preset
    let mut collaborative = make_preset_layout(
        "Collaborative",
        "Full visibility for team collaboration",
    );
    collaborative.id = "preset-collaborative".to_string();
    collaborative.sidebar_visible = true;
    collaborative.sidebar_width = 260.0;
    collaborative.member_list_visible = true;
    collaborative.member_list_width = 260.0;
    collaborative.split_view_enabled = true;
    collaborative.split_view_panels = vec![
        PanelConfig {
            panel_type: "chat".to_string(),
            width: 60.0,
            is_pinned: true,
        },
        PanelConfig {
            panel_type: "threads".to_string(),
            width: 40.0,
            is_pinned: false,
        },
    ];
    collaborative.is_maximized = true;
    presets.push(LayoutPreset {
        id: "preset-collaborative".to_string(),
        name: "Collaborative".to_string(),
        category: "Communication".to_string(),
        layout: collaborative,
    });

    // Minimal preset
    let mut minimal = make_preset_layout(
        "Minimal",
        "Clean and compact interface",
    );
    minimal.id = "preset-minimal".to_string();
    minimal.sidebar_visible = true;
    minimal.sidebar_width = 200.0;
    minimal.member_list_visible = false;
    minimal.window_width = 900.0;
    minimal.window_height = 600.0;
    presets.push(LayoutPreset {
        id: "preset-minimal".to_string(),
        name: "Minimal".to_string(),
        category: "Minimal".to_string(),
        layout: minimal,
    });

    // Presentation preset
    let mut presentation = make_preset_layout(
        "Presentation",
        "Optimized for screen sharing and presentations",
    );
    presentation.id = "preset-presentation".to_string();
    presentation.sidebar_visible = false;
    presentation.member_list_visible = false;
    presentation.is_fullscreen = true;
    presentation.zen_mode = true;
    presentation.window_width = 1920.0;
    presentation.window_height = 1080.0;
    presets.push(LayoutPreset {
        id: "preset-presentation".to_string(),
        name: "Presentation".to_string(),
        category: "Productivity".to_string(),
        layout: presentation,
    });

    Ok(presets)
}

#[tauri::command]
pub fn layout_apply_preset(
    app: AppHandle,
    state: State<'_, WorkspaceLayoutManager>,
    preset_id: String,
) -> Result<WorkspaceLayout, String> {
    let presets = layout_get_presets()?;
    let preset = presets
        .iter()
        .find(|p| p.id == preset_id)
        .ok_or_else(|| format!("Preset not found: {}", preset_id))?;

    let mut layout = preset.layout.clone();
    layout.id = uuid::Uuid::new_v4().to_string();
    layout.created_at = now_ms();
    layout.updated_at = now_ms();

    let mut layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    layouts.push(layout.clone());

    let mut active = state.active_layout_id.lock().map_err(|e| e.to_string())?;
    *active = Some(layout.id.clone());

    let _ = app.emit("layout:applied", &layout);
    Ok(layout)
}

#[tauri::command]
pub fn layout_export(
    state: State<'_, WorkspaceLayoutManager>,
    id: String,
) -> Result<String, String> {
    let layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    let layout = layouts
        .iter()
        .find(|l| l.id == id)
        .ok_or_else(|| format!("Layout not found: {}", id))?;

    serde_json::to_string_pretty(layout).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn layout_import(
    app: AppHandle,
    state: State<'_, WorkspaceLayoutManager>,
    json: String,
) -> Result<WorkspaceLayout, String> {
    let mut layout: WorkspaceLayout =
        serde_json::from_str(&json).map_err(|e| format!("Invalid layout JSON: {}", e))?;

    // Assign a new ID to avoid collisions
    layout.id = uuid::Uuid::new_v4().to_string();
    layout.updated_at = now_ms();

    let mut layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    layouts.push(layout.clone());

    let _ = app.emit("layout:saved", &layout);
    Ok(layout)
}

#[tauri::command]
pub fn layout_duplicate(
    app: AppHandle,
    state: State<'_, WorkspaceLayoutManager>,
    id: String,
) -> Result<WorkspaceLayout, String> {
    let mut layouts = state.layouts.lock().map_err(|e| e.to_string())?;
    let source = layouts
        .iter()
        .find(|l| l.id == id)
        .cloned()
        .ok_or_else(|| format!("Layout not found: {}", id))?;

    let now = now_ms();
    let mut duplicate = source;
    duplicate.id = uuid::Uuid::new_v4().to_string();
    duplicate.name = format!("{} (Copy)", duplicate.name);
    duplicate.created_at = now;
    duplicate.updated_at = now;
    duplicate.is_default = false;

    layouts.push(duplicate.clone());

    let _ = app.emit("layout:saved", &duplicate);
    Ok(duplicate)
}

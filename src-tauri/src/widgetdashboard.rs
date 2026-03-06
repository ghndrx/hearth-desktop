//! Desktop Widget Dashboard - Configurable dashboard with pinnable widget tiles
//!
//! Manages an overview panel where users can arrange, pin, and configure
//! widgets such as clocks, system monitors, notes, calendars, and more.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardWidget {
    pub id: String,
    pub widget_type: String,
    pub title: String,
    pub position_x: u32,
    pub position_y: u32,
    pub width: u32,
    pub height: u32,
    pub is_visible: bool,
    pub is_pinned: bool,
    pub config: serde_json::Value,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardConfig {
    pub columns: u32,
    pub row_height: u32,
    pub gap: u32,
    pub show_header: bool,
    pub auto_refresh_interval_ms: u64,
    pub theme: String,
}

impl Default for DashboardConfig {
    fn default() -> Self {
        Self {
            columns: 4,
            row_height: 120,
            gap: 16,
            show_header: true,
            auto_refresh_interval_ms: 30000,
            theme: "default".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardState {
    pub widgets: Vec<DashboardWidget>,
    pub config: DashboardConfig,
    pub is_visible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableWidget {
    pub widget_type: String,
    pub label: String,
    pub description: String,
    pub default_width: u32,
    pub default_height: u32,
}

pub struct WidgetDashboardManager {
    state: Mutex<DashboardState>,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn default_widgets() -> Vec<DashboardWidget> {
    let ts = now_ms();
    vec![
        DashboardWidget {
            id: uuid::Uuid::new_v4().to_string(),
            widget_type: "clock".to_string(),
            title: "Clock".to_string(),
            position_x: 0,
            position_y: 0,
            width: 1,
            height: 1,
            is_visible: true,
            is_pinned: true,
            config: serde_json::json!({}),
            created_at: ts,
        },
        DashboardWidget {
            id: uuid::Uuid::new_v4().to_string(),
            widget_type: "system-monitor".to_string(),
            title: "System Monitor".to_string(),
            position_x: 1,
            position_y: 0,
            width: 2,
            height: 1,
            is_visible: true,
            is_pinned: true,
            config: serde_json::json!({}),
            created_at: ts,
        },
        DashboardWidget {
            id: uuid::Uuid::new_v4().to_string(),
            widget_type: "quick-notes".to_string(),
            title: "Quick Notes".to_string(),
            position_x: 3,
            position_y: 0,
            width: 1,
            height: 2,
            is_visible: true,
            is_pinned: true,
            config: serde_json::json!({}),
            created_at: ts,
        },
        DashboardWidget {
            id: uuid::Uuid::new_v4().to_string(),
            widget_type: "bookmarks".to_string(),
            title: "Bookmarks".to_string(),
            position_x: 0,
            position_y: 1,
            width: 2,
            height: 1,
            is_visible: true,
            is_pinned: true,
            config: serde_json::json!({}),
            created_at: ts,
        },
        DashboardWidget {
            id: uuid::Uuid::new_v4().to_string(),
            widget_type: "calendar".to_string(),
            title: "Calendar".to_string(),
            position_x: 2,
            position_y: 1,
            width: 1,
            height: 1,
            is_visible: true,
            is_pinned: true,
            config: serde_json::json!({}),
            created_at: ts,
        },
    ]
}

fn available_widget_types() -> Vec<AvailableWidget> {
    vec![
        AvailableWidget {
            widget_type: "clock".to_string(),
            label: "Clock".to_string(),
            description: "Displays the current time and date".to_string(),
            default_width: 1,
            default_height: 1,
        },
        AvailableWidget {
            widget_type: "pomodoro".to_string(),
            label: "Pomodoro Timer".to_string(),
            description: "Focus timer with work and break intervals".to_string(),
            default_width: 1,
            default_height: 1,
        },
        AvailableWidget {
            widget_type: "system-monitor".to_string(),
            label: "System Monitor".to_string(),
            description: "CPU, memory, and disk usage overview".to_string(),
            default_width: 2,
            default_height: 1,
        },
        AvailableWidget {
            widget_type: "quick-notes".to_string(),
            label: "Quick Notes".to_string(),
            description: "Scratchpad for quick text notes".to_string(),
            default_width: 1,
            default_height: 2,
        },
        AvailableWidget {
            widget_type: "calendar".to_string(),
            label: "Calendar".to_string(),
            description: "Mini calendar with event highlights".to_string(),
            default_width: 1,
            default_height: 1,
        },
        AvailableWidget {
            widget_type: "weather".to_string(),
            label: "Weather".to_string(),
            description: "Current weather conditions and forecast".to_string(),
            default_width: 1,
            default_height: 1,
        },
        AvailableWidget {
            widget_type: "bookmarks".to_string(),
            label: "Bookmarks".to_string(),
            description: "Quick access to saved bookmarks".to_string(),
            default_width: 2,
            default_height: 1,
        },
        AvailableWidget {
            widget_type: "kanban".to_string(),
            label: "Kanban Board".to_string(),
            description: "Task board with columns and cards".to_string(),
            default_width: 2,
            default_height: 2,
        },
        AvailableWidget {
            widget_type: "voice-memos".to_string(),
            label: "Voice Memos".to_string(),
            description: "Record and play back voice memos".to_string(),
            default_width: 1,
            default_height: 1,
        },
        AvailableWidget {
            widget_type: "file-index".to_string(),
            label: "File Index".to_string(),
            description: "Browse and search indexed files".to_string(),
            default_width: 2,
            default_height: 1,
        },
    ]
}

impl WidgetDashboardManager {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(DashboardState {
                widgets: default_widgets(),
                config: DashboardConfig::default(),
                is_visible: false,
            }),
        }
    }
}

#[tauri::command]
pub fn dashboard_get_state(
    state: State<'_, WidgetDashboardManager>,
) -> Result<DashboardState, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    Ok(s.clone())
}

#[tauri::command]
pub fn dashboard_set_visible(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    visible: bool,
) -> Result<bool, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.is_visible = visible;
    let _ = app.emit("dashboard:visibility-changed", visible);
    Ok(visible)
}

#[tauri::command]
pub fn dashboard_toggle_visible(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
) -> Result<bool, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.is_visible = !s.is_visible;
    let visible = s.is_visible;
    let _ = app.emit("dashboard:visibility-changed", visible);
    Ok(visible)
}

#[tauri::command]
pub fn dashboard_add_widget(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    widget_type: String,
    title: String,
    position_x: u32,
    position_y: u32,
    width: u32,
    height: u32,
    config: Option<serde_json::Value>,
) -> Result<DashboardWidget, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let widget = DashboardWidget {
        id: uuid::Uuid::new_v4().to_string(),
        widget_type,
        title,
        position_x,
        position_y,
        width,
        height,
        is_visible: true,
        is_pinned: false,
        config: config.unwrap_or(serde_json::json!({})),
        created_at: now_ms(),
    };
    s.widgets.push(widget.clone());
    let _ = app.emit("dashboard:widget-added", &widget);
    Ok(widget)
}

#[tauri::command]
pub fn dashboard_remove_widget(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    id: String,
) -> Result<bool, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let len_before = s.widgets.len();
    s.widgets.retain(|w| w.id != id);
    let removed = s.widgets.len() < len_before;
    if removed {
        let _ = app.emit("dashboard:widget-removed", &id);
    }
    Ok(removed)
}

#[tauri::command]
pub fn dashboard_update_widget(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    id: String,
    title: Option<String>,
    is_visible: Option<bool>,
    config: Option<serde_json::Value>,
) -> Result<Option<DashboardWidget>, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let widget = s.widgets.iter_mut().find(|w| w.id == id);
    match widget {
        Some(w) => {
            if let Some(t) = title {
                w.title = t;
            }
            if let Some(v) = is_visible {
                w.is_visible = v;
            }
            if let Some(c) = config {
                w.config = c;
            }
            let updated = w.clone();
            let _ = app.emit("dashboard:layout-changed", &updated);
            Ok(Some(updated))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn dashboard_move_widget(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    id: String,
    position_x: u32,
    position_y: u32,
) -> Result<Option<DashboardWidget>, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let widget = s.widgets.iter_mut().find(|w| w.id == id);
    match widget {
        Some(w) => {
            w.position_x = position_x;
            w.position_y = position_y;
            let updated = w.clone();
            let _ = app.emit("dashboard:layout-changed", &updated);
            Ok(Some(updated))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn dashboard_resize_widget(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    id: String,
    width: u32,
    height: u32,
) -> Result<Option<DashboardWidget>, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let widget = s.widgets.iter_mut().find(|w| w.id == id);
    match widget {
        Some(w) => {
            w.width = width;
            w.height = height;
            let updated = w.clone();
            let _ = app.emit("dashboard:layout-changed", &updated);
            Ok(Some(updated))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn dashboard_toggle_widget_pin(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    id: String,
) -> Result<Option<bool>, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let widget = s.widgets.iter_mut().find(|w| w.id == id);
    match widget {
        Some(w) => {
            w.is_pinned = !w.is_pinned;
            let pinned = w.is_pinned;
            let updated = w.clone();
            let _ = app.emit("dashboard:layout-changed", &updated);
            Ok(Some(pinned))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn dashboard_get_config(
    state: State<'_, WidgetDashboardManager>,
) -> Result<DashboardConfig, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    Ok(s.config.clone())
}

#[tauri::command]
pub fn dashboard_set_config(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    columns: Option<u32>,
    row_height: Option<u32>,
    gap: Option<u32>,
    show_header: Option<bool>,
    auto_refresh_interval_ms: Option<u64>,
    theme: Option<String>,
) -> Result<DashboardConfig, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    if let Some(v) = columns {
        s.config.columns = v;
    }
    if let Some(v) = row_height {
        s.config.row_height = v;
    }
    if let Some(v) = gap {
        s.config.gap = v;
    }
    if let Some(v) = show_header {
        s.config.show_header = v;
    }
    if let Some(v) = auto_refresh_interval_ms {
        s.config.auto_refresh_interval_ms = v;
    }
    if let Some(v) = theme {
        s.config.theme = v;
    }
    let config = s.config.clone();
    let _ = app.emit("dashboard:layout-changed", &config);
    Ok(config)
}

#[tauri::command]
pub fn dashboard_reset(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
) -> Result<DashboardState, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.widgets = default_widgets();
    s.config = DashboardConfig::default();
    let snapshot = s.clone();
    let _ = app.emit("dashboard:layout-changed", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn dashboard_get_available_widgets() -> Result<Vec<AvailableWidget>, String> {
    Ok(available_widget_types())
}

#[tauri::command]
pub fn dashboard_export(
    state: State<'_, WidgetDashboardManager>,
) -> Result<serde_json::Value, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    serde_json::to_value(&*s).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn dashboard_import(
    app: AppHandle,
    state: State<'_, WidgetDashboardManager>,
    data: serde_json::Value,
) -> Result<DashboardState, String> {
    let imported: DashboardState =
        serde_json::from_value(data).map_err(|e| e.to_string())?;
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    s.widgets = imported.widgets;
    s.config = imported.config;
    s.is_visible = imported.is_visible;
    let snapshot = s.clone();
    let _ = app.emit("dashboard:layout-changed", &snapshot);
    Ok(snapshot)
}

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Represents a configurable tray menu item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenuItem {
    pub id: String,
    pub label: String,
    pub category: String,
    pub visible: bool,
    pub order: u32,
}

/// User preferences for tray customization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayCustomizerConfig {
    pub items: Vec<TrayMenuItem>,
    pub show_unread_badge: bool,
    pub show_status_in_tooltip: bool,
    pub compact_mode: bool,
}

impl Default for TrayCustomizerConfig {
    fn default() -> Self {
        Self {
            items: vec![
                TrayMenuItem { id: "show".into(), label: "Show App".into(), category: "window".into(), visible: true, order: 0 },
                TrayMenuItem { id: "hide".into(), label: "Hide".into(), category: "window".into(), visible: true, order: 1 },
                TrayMenuItem { id: "quick_capture".into(), label: "Quick Capture".into(), category: "actions".into(), visible: true, order: 2 },
                TrayMenuItem { id: "settings".into(), label: "Settings".into(), category: "window".into(), visible: true, order: 3 },
                TrayMenuItem { id: "status_submenu".into(), label: "Status".into(), category: "status".into(), visible: true, order: 4 },
                TrayMenuItem { id: "recent_channels".into(), label: "Recent Channels".into(), category: "navigation".into(), visible: true, order: 5 },
                TrayMenuItem { id: "toggle_mute".into(), label: "Mute Notifications".into(), category: "notifications".into(), visible: true, order: 6 },
                TrayMenuItem { id: "toggle_focus".into(), label: "Focus Mode".into(), category: "notifications".into(), visible: true, order: 7 },
                TrayMenuItem { id: "snooze_submenu".into(), label: "Snooze Notifications".into(), category: "notifications".into(), visible: true, order: 8 },
                TrayMenuItem { id: "pomodoro_submenu".into(), label: "Pomodoro Timer".into(), category: "productivity".into(), visible: true, order: 9 },
                TrayMenuItem { id: "quick_timer".into(), label: "Quick Timer".into(), category: "productivity".into(), visible: true, order: 10 },
                TrayMenuItem { id: "toggle_privacy".into(), label: "Privacy Mode".into(), category: "privacy".into(), visible: true, order: 11 },
                TrayMenuItem { id: "check_updates".into(), label: "Check for Updates".into(), category: "system".into(), visible: true, order: 12 },
            ],
            show_unread_badge: true,
            show_status_in_tooltip: true,
            compact_mode: false,
        }
    }
}

pub struct TrayCustomizerManager {
    config: Mutex<TrayCustomizerConfig>,
}

impl Default for TrayCustomizerManager {
    fn default() -> Self {
        Self {
            config: Mutex::new(TrayCustomizerConfig::default()),
        }
    }
}

#[tauri::command]
pub fn tray_customizer_get_config(
    state: tauri::State<'_, TrayCustomizerManager>,
) -> Result<TrayCustomizerConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn tray_customizer_set_item_visible(
    state: tauri::State<'_, TrayCustomizerManager>,
    item_id: String,
    visible: bool,
) -> Result<TrayCustomizerConfig, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    if let Some(item) = config.items.iter_mut().find(|i| i.id == item_id) {
        item.visible = visible;
    }
    Ok(config.clone())
}

#[tauri::command]
pub fn tray_customizer_reorder_items(
    state: tauri::State<'_, TrayCustomizerManager>,
    item_ids: Vec<String>,
) -> Result<TrayCustomizerConfig, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    for (new_order, id) in item_ids.iter().enumerate() {
        if let Some(item) = config.items.iter_mut().find(|i| &i.id == id) {
            item.order = new_order as u32;
        }
    }
    config.items.sort_by_key(|i| i.order);
    Ok(config.clone())
}

#[tauri::command]
pub fn tray_customizer_set_badge_visible(
    state: tauri::State<'_, TrayCustomizerManager>,
    visible: bool,
) -> Result<TrayCustomizerConfig, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.show_unread_badge = visible;
    Ok(config.clone())
}

#[tauri::command]
pub fn tray_customizer_set_status_tooltip(
    state: tauri::State<'_, TrayCustomizerManager>,
    enabled: bool,
) -> Result<TrayCustomizerConfig, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.show_status_in_tooltip = enabled;
    Ok(config.clone())
}

#[tauri::command]
pub fn tray_customizer_set_compact_mode(
    state: tauri::State<'_, TrayCustomizerManager>,
    compact: bool,
) -> Result<TrayCustomizerConfig, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.compact_mode = compact;
    Ok(config.clone())
}

#[tauri::command]
pub fn tray_customizer_reset(
    state: tauri::State<'_, TrayCustomizerManager>,
) -> Result<TrayCustomizerConfig, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    *config = TrayCustomizerConfig::default();
    Ok(config.clone())
}

#[tauri::command]
pub fn tray_customizer_get_categories(
    state: tauri::State<'_, TrayCustomizerManager>,
) -> Result<Vec<String>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let mut cats: Vec<String> = config.items.iter().map(|i| i.category.clone()).collect();
    cats.sort();
    cats.dedup();
    Ok(cats)
}

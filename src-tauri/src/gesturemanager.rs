use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GestureConfig {
    pub enabled: bool,
    pub sensitivity: f64,
    pub gestures: Vec<GestureBinding>,
    pub inertia_enabled: bool,
    pub visual_feedback: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GestureBinding {
    pub gesture_type: GestureType,
    pub action: GestureAction,
    pub fingers: u8,
    pub enabled: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GestureType {
    SwipeLeft,
    SwipeRight,
    SwipeUp,
    SwipeDown,
    PinchIn,
    PinchOut,
    RotateClockwise,
    RotateCounterClockwise,
    DoubleTap,
    LongPress,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GestureAction {
    NavigateBack,
    NavigateForward,
    SwitchChannelUp,
    SwitchChannelDown,
    SwitchServerUp,
    SwitchServerDown,
    ToggleSidebar,
    ToggleMemberList,
    ZoomIn,
    ZoomOut,
    ToggleMute,
    ToggleDeafen,
    OpenSearch,
    ClosePanel,
    ScrollToBottom,
    ScrollToTop,
    ToggleFullscreen,
    ToggleMiniMode,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GestureEvent {
    pub gesture_type: GestureType,
    pub fingers: u8,
    pub delta_x: f64,
    pub delta_y: f64,
    pub scale: f64,
    pub rotation: f64,
    pub velocity: f64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GestureStats {
    pub total_gestures: u64,
    pub gestures_by_type: std::collections::HashMap<String, u64>,
    pub most_used_action: Option<String>,
    pub session_start: u64,
}

impl Default for GestureConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            sensitivity: 1.0,
            gestures: vec![
                GestureBinding {
                    gesture_type: GestureType::SwipeLeft,
                    action: GestureAction::NavigateBack,
                    fingers: 2,
                    enabled: true,
                    description: "Navigate back".to_string(),
                },
                GestureBinding {
                    gesture_type: GestureType::SwipeRight,
                    action: GestureAction::NavigateForward,
                    fingers: 2,
                    enabled: true,
                    description: "Navigate forward".to_string(),
                },
                GestureBinding {
                    gesture_type: GestureType::SwipeUp,
                    action: GestureAction::SwitchChannelUp,
                    fingers: 3,
                    enabled: true,
                    description: "Switch to previous channel".to_string(),
                },
                GestureBinding {
                    gesture_type: GestureType::SwipeDown,
                    action: GestureAction::SwitchChannelDown,
                    fingers: 3,
                    enabled: true,
                    description: "Switch to next channel".to_string(),
                },
                GestureBinding {
                    gesture_type: GestureType::PinchIn,
                    action: GestureAction::ZoomOut,
                    fingers: 2,
                    enabled: true,
                    description: "Zoom out / decrease text size".to_string(),
                },
                GestureBinding {
                    gesture_type: GestureType::PinchOut,
                    action: GestureAction::ZoomIn,
                    fingers: 2,
                    enabled: true,
                    description: "Zoom in / increase text size".to_string(),
                },
                GestureBinding {
                    gesture_type: GestureType::SwipeLeft,
                    action: GestureAction::ToggleMemberList,
                    fingers: 3,
                    enabled: true,
                    description: "Toggle member list".to_string(),
                },
                GestureBinding {
                    gesture_type: GestureType::SwipeRight,
                    action: GestureAction::ToggleSidebar,
                    fingers: 3,
                    enabled: true,
                    description: "Toggle sidebar".to_string(),
                },
                GestureBinding {
                    gesture_type: GestureType::DoubleTap,
                    action: GestureAction::ToggleMute,
                    fingers: 3,
                    enabled: false,
                    description: "Toggle microphone mute".to_string(),
                },
            ],
            inertia_enabled: true,
            visual_feedback: true,
        }
    }
}

#[derive(Debug)]
pub struct GestureManagerState {
    pub config: Mutex<GestureConfig>,
    pub stats: Mutex<GestureStats>,
}

impl Default for GestureManagerState {
    fn default() -> Self {
        Self {
            config: Mutex::new(GestureConfig::default()),
            stats: Mutex::new(GestureStats {
                total_gestures: 0,
                gestures_by_type: std::collections::HashMap::new(),
                most_used_action: None,
                session_start: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            }),
        }
    }
}

#[tauri::command]
pub fn gesture_get_config(
    state: tauri::State<'_, GestureManagerState>,
) -> Result<GestureConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn gesture_update_config(
    state: tauri::State<'_, GestureManagerState>,
    config: GestureConfig,
) -> Result<GestureConfig, String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config.clone();
    Ok(config)
}

#[tauri::command]
pub fn gesture_set_enabled(
    state: tauri::State<'_, GestureManagerState>,
    enabled: bool,
) -> Result<bool, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.enabled = enabled;
    Ok(enabled)
}

#[tauri::command]
pub fn gesture_set_sensitivity(
    state: tauri::State<'_, GestureManagerState>,
    sensitivity: f64,
) -> Result<f64, String> {
    if !(0.1..=3.0).contains(&sensitivity) {
        return Err("Sensitivity must be between 0.1 and 3.0".to_string());
    }
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.sensitivity = sensitivity;
    Ok(sensitivity)
}

#[tauri::command]
pub fn gesture_resolve_action(
    state: tauri::State<'_, GestureManagerState>,
    event: GestureEvent,
) -> Result<Option<GestureAction>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    if !config.enabled {
        return Ok(None);
    }

    let threshold = 50.0 * (1.0 / config.sensitivity);
    let velocity_min = 0.3 / config.sensitivity;

    if event.velocity < velocity_min {
        return Ok(None);
    }

    let matching = config.gestures.iter().find(|g| {
        g.enabled
            && g.gesture_type == event.gesture_type
            && g.fingers == event.fingers
    });

    if let Some(binding) = matching {
        let magnitude = (event.delta_x.powi(2) + event.delta_y.powi(2)).sqrt();
        if magnitude >= threshold || matches!(event.gesture_type, GestureType::PinchIn | GestureType::PinchOut | GestureType::DoubleTap | GestureType::LongPress) {
            // Record stats
            if let Ok(mut stats) = state.stats.lock() {
                stats.total_gestures += 1;
                let type_key = format!("{:?}", event.gesture_type);
                *stats.gestures_by_type.entry(type_key).or_insert(0) += 1;
            }
            return Ok(Some(binding.action.clone()));
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn gesture_get_stats(
    state: tauri::State<'_, GestureManagerState>,
) -> Result<GestureStats, String> {
    let stats = state.stats.lock().map_err(|e| e.to_string())?;
    Ok(stats.clone())
}

#[tauri::command]
pub fn gesture_reset_stats(
    state: tauri::State<'_, GestureManagerState>,
) -> Result<(), String> {
    let mut stats = state.stats.lock().map_err(|e| e.to_string())?;
    stats.total_gestures = 0;
    stats.gestures_by_type.clear();
    stats.most_used_action = None;
    Ok(())
}

#[tauri::command]
pub fn gesture_get_available_actions() -> Vec<serde_json::Value> {
    vec![
        serde_json::json!({"id": "navigate_back", "label": "Navigate Back", "category": "navigation"}),
        serde_json::json!({"id": "navigate_forward", "label": "Navigate Forward", "category": "navigation"}),
        serde_json::json!({"id": "switch_channel_up", "label": "Previous Channel", "category": "navigation"}),
        serde_json::json!({"id": "switch_channel_down", "label": "Next Channel", "category": "navigation"}),
        serde_json::json!({"id": "switch_server_up", "label": "Previous Server", "category": "navigation"}),
        serde_json::json!({"id": "switch_server_down", "label": "Next Server", "category": "navigation"}),
        serde_json::json!({"id": "toggle_sidebar", "label": "Toggle Sidebar", "category": "layout"}),
        serde_json::json!({"id": "toggle_member_list", "label": "Toggle Member List", "category": "layout"}),
        serde_json::json!({"id": "zoom_in", "label": "Zoom In", "category": "view"}),
        serde_json::json!({"id": "zoom_out", "label": "Zoom Out", "category": "view"}),
        serde_json::json!({"id": "toggle_mute", "label": "Toggle Mute", "category": "voice"}),
        serde_json::json!({"id": "toggle_deafen", "label": "Toggle Deafen", "category": "voice"}),
        serde_json::json!({"id": "open_search", "label": "Open Search", "category": "utility"}),
        serde_json::json!({"id": "close_panel", "label": "Close Panel", "category": "layout"}),
        serde_json::json!({"id": "toggle_fullscreen", "label": "Toggle Fullscreen", "category": "view"}),
        serde_json::json!({"id": "toggle_mini_mode", "label": "Toggle Mini Mode", "category": "view"}),
    ]
}

#[tauri::command]
pub fn gesture_reset_config(
    state: tauri::State<'_, GestureManagerState>,
) -> Result<GestureConfig, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    *config = GestureConfig::default();
    Ok(config.clone())
}

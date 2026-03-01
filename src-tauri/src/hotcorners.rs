// Hot Corners Manager - Trigger actions when cursor hits screen corners
// Supports configurable actions for each corner with activation delay

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum ScreenCorner {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum HotCornerAction {
    None,
    ShowNotificationCenter,
    ToggleFocusMode,
    ShowQuickActions,
    LockScreen,
    ShowDesktop,
    LaunchQuickNote,
    ToggleMute,
    StartScreenRecording,
    ShowCommandPalette,
    ToggleDoNotDisturb,
    ShowCalendar,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotCornerConfig {
    pub corner: ScreenCorner,
    pub action: HotCornerAction,
    pub activation_delay_ms: u64,
    pub enabled: bool,
    pub modifier_required: Option<String>,
}

impl Default for HotCornerConfig {
    fn default() -> Self {
        Self {
            corner: ScreenCorner::TopLeft,
            action: HotCornerAction::None,
            activation_delay_ms: 300,
            enabled: true,
            modifier_required: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotCornersSettings {
    pub enabled: bool,
    pub corner_size_px: u32,
    pub corners: HashMap<String, HotCornerConfig>,
    pub show_visual_feedback: bool,
    pub sound_feedback: bool,
    pub disabled_in_fullscreen: bool,
}

impl Default for HotCornersSettings {
    fn default() -> Self {
        let mut corners = HashMap::new();
        
        corners.insert(
            "top-left".to_string(),
            HotCornerConfig {
                corner: ScreenCorner::TopLeft,
                action: HotCornerAction::ShowNotificationCenter,
                activation_delay_ms: 300,
                enabled: true,
                modifier_required: None,
            },
        );
        
        corners.insert(
            "top-right".to_string(),
            HotCornerConfig {
                corner: ScreenCorner::TopRight,
                action: HotCornerAction::ShowQuickActions,
                activation_delay_ms: 300,
                enabled: true,
                modifier_required: None,
            },
        );
        
        corners.insert(
            "bottom-left".to_string(),
            HotCornerConfig {
                corner: ScreenCorner::BottomLeft,
                action: HotCornerAction::ShowDesktop,
                activation_delay_ms: 300,
                enabled: false,
                modifier_required: None,
            },
        );
        
        corners.insert(
            "bottom-right".to_string(),
            HotCornerConfig {
                corner: ScreenCorner::BottomRight,
                action: HotCornerAction::LaunchQuickNote,
                activation_delay_ms: 300,
                enabled: false,
                modifier_required: None,
            },
        );
        
        Self {
            enabled: true,
            corner_size_px: 5,
            corners,
            show_visual_feedback: true,
            sound_feedback: false,
            disabled_in_fullscreen: true,
        }
    }
}

#[derive(Debug)]
struct CornerTrackingState {
    current_corner: Option<ScreenCorner>,
    entered_at: Option<Instant>,
    last_triggered: Option<Instant>,
    cooldown_ms: u64,
}

impl Default for CornerTrackingState {
    fn default() -> Self {
        Self {
            current_corner: None,
            entered_at: None,
            last_triggered: None,
            cooldown_ms: 1000,
        }
    }
}

pub struct HotCornersManager {
    settings: Arc<Mutex<HotCornersSettings>>,
    tracking_state: Arc<Mutex<CornerTrackingState>>,
    screen_dimensions: Arc<Mutex<(u32, u32)>>,
}

impl HotCornersManager {
    pub fn new() -> Self {
        Self {
            settings: Arc::new(Mutex::new(HotCornersSettings::default())),
            tracking_state: Arc::new(Mutex::new(CornerTrackingState::default())),
            screen_dimensions: Arc::new(Mutex::new((1920, 1080))),
        }
    }

    pub fn get_settings(&self) -> HotCornersSettings {
        self.settings.lock().unwrap().clone()
    }

    pub fn update_settings(&self, settings: HotCornersSettings) {
        *self.settings.lock().unwrap() = settings;
    }

    pub fn set_screen_dimensions(&self, width: u32, height: u32) {
        *self.screen_dimensions.lock().unwrap() = (width, height);
    }

    pub fn check_cursor_position(&self, x: i32, y: i32) -> Option<HotCornerAction> {
        let settings = self.settings.lock().unwrap();
        
        if !settings.enabled {
            return None;
        }

        let (screen_width, screen_height) = *self.screen_dimensions.lock().unwrap();
        let corner_size = settings.corner_size_px as i32;

        let detected_corner = self.detect_corner(x, y, screen_width as i32, screen_height as i32, corner_size);

        let mut tracking = self.tracking_state.lock().unwrap();

        match detected_corner {
            Some(corner) => {
                if tracking.current_corner.as_ref() != Some(&corner) {
                    tracking.current_corner = Some(corner.clone());
                    tracking.entered_at = Some(Instant::now());
                    return None;
                }

                if let Some(entered_at) = tracking.entered_at {
                    let corner_key = match corner {
                        ScreenCorner::TopLeft => "top-left",
                        ScreenCorner::TopRight => "top-right",
                        ScreenCorner::BottomLeft => "bottom-left",
                        ScreenCorner::BottomRight => "bottom-right",
                    };

                    if let Some(config) = settings.corners.get(corner_key) {
                        if !config.enabled {
                            return None;
                        }

                        let required_delay = Duration::from_millis(config.activation_delay_ms);
                        
                        if entered_at.elapsed() >= required_delay {
                            if let Some(last_triggered) = tracking.last_triggered {
                                if last_triggered.elapsed() < Duration::from_millis(tracking.cooldown_ms) {
                                    return None;
                                }
                            }

                            tracking.last_triggered = Some(Instant::now());
                            tracking.entered_at = None;
                            
                            return Some(config.action.clone());
                        }
                    }
                }
            }
            None => {
                tracking.current_corner = None;
                tracking.entered_at = None;
            }
        }

        None
    }

    fn detect_corner(&self, x: i32, y: i32, width: i32, height: i32, size: i32) -> Option<ScreenCorner> {
        let in_left = x < size;
        let in_right = x >= width - size;
        let in_top = y < size;
        let in_bottom = y >= height - size;

        match (in_left, in_right, in_top, in_bottom) {
            (true, _, true, _) => Some(ScreenCorner::TopLeft),
            (_, true, true, _) => Some(ScreenCorner::TopRight),
            (true, _, _, true) => Some(ScreenCorner::BottomLeft),
            (_, true, _, true) => Some(ScreenCorner::BottomRight),
            _ => None,
        }
    }

    pub fn get_corner_config(&self, corner: &ScreenCorner) -> Option<HotCornerConfig> {
        let settings = self.settings.lock().unwrap();
        let corner_key = match corner {
            ScreenCorner::TopLeft => "top-left",
            ScreenCorner::TopRight => "top-right",
            ScreenCorner::BottomLeft => "bottom-left",
            ScreenCorner::BottomRight => "bottom-right",
        };
        settings.corners.get(corner_key).cloned()
    }

    pub fn set_corner_action(&self, corner: ScreenCorner, action: HotCornerAction) {
        let mut settings = self.settings.lock().unwrap();
        let corner_key = match corner {
            ScreenCorner::TopLeft => "top-left",
            ScreenCorner::TopRight => "top-right",
            ScreenCorner::BottomLeft => "bottom-left",
            ScreenCorner::BottomRight => "bottom-right",
        };
        
        if let Some(config) = settings.corners.get_mut(corner_key) {
            config.action = action;
        }
    }

    pub fn set_corner_enabled(&self, corner: ScreenCorner, enabled: bool) {
        let mut settings = self.settings.lock().unwrap();
        let corner_key = match corner {
            ScreenCorner::TopLeft => "top-left",
            ScreenCorner::TopRight => "top-right",
            ScreenCorner::BottomLeft => "bottom-left",
            ScreenCorner::BottomRight => "bottom-right",
        };
        
        if let Some(config) = settings.corners.get_mut(corner_key) {
            config.enabled = enabled;
        }
    }

    pub fn reset_tracking(&self) {
        let mut tracking = self.tracking_state.lock().unwrap();
        tracking.current_corner = None;
        tracking.entered_at = None;
    }
}

impl Default for HotCornersManager {
    fn default() -> Self {
        Self::new()
    }
}

// Tauri Commands

#[tauri::command]
pub async fn hotcorners_get_settings(
    state: tauri::State<'_, Arc<HotCornersManager>>,
) -> Result<HotCornersSettings, String> {
    Ok(state.get_settings())
}

#[tauri::command]
pub async fn hotcorners_update_settings(
    state: tauri::State<'_, Arc<HotCornersManager>>,
    settings: HotCornersSettings,
) -> Result<(), String> {
    state.update_settings(settings);
    Ok(())
}

#[tauri::command]
pub async fn hotcorners_check_position(
    state: tauri::State<'_, Arc<HotCornersManager>>,
    x: i32,
    y: i32,
) -> Result<Option<HotCornerAction>, String> {
    Ok(state.check_cursor_position(x, y))
}

#[tauri::command]
pub async fn hotcorners_set_screen_dimensions(
    state: tauri::State<'_, Arc<HotCornersManager>>,
    width: u32,
    height: u32,
) -> Result<(), String> {
    state.set_screen_dimensions(width, height);
    Ok(())
}

#[tauri::command]
pub async fn hotcorners_set_corner_action(
    state: tauri::State<'_, Arc<HotCornersManager>>,
    corner: ScreenCorner,
    action: HotCornerAction,
) -> Result<(), String> {
    state.set_corner_action(corner, action);
    Ok(())
}

#[tauri::command]
pub async fn hotcorners_set_corner_enabled(
    state: tauri::State<'_, Arc<HotCornersManager>>,
    corner: ScreenCorner,
    enabled: bool,
) -> Result<(), String> {
    state.set_corner_enabled(corner, enabled);
    Ok(())
}

#[tauri::command]
pub async fn hotcorners_reset_tracking(
    state: tauri::State<'_, Arc<HotCornersManager>>,
) -> Result<(), String> {
    state.reset_tracking();
    Ok(())
}

#[tauri::command]
pub async fn hotcorners_get_available_actions() -> Result<Vec<(String, String)>, String> {
    Ok(vec![
        ("none".to_string(), "No Action".to_string()),
        ("show-notification-center".to_string(), "Show Notification Center".to_string()),
        ("toggle-focus-mode".to_string(), "Toggle Focus Mode".to_string()),
        ("show-quick-actions".to_string(), "Show Quick Actions".to_string()),
        ("lock-screen".to_string(), "Lock Screen".to_string()),
        ("show-desktop".to_string(), "Show Desktop".to_string()),
        ("launch-quick-note".to_string(), "Launch Quick Note".to_string()),
        ("toggle-mute".to_string(), "Toggle Mute".to_string()),
        ("start-screen-recording".to_string(), "Start Screen Recording".to_string()),
        ("show-command-palette".to_string(), "Show Command Palette".to_string()),
        ("toggle-do-not-disturb".to_string(), "Toggle Do Not Disturb".to_string()),
        ("show-calendar".to_string(), "Show Calendar".to_string()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_corner_detection() {
        let manager = HotCornersManager::new();
        manager.set_screen_dimensions(1920, 1080);

        // Test top-left
        assert!(matches!(
            manager.detect_corner(0, 0, 1920, 1080, 5),
            Some(ScreenCorner::TopLeft)
        ));

        // Test top-right
        assert!(matches!(
            manager.detect_corner(1919, 0, 1920, 1080, 5),
            Some(ScreenCorner::TopRight)
        ));

        // Test bottom-left
        assert!(matches!(
            manager.detect_corner(0, 1079, 1920, 1080, 5),
            Some(ScreenCorner::BottomLeft)
        ));

        // Test bottom-right
        assert!(matches!(
            manager.detect_corner(1919, 1079, 1920, 1080, 5),
            Some(ScreenCorner::BottomRight)
        ));

        // Test center (no corner)
        assert!(manager.detect_corner(960, 540, 1920, 1080, 5).is_none());
    }

    #[test]
    fn test_settings_default() {
        let settings = HotCornersSettings::default();
        assert!(settings.enabled);
        assert_eq!(settings.corner_size_px, 5);
        assert_eq!(settings.corners.len(), 4);
    }

    #[test]
    fn test_set_corner_action() {
        let manager = HotCornersManager::new();
        manager.set_corner_action(ScreenCorner::TopLeft, HotCornerAction::LockScreen);
        
        let config = manager.get_corner_config(&ScreenCorner::TopLeft).unwrap();
        assert!(matches!(config.action, HotCornerAction::LockScreen));
    }

    #[test]
    fn test_set_corner_enabled() {
        let manager = HotCornersManager::new();
        manager.set_corner_enabled(ScreenCorner::TopLeft, false);
        
        let config = manager.get_corner_config(&ScreenCorner::TopLeft).unwrap();
        assert!(!config.enabled);
    }
}

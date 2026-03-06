// Touch Bar Manager for macOS
// Provides native Touch Bar integration for Hearth Desktop

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TouchBarItem {
    Button {
        id: String,
        label: Option<String>,
        icon: Option<String>,
        #[serde(rename = "iconPosition")]
        icon_position: Option<String>,
        #[serde(rename = "backgroundColor")]
        background_color: Option<String>,
        #[serde(rename = "accessibilityLabel")]
        accessibility_label: Option<String>,
        enabled: Option<bool>,
    },
    Label {
        id: String,
        label: String,
        #[serde(rename = "textColor")]
        text_color: Option<String>,
        #[serde(rename = "accessibilityLabel")]
        accessibility_label: Option<String>,
    },
    Slider {
        id: String,
        label: Option<String>,
        #[serde(rename = "minValue")]
        min_value: f64,
        #[serde(rename = "maxValue")]
        max_value: f64,
        value: f64,
        #[serde(rename = "accessibilityLabel")]
        accessibility_label: Option<String>,
    },
    Spacer {
        id: String,
        size: String,
    },
    #[serde(rename = "colorPicker")]
    ColorPicker {
        id: String,
        #[serde(rename = "selectedColor")]
        selected_color: Option<String>,
        #[serde(rename = "availableColors")]
        available_colors: Option<Vec<String>>,
        #[serde(rename = "accessibilityLabel")]
        accessibility_label: Option<String>,
    },
    Scrubber {
        id: String,
        items: Vec<ScrubberItem>,
        #[serde(rename = "selectedIndex")]
        selected_index: Option<i32>,
        mode: Option<String>,
        #[serde(rename = "showsArrowButtons")]
        shows_arrow_buttons: Option<bool>,
        continuous: Option<bool>,
    },
    Popover {
        id: String,
        label: Option<String>,
        icon: Option<String>,
        #[serde(rename = "showCloseButton")]
        show_close_button: Option<bool>,
        items: Vec<TouchBarItem>,
        #[serde(rename = "pressAndHoldItems")]
        press_and_hold_items: Option<Vec<TouchBarItem>>,
    },
    Group {
        id: String,
        items: Vec<TouchBarItem>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrubberItem {
    pub label: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TouchBarConfig {
    pub items: Vec<TouchBarItem>,
    #[serde(rename = "escapeItem")]
    pub escape_item: Option<TouchBarItem>,
    #[serde(rename = "principalItemId")]
    pub principal_item_id: Option<String>,
    #[serde(rename = "customizationLabel")]
    pub customization_label: Option<String>,
    #[serde(rename = "customizationAllowed")]
    pub customization_allowed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TouchBarPreset {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub config: TouchBarConfig,
    #[serde(rename = "contextMatch")]
    pub context_match: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TouchBarEvent {
    #[serde(rename = "itemId")]
    pub item_id: String,
    #[serde(rename = "eventType")]
    pub event_type: String,
    pub value: Option<serde_json::Value>,
}

pub struct TouchBarState {
    is_available: bool,
    current_preset: Option<String>,
    presets: HashMap<String, TouchBarPreset>,
    current_config: Option<TouchBarConfig>,
}

impl Default for TouchBarState {
    fn default() -> Self {
        Self {
            is_available: cfg!(target_os = "macos"),
            current_preset: None,
            presets: Self::default_presets(),
            current_config: None,
        }
    }
}

impl TouchBarState {
    fn default_presets() -> HashMap<String, TouchBarPreset> {
        let mut presets = HashMap::new();

        // Default messaging preset
        presets.insert(
            "messaging".to_string(),
            TouchBarPreset {
                id: "messaging".to_string(),
                name: "Messaging".to_string(),
                description: Some("Quick actions for messaging".to_string()),
                config: TouchBarConfig {
                    items: vec![
                        TouchBarItem::Button {
                            id: "new_message".to_string(),
                            label: Some("New".to_string()),
                            icon: Some("compose".to_string()),
                            icon_position: Some("left".to_string()),
                            background_color: None,
                            accessibility_label: Some("New Message".to_string()),
                            enabled: Some(true),
                        },
                        TouchBarItem::Spacer {
                            id: "spacer1".to_string(),
                            size: "flexible".to_string(),
                        },
                        TouchBarItem::Button {
                            id: "quick_reply".to_string(),
                            label: Some("Reply".to_string()),
                            icon: Some("reply".to_string()),
                            icon_position: Some("left".to_string()),
                            background_color: None,
                            accessibility_label: Some("Quick Reply".to_string()),
                            enabled: Some(true),
                        },
                        TouchBarItem::Button {
                            id: "reactions".to_string(),
                            label: Some("React".to_string()),
                            icon: Some("emoji".to_string()),
                            icon_position: Some("left".to_string()),
                            background_color: None,
                            accessibility_label: Some("Add Reaction".to_string()),
                            enabled: Some(true),
                        },
                    ],
                    escape_item: None,
                    principal_item_id: None,
                    customization_label: Some("Hearth Messaging".to_string()),
                    customization_allowed: Some(true),
                },
                context_match: Some("chat".to_string()),
            },
        );

        // Voice call preset
        presets.insert(
            "voice".to_string(),
            TouchBarPreset {
                id: "voice".to_string(),
                name: "Voice Call".to_string(),
                description: Some("Controls for voice calls".to_string()),
                config: TouchBarConfig {
                    items: vec![
                        TouchBarItem::Button {
                            id: "mute".to_string(),
                            label: Some("Mute".to_string()),
                            icon: Some("mic".to_string()),
                            icon_position: Some("left".to_string()),
                            background_color: None,
                            accessibility_label: Some("Toggle Mute".to_string()),
                            enabled: Some(true),
                        },
                        TouchBarItem::Button {
                            id: "deafen".to_string(),
                            label: Some("Deafen".to_string()),
                            icon: Some("headphones".to_string()),
                            icon_position: Some("left".to_string()),
                            background_color: None,
                            accessibility_label: Some("Toggle Deafen".to_string()),
                            enabled: Some(true),
                        },
                        TouchBarItem::Spacer {
                            id: "spacer1".to_string(),
                            size: "flexible".to_string(),
                        },
                        TouchBarItem::Slider {
                            id: "volume".to_string(),
                            label: Some("Volume".to_string()),
                            min_value: 0.0,
                            max_value: 100.0,
                            value: 80.0,
                            accessibility_label: Some("Output Volume".to_string()),
                        },
                        TouchBarItem::Spacer {
                            id: "spacer2".to_string(),
                            size: "small".to_string(),
                        },
                        TouchBarItem::Button {
                            id: "end_call".to_string(),
                            label: Some("End".to_string()),
                            icon: Some("phone.down".to_string()),
                            icon_position: Some("left".to_string()),
                            background_color: Some("#ff4444".to_string()),
                            accessibility_label: Some("End Call".to_string()),
                            enabled: Some(true),
                        },
                    ],
                    escape_item: None,
                    principal_item_id: Some("volume".to_string()),
                    customization_label: Some("Hearth Voice".to_string()),
                    customization_allowed: Some(true),
                },
                context_match: Some("voice".to_string()),
            },
        );

        // Media playback preset
        presets.insert(
            "media".to_string(),
            TouchBarPreset {
                id: "media".to_string(),
                name: "Media".to_string(),
                description: Some("Media playback controls".to_string()),
                config: TouchBarConfig {
                    items: vec![
                        TouchBarItem::Button {
                            id: "prev".to_string(),
                            label: None,
                            icon: Some("backward.fill".to_string()),
                            icon_position: None,
                            background_color: None,
                            accessibility_label: Some("Previous".to_string()),
                            enabled: Some(true),
                        },
                        TouchBarItem::Button {
                            id: "play_pause".to_string(),
                            label: None,
                            icon: Some("play.fill".to_string()),
                            icon_position: None,
                            background_color: None,
                            accessibility_label: Some("Play/Pause".to_string()),
                            enabled: Some(true),
                        },
                        TouchBarItem::Button {
                            id: "next".to_string(),
                            label: None,
                            icon: Some("forward.fill".to_string()),
                            icon_position: None,
                            background_color: None,
                            accessibility_label: Some("Next".to_string()),
                            enabled: Some(true),
                        },
                        TouchBarItem::Spacer {
                            id: "spacer1".to_string(),
                            size: "small".to_string(),
                        },
                        TouchBarItem::Slider {
                            id: "progress".to_string(),
                            label: None,
                            min_value: 0.0,
                            max_value: 100.0,
                            value: 0.0,
                            accessibility_label: Some("Playback Progress".to_string()),
                        },
                    ],
                    escape_item: None,
                    principal_item_id: Some("progress".to_string()),
                    customization_label: Some("Hearth Media".to_string()),
                    customization_allowed: Some(true),
                },
                context_match: Some("media".to_string()),
            },
        );

        presets
    }
}

pub struct TouchBarManager {
    state: Mutex<TouchBarState>,
}

impl Default for TouchBarManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(TouchBarState::default()),
        }
    }
}

impl TouchBarManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_available(&self) -> bool {
        self.state.lock().unwrap().is_available
    }

    pub fn get_presets(&self) -> Vec<TouchBarPreset> {
        self.state
            .lock()
            .unwrap()
            .presets
            .values()
            .cloned()
            .collect()
    }

    pub fn get_preset(&self, id: &str) -> Option<TouchBarPreset> {
        self.state.lock().unwrap().presets.get(id).cloned()
    }

    pub fn apply_preset(&self, preset_id: &str) -> Result<TouchBarConfig, String> {
        let mut state = self.state.lock().unwrap();
        
        let preset = state
            .presets
            .get(preset_id)
            .cloned()
            .ok_or_else(|| format!("Preset '{}' not found", preset_id))?;

        state.current_preset = Some(preset_id.to_string());
        state.current_config = Some(preset.config.clone());

        Ok(preset.config)
    }

    pub fn set_config(&self, config: TouchBarConfig) -> Result<(), String> {
        let mut state = self.state.lock().unwrap();
        state.current_preset = None;
        state.current_config = Some(config);
        Ok(())
    }

    pub fn get_current_config(&self) -> Option<TouchBarConfig> {
        self.state.lock().unwrap().current_config.clone()
    }

    pub fn update_item(&self, item_id: &str, updates: serde_json::Value) -> Result<(), String> {
        let mut state = self.state.lock().unwrap();
        
        if let Some(ref mut config) = state.current_config {
            Self::update_item_recursive(&mut config.items, item_id, &updates)?;
        }
        
        Ok(())
    }

    fn update_item_recursive(
        items: &mut Vec<TouchBarItem>,
        item_id: &str,
        updates: &serde_json::Value,
    ) -> Result<bool, String> {
        for item in items.iter_mut() {
            let (id, found) = match item {
                TouchBarItem::Button { id, enabled, label, .. } => {
                    if id == item_id {
                        if let Some(e) = updates.get("enabled").and_then(|v| v.as_bool()) {
                            *enabled = Some(e);
                        }
                        if let Some(l) = updates.get("label").and_then(|v| v.as_str()) {
                            *label = Some(l.to_string());
                        }
                        return Ok(true);
                    }
                    (id.clone(), false)
                }
                TouchBarItem::Label { id, label, .. } => {
                    if id == item_id {
                        if let Some(l) = updates.get("label").and_then(|v| v.as_str()) {
                            *label = l.to_string();
                        }
                        return Ok(true);
                    }
                    (id.clone(), false)
                }
                TouchBarItem::Slider { id, value, .. } => {
                    if id == item_id {
                        if let Some(v) = updates.get("value").and_then(|v| v.as_f64()) {
                            *value = v;
                        }
                        return Ok(true);
                    }
                    (id.clone(), false)
                }
                TouchBarItem::Group { id, items: group_items } => {
                    if Self::update_item_recursive(group_items, item_id, updates)? {
                        return Ok(true);
                    }
                    (id.clone(), false)
                }
                TouchBarItem::Popover { id, items: popover_items, .. } => {
                    if Self::update_item_recursive(popover_items, item_id, updates)? {
                        return Ok(true);
                    }
                    (id.clone(), false)
                }
                TouchBarItem::Scrubber { id, selected_index, .. } => {
                    if id == item_id {
                        if let Some(idx) = updates.get("selectedIndex").and_then(|v| v.as_i64()) {
                            *selected_index = Some(idx as i32);
                        }
                        return Ok(true);
                    }
                    (id.clone(), false)
                }
                TouchBarItem::ColorPicker { id, selected_color, .. } => {
                    if id == item_id {
                        if let Some(c) = updates.get("selectedColor").and_then(|v| v.as_str()) {
                            *selected_color = Some(c.to_string());
                        }
                        return Ok(true);
                    }
                    (id.clone(), false)
                }
                TouchBarItem::Spacer { id, .. } => (id.clone(), false),
            };
            
            if found {
                return Ok(true);
            }
        }
        
        Ok(false)
    }

    pub fn add_preset(&self, preset: TouchBarPreset) -> Result<(), String> {
        let mut state = self.state.lock().unwrap();
        state.presets.insert(preset.id.clone(), preset);
        Ok(())
    }

    pub fn remove_preset(&self, preset_id: &str) -> Result<(), String> {
        let mut state = self.state.lock().unwrap();
        
        if state.presets.remove(preset_id).is_none() {
            return Err(format!("Preset '{}' not found", preset_id));
        }
        
        if state.current_preset.as_deref() == Some(preset_id) {
            state.current_preset = None;
        }
        
        Ok(())
    }

    pub fn clear(&self) -> Result<(), String> {
        let mut state = self.state.lock().unwrap();
        state.current_config = None;
        state.current_preset = None;
        Ok(())
    }
}

// Tauri Commands

#[tauri::command]
pub async fn touchbar_check_available<R: Runtime>(
    app: AppHandle<R>,
) -> Result<bool, String> {
    let manager = app.state::<TouchBarManager>();
    Ok(manager.is_available())
}

#[tauri::command]
pub async fn touchbar_get_presets<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<TouchBarPreset>, String> {
    let manager = app.state::<TouchBarManager>();
    Ok(manager.get_presets())
}

#[tauri::command]
pub async fn touchbar_apply_preset<R: Runtime>(
    app: AppHandle<R>,
    preset_id: String,
) -> Result<TouchBarConfig, String> {
    let manager = app.state::<TouchBarManager>();
    let config = manager.apply_preset(&preset_id)?;
    
    // Emit event to notify frontend
    let _ = app.emit("touchbar-config-changed", &config);
    
    Ok(config)
}

#[tauri::command]
pub async fn touchbar_set_config<R: Runtime>(
    app: AppHandle<R>,
    config: TouchBarConfig,
) -> Result<(), String> {
    let manager = app.state::<TouchBarManager>();
    manager.set_config(config.clone())?;
    
    // Emit event to notify frontend
    let _ = app.emit("touchbar-config-changed", &config);
    
    Ok(())
}

#[tauri::command]
pub async fn touchbar_get_current_config<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<TouchBarConfig>, String> {
    let manager = app.state::<TouchBarManager>();
    Ok(manager.get_current_config())
}

#[tauri::command]
pub async fn touchbar_update_item<R: Runtime>(
    app: AppHandle<R>,
    item_id: String,
    updates: serde_json::Value,
) -> Result<(), String> {
    let manager = app.state::<TouchBarManager>();
    manager.update_item(&item_id, updates)?;
    
    // Emit update event
    if let Some(config) = manager.get_current_config() {
        let _ = app.emit("touchbar-item-updated", serde_json::json!({
            "itemId": item_id,
            "config": config
        }));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn touchbar_add_preset<R: Runtime>(
    app: AppHandle<R>,
    preset: TouchBarPreset,
) -> Result<(), String> {
    let manager = app.state::<TouchBarManager>();
    manager.add_preset(preset.clone())?;
    
    let _ = app.emit("touchbar-preset-added", &preset);
    
    Ok(())
}

#[tauri::command]
pub async fn touchbar_remove_preset<R: Runtime>(
    app: AppHandle<R>,
    preset_id: String,
) -> Result<(), String> {
    let manager = app.state::<TouchBarManager>();
    manager.remove_preset(&preset_id)?;
    
    let _ = app.emit("touchbar-preset-removed", &preset_id);
    
    Ok(())
}

#[tauri::command]
pub async fn touchbar_clear<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    let manager = app.state::<TouchBarManager>();
    manager.clear()?;
    
    let _ = app.emit("touchbar-cleared", ());
    
    Ok(())
}

#[tauri::command]
pub async fn touchbar_handle_event<R: Runtime>(
    app: AppHandle<R>,
    event: TouchBarEvent,
) -> Result<(), String> {
    // Forward event to frontend for handling
    let _ = app.emit("touchbar-event", &event);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_touchbar_manager_creation() {
        let manager = TouchBarManager::new();
        assert!(manager.is_available() == cfg!(target_os = "macos"));
    }

    #[test]
    fn test_default_presets() {
        let manager = TouchBarManager::new();
        let presets = manager.get_presets();
        
        assert!(presets.len() >= 3);
        assert!(manager.get_preset("messaging").is_some());
        assert!(manager.get_preset("voice").is_some());
        assert!(manager.get_preset("media").is_some());
    }

    #[test]
    fn test_apply_preset() {
        let manager = TouchBarManager::new();
        
        let result = manager.apply_preset("messaging");
        assert!(result.is_ok());
        
        let config = manager.get_current_config();
        assert!(config.is_some());
    }

    #[test]
    fn test_apply_invalid_preset() {
        let manager = TouchBarManager::new();
        
        let result = manager.apply_preset("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_custom_config() {
        let manager = TouchBarManager::new();
        
        let config = TouchBarConfig {
            items: vec![
                TouchBarItem::Button {
                    id: "test".to_string(),
                    label: Some("Test".to_string()),
                    icon: None,
                    icon_position: None,
                    background_color: None,
                    accessibility_label: None,
                    enabled: Some(true),
                }
            ],
            escape_item: None,
            principal_item_id: None,
            customization_label: None,
            customization_allowed: None,
        };
        
        let result = manager.set_config(config.clone());
        assert!(result.is_ok());
        
        let current = manager.get_current_config();
        assert!(current.is_some());
    }

    #[test]
    fn test_update_item() {
        let manager = TouchBarManager::new();
        
        // Apply preset first
        manager.apply_preset("messaging").unwrap();
        
        // Update an item
        let updates = serde_json::json!({
            "label": "Updated Label"
        });
        
        let result = manager.update_item("new_message", updates);
        assert!(result.is_ok());
    }

    #[test]
    fn test_add_remove_preset() {
        let manager = TouchBarManager::new();
        
        let preset = TouchBarPreset {
            id: "custom".to_string(),
            name: "Custom".to_string(),
            description: None,
            config: TouchBarConfig {
                items: vec![],
                escape_item: None,
                principal_item_id: None,
                customization_label: None,
                customization_allowed: None,
            },
            context_match: None,
        };
        
        manager.add_preset(preset).unwrap();
        assert!(manager.get_preset("custom").is_some());
        
        manager.remove_preset("custom").unwrap();
        assert!(manager.get_preset("custom").is_none());
    }

    #[test]
    fn test_clear() {
        let manager = TouchBarManager::new();
        
        manager.apply_preset("messaging").unwrap();
        assert!(manager.get_current_config().is_some());
        
        manager.clear().unwrap();
        assert!(manager.get_current_config().is_none());
    }
}

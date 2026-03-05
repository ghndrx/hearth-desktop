//! Zen Mode - Distraction-free chat experience for Hearth Desktop
//!
//! Provides:
//! - Minimal UI mode that hides sidebars and distractions
//! - Full-screen or compact window options
//! - Per-channel Zen Mode state persistence
//! - Smooth transitions and animations
//! - Integration with Focus Mode and Mini Mode

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Runtime, Window};

/// Zen Mode configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZenModeConfig {
    /// Whether Zen Mode is currently active
    pub enabled: bool,
    /// Whether to use full-screen in Zen Mode
    pub fullscreen: bool,
    /// Whether to show the header in Zen Mode
    pub show_header: bool,
    /// Whether to show the message input
    pub show_input: bool,
    /// Background blur effect intensity (0-100)
    pub background_blur: u8,
    /// Font size scaling factor (0.8 - 1.5)
    pub font_scale: f32,
    /// Whether to hide message timestamps
    pub hide_timestamps: bool,
    /// Whether to hide user avatars
    pub hide_avatars: bool,
    /// Whether to enable auto-hide for UI elements
    pub auto_hide_ui: bool,
    /// Auto-hide delay in seconds
    pub auto_hide_delay: u8,
}

impl Default for ZenModeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            fullscreen: false,
            show_header: true,
            show_input: true,
            background_blur: 0,
            font_scale: 1.0,
            hide_timestamps: false,
            hide_avatars: false,
            auto_hide_ui: false,
            auto_hide_delay: 3,
        }
    }
}

/// Zen Mode state with channel-specific preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenModeState {
    /// Global Zen Mode configuration
    pub config: ZenModeConfig,
    /// Channels where Zen Mode is enabled
    pub enabled_channels: Vec<String>,
    /// Last used timestamp
    pub last_used_at: Option<String>,
}

impl Default for ZenModeState {
    fn default() -> Self {
        Self {
            config: ZenModeConfig::default(),
            enabled_channels: Vec::new(),
            last_used_at: None,
        }
    }
}

/// Global Zen Mode state
static ZEN_MODE_ENABLED: AtomicBool = AtomicBool::new(false);
static ZEN_MODE_CONFIG: Mutex<ZenModeConfig> = Mutex::new(ZenModeConfig {
    enabled: false,
    fullscreen: false,
    show_header: true,
    show_input: true,
    background_blur: 0,
    font_scale: 1.0,
    hide_timestamps: false,
    hide_avatars: false,
    auto_hide_ui: false,
    auto_hide_delay: 3,
});

/// Check if Zen Mode is enabled
#[tauri::command]
pub fn is_zen_mode_enabled() -> bool {
    ZEN_MODE_ENABLED.load(Ordering::Relaxed)
}

/// Toggle Zen Mode on/off
#[tauri::command]
pub async fn toggle_zen_mode(window: Window) -> Result<ZenModeConfig, String> {
    let current = ZEN_MODE_ENABLED.load(Ordering::Relaxed);
    let new_state = !current;
    
    set_zen_mode_internal(&window, new_state).await
}

/// Enable or disable Zen Mode explicitly
#[tauri::command]
pub async fn set_zen_mode(window: Window, enabled: bool) -> Result<ZenModeConfig, String> {
    set_zen_mode_internal(&window, enabled).await
}

/// Internal function to set Zen Mode state
async fn set_zen_mode_internal(window: &Window, enabled: bool) -> Result<ZenModeConfig, String> {
    ZEN_MODE_ENABLED.store(enabled, Ordering::Relaxed);
    
    // Get current config
    let mut config = {
        let guard = ZEN_MODE_CONFIG.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    config.enabled = enabled;
    
    // Apply window changes
    if enabled {
        // Entering Zen Mode
        if config.fullscreen {
            window.set_fullscreen(true).map_err(|e| e.to_string())?;
        }
        
        // Emit event to frontend
        window.emit("zen-mode-entered", &config)
            .map_err(|e| e.to_string())?;
        
        log::info!("Zen Mode enabled");
    } else {
        // Exiting Zen Mode
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
        
        // Emit event to frontend
        window.emit("zen-mode-exited", &config)
            .map_err(|e| e.to_string())?;
        
        log::info!("Zen Mode disabled");
    }
    
    // Update stored config
    {
        let mut guard = ZEN_MODE_CONFIG.lock().map_err(|e| e.to_string())?;
        *guard = config.clone();
    }
    
    Ok(config)
}

/// Get current Zen Mode configuration
#[tauri::command]
pub fn get_zen_mode_config() -> Result<ZenModeConfig, String> {
    let guard = ZEN_MODE_CONFIG.lock().map_err(|e| e.to_string())?;
    let mut config = guard.clone();
    config.enabled = ZEN_MODE_ENABLED.load(Ordering::Relaxed);
    Ok(config)
}

/// Update Zen Mode configuration
#[tauri::command]
pub async fn update_zen_mode_config(
    window: Window,
    new_config: ZenModeConfig,
) -> Result<ZenModeConfig, String> {
    let was_enabled = ZEN_MODE_ENABLED.load(Ordering::Relaxed);
    
    // Update global state if enabled state changed
    if new_config.enabled != was_enabled {
        return set_zen_mode_internal(&window, new_config.enabled).await;
    }
    
    // Apply fullscreen change if in Zen Mode
    if was_enabled {
        window.set_fullscreen(new_config.fullscreen)
            .map_err(|e| e.to_string())?;
    }
    
    // Store new config
    {
        let mut guard = ZEN_MODE_CONFIG.lock().map_err(|e| e.to_string())?;
        *guard = new_config.clone();
    }
    
    // Emit config change event
    window.emit("zen-mode-config-changed", &new_config)
        .map_err(|e| e.to_string())?;
    
    Ok(new_config)
}

/// Enter Zen Mode for a specific channel
#[tauri::command]
pub async fn enter_channel_zen_mode(
    window: Window,
    channel_id: String,
) -> Result<ZenModeState, String> {
    let mut state = load_zen_mode_state(&window).await?;
    
    // Add channel to enabled list if not present
    if !state.enabled_channels.contains(&channel_id) {
        state.enabled_channels.push(channel_id.clone());
    }
    
    // Enable Zen Mode
    set_zen_mode_internal(&window, true).await?;
    
    // Update timestamp
    state.last_used_at = Some(chrono::Utc::now().to_rfc3339());
    state.config.enabled = true;
    
    // Save state
    save_zen_mode_state(&window, &state).await?;
    
    // Emit channel-specific event
    window.emit("zen-mode-channel-entered", serde_json::json!({
        "channelId": channel_id,
        "config": state.config,
    })).map_err(|e| e.to_string())?;
    
    Ok(state)
}

/// Exit Zen Mode for a specific channel
#[tauri::command]
pub async fn exit_channel_zen_mode(
    window: Window,
    channel_id: String,
) -> Result<ZenModeState, String> {
    let mut state = load_zen_mode_state(&window).await?;
    
    // Remove channel from enabled list
    state.enabled_channels.retain(|id| id != &channel_id);
    
    // Disable Zen Mode if no more channels
    if state.enabled_channels.is_empty() {
        set_zen_mode_internal(&window, false).await?;
        state.config.enabled = false;
    }
    
    // Save state
    save_zen_mode_state(&window, &state).await?;
    
    Ok(state)
}

/// Check if Zen Mode is enabled for a specific channel
#[tauri::command]
pub async fn is_channel_in_zen_mode(channel_id: String) -> Result<bool, String> {
    // For now, just check global state
    // In a full implementation, this would check the saved state
    Ok(ZEN_MODE_ENABLED.load(Ordering::Relaxed))
}

/// Get Zen Mode state including enabled channels
#[tauri::command]
pub async fn get_zen_mode_state(app: AppHandle) -> Result<ZenModeState, String> {
    load_zen_mode_state(&app).await
}

/// Save Zen Mode state to disk
async fn save_zen_mode_state<R: Runtime>(
    app: &AppHandle<R>,
    state: &ZenModeState,
) -> Result<(), String> {
    let app_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    
    let state_file = app_dir.join("zen-mode-state.json");
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    
    std::fs::write(&state_file, json)
        .map_err(|e| format!("Failed to write state: {}", e))?;
    
    Ok(())
}

/// Load Zen Mode state from disk
async fn load_zen_mode_state<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<ZenModeState, String> {
    let app_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let state_file = app_dir.join("zen-mode-state.json");
    
    if !state_file.exists() {
        return Ok(ZenModeState::default());
    }
    
    let json = std::fs::read_to_string(&state_file)
        .map_err(|e| format!("Failed to read state: {}", e))?;
    
    let state: ZenModeState = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse state: {}", e))?;
    
    Ok(state)
}

/// Reset Zen Mode settings to defaults
#[tauri::command]
pub async fn reset_zen_mode_config(app: AppHandle) -> Result<ZenModeConfig, String> {
    let default_config = ZenModeConfig::default();
    
    {
        let mut guard = ZEN_MODE_CONFIG.lock().map_err(|e| e.to_string())?;
        *guard = default_config.clone();
    }
    
    // Clear saved state
    let app_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let state_file = app_dir.join("zen-mode-state.json");
    
    if state_file.exists() {
        let _ = std::fs::remove_file(&state_file);
    }
    
    Ok(default_config)
}

/// Cycle through Zen Mode presets
#[tauri::command]
pub async fn cycle_zen_mode_preset(window: Window) -> Result<ZenModeConfig, String> {
    let presets = vec![
        // Minimal - everything hidden
        ZenModeConfig {
            enabled: true,
            fullscreen: true,
            show_header: false,
            show_input: true,
            background_blur: 20,
            font_scale: 1.1,
            hide_timestamps: true,
            hide_avatars: true,
            auto_hide_ui: true,
            auto_hide_delay: 2,
        },
        // Reading - clean with timestamps
        ZenModeConfig {
            enabled: true,
            fullscreen: false,
            show_header: true,
            show_input: false,
            background_blur: 0,
            font_scale: 1.15,
            hide_timestamps: false,
            hide_avatars: false,
            auto_hide_ui: false,
            auto_hide_delay: 3,
        },
        // Focus - balanced
        ZenModeConfig {
            enabled: true,
            fullscreen: true,
            show_header: true,
            show_input: true,
            background_blur: 10,
            font_scale: 1.0,
            hide_timestamps: false,
            hide_avatars: false,
            auto_hide_ui: true,
            auto_hide_delay: 3,
        },
    ];
    
    let current = {
        let guard = ZEN_MODE_CONFIG.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    
    // Find current preset index or start at 0
    let current_idx = presets.iter()
        .position(|p| p.font_scale == current.font_scale && p.fullscreen == current.fullscreen)
        .unwrap_or(0);
    
    let next_idx = (current_idx + 1) % (presets.len() + 1);
    
    let new_config = if next_idx == presets.len() {
        // Exit Zen Mode
        set_zen_mode_internal(&window, false).await?
    } else {
        // Apply preset
        let preset = presets[next_idx].clone();
        update_zen_mode_config(window, preset).await?
    };
    
    Ok(new_config)
}

/// Initialize Zen Mode on app startup
pub fn init_zen_mode<R: Runtime>(app: &AppHandle<R>) {
    // Load saved state
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        match load_zen_mode_state(&app_handle).await {
            Ok(state) => {
                // Restore config
                if let Ok(mut guard) = ZEN_MODE_CONFIG.lock() {
                    *guard = state.config;
                }
                log::info!("Zen Mode state loaded successfully");
            }
            Err(e) => {
                log::warn!("Failed to load Zen Mode state: {}", e);
            }
        }
    });
}

// Workspace Profiles Module
// Manages multiple workspace configurations for different use cases

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

/// Window state configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
    pub fullscreen: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 1200,
            height: 800,
            maximized: false,
            fullscreen: false,
        }
    }
}

/// Complete workspace configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConfig {
    pub window_state: WindowState,
    pub theme: String,
    pub sidebar_width: u32,
    pub sidebar_collapsed: bool,
    pub active_panels: Vec<String>,
    pub pinned_channels: Vec<String>,
    pub focus_mode_enabled: bool,
    pub notifications_enabled: bool,
    pub sound_enabled: bool,
    pub zoom_level: u32,
    pub font_size: String,
    pub compact_mode: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_css: Option<String>,
}

impl Default for WorkspaceConfig {
    fn default() -> Self {
        Self {
            window_state: WindowState::default(),
            theme: "system".to_string(),
            sidebar_width: 240,
            sidebar_collapsed: false,
            active_panels: vec!["chat".to_string(), "members".to_string()],
            pinned_channels: vec![],
            focus_mode_enabled: false,
            notifications_enabled: true,
            sound_enabled: true,
            zoom_level: 100,
            font_size: "medium".to_string(),
            compact_mode: false,
            custom_css: None,
        }
    }
}

/// A workspace profile
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceProfile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_default: bool,
    pub config: WorkspaceConfig,
}

/// State of all workspace profiles
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfilesState {
    pub profiles: Vec<WorkspaceProfile>,
    pub active_profile_id: Option<String>,
    pub last_switched: Option<String>,
}

/// Get the profiles directory path
fn get_profiles_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let profiles_dir = app_data.join("workspace-profiles");
    
    if !profiles_dir.exists() {
        fs::create_dir_all(&profiles_dir)
            .map_err(|e| format!("Failed to create profiles directory: {}", e))?;
    }
    
    Ok(profiles_dir)
}

/// Get the profiles state file path
fn get_state_file<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let profiles_dir = get_profiles_dir(app)?;
    Ok(profiles_dir.join("profiles-state.json"))
}

/// Load all workspace profiles
#[tauri::command]
pub async fn load_workspace_profiles<R: Runtime>(app: AppHandle<R>) -> Result<ProfilesState, String> {
    let state_file = get_state_file(&app)?;
    
    if state_file.exists() {
        let content = fs::read_to_string(&state_file)
            .map_err(|e| format!("Failed to read profiles state: {}", e))?;
        
        let state: ProfilesState = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse profiles state: {}", e))?;
        
        Ok(state)
    } else {
        // Return empty state - frontend will create default profile
        Ok(ProfilesState::default())
    }
}

/// Save a workspace profile
#[tauri::command]
pub async fn save_workspace_profile<R: Runtime>(
    app: AppHandle<R>,
    profile: WorkspaceProfile,
) -> Result<(), String> {
    let mut state = load_workspace_profiles(app.clone()).await?;
    
    // Update or add profile
    let existing_idx = state.profiles.iter().position(|p| p.id == profile.id);
    
    if let Some(idx) = existing_idx {
        state.profiles[idx] = profile;
    } else {
        state.profiles.push(profile);
    }
    
    // Save state
    let state_file = get_state_file(&app)?;
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize profiles state: {}", e))?;
    
    fs::write(&state_file, content)
        .map_err(|e| format!("Failed to write profiles state: {}", e))?;
    
    Ok(())
}

/// Delete a workspace profile
#[tauri::command]
pub async fn delete_workspace_profile<R: Runtime>(
    app: AppHandle<R>,
    profile_id: String,
) -> Result<(), String> {
    let mut state = load_workspace_profiles(app.clone()).await?;
    
    // Remove profile
    state.profiles.retain(|p| p.id != profile_id);
    
    // Clear active if deleted
    if state.active_profile_id == Some(profile_id) {
        state.active_profile_id = state.profiles.first().map(|p| p.id.clone());
    }
    
    // Save state
    let state_file = get_state_file(&app)?;
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize profiles state: {}", e))?;
    
    fs::write(&state_file, content)
        .map_err(|e| format!("Failed to write profiles state: {}", e))?;
    
    Ok(())
}

/// Set the active profile ID
#[tauri::command]
pub async fn set_active_profile_id<R: Runtime>(
    app: AppHandle<R>,
    profile_id: String,
) -> Result<(), String> {
    let mut state = load_workspace_profiles(app.clone()).await?;
    
    state.active_profile_id = Some(profile_id);
    state.last_switched = Some(chrono::Utc::now().to_rfc3339());
    
    // Save state
    let state_file = get_state_file(&app)?;
    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize profiles state: {}", e))?;
    
    fs::write(&state_file, content)
        .map_err(|e| format!("Failed to write profiles state: {}", e))?;
    
    Ok(())
}

/// Capture current workspace state
#[tauri::command]
pub async fn capture_workspace_state<R: Runtime>(
    app: AppHandle<R>,
) -> Result<WorkspaceConfig, String> {
    let mut config = WorkspaceConfig::default();
    
    // Try to get main window state
    if let Some(window) = app.get_webview_window("main") {
        // Get position
        if let Ok(position) = window.outer_position() {
            config.window_state.x = position.x;
            config.window_state.y = position.y;
        }
        
        // Get size
        if let Ok(size) = window.outer_size() {
            config.window_state.width = size.width;
            config.window_state.height = size.height;
        }
        
        // Get maximized state
        if let Ok(maximized) = window.is_maximized() {
            config.window_state.maximized = maximized;
        }
        
        // Get fullscreen state
        if let Ok(fullscreen) = window.is_fullscreen() {
            config.window_state.fullscreen = fullscreen;
        }
        
        // Get zoom level
        if let Ok(zoom) = window.scale_factor() {
            config.zoom_level = (zoom * 100.0) as u32;
        }
    }
    
    // Additional state can be captured via frontend and passed in
    // For now we capture what we can from Tauri APIs
    
    Ok(config)
}

/// Apply a workspace profile
#[tauri::command]
pub async fn apply_workspace_profile<R: Runtime>(
    app: AppHandle<R>,
    profile: WorkspaceProfile,
) -> Result<(), String> {
    let config = &profile.config;
    
    // Apply window state
    if let Some(window) = app.get_webview_window("main") {
        // Restore from fullscreen/maximized first if needed
        if window.is_fullscreen().unwrap_or(false) && !config.window_state.fullscreen {
            let _ = window.set_fullscreen(false);
        }
        
        if window.is_maximized().unwrap_or(false) && !config.window_state.maximized {
            let _ = window.unmaximize();
        }
        
        // Set position and size (only if not maximized/fullscreen)
        if !config.window_state.maximized && !config.window_state.fullscreen {
            let _ = window.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition::new(config.window_state.x, config.window_state.y)
            ));
            
            let _ = window.set_size(tauri::Size::Physical(
                tauri::PhysicalSize::new(config.window_state.width, config.window_state.height)
            ));
        }
        
        // Apply maximized/fullscreen
        if config.window_state.maximized {
            let _ = window.maximize();
        }
        
        if config.window_state.fullscreen {
            let _ = window.set_fullscreen(true);
        }
        
        // Apply zoom level
        let zoom_factor = config.zoom_level as f64 / 100.0;
        let _ = window.set_zoom(zoom_factor);
    }
    
    // Emit event to frontend to apply remaining settings
    app.emit("workspace-profile-applied", &profile)
        .map_err(|e| format!("Failed to emit profile event: {}", e))?;
    
    Ok(())
}

/// Export a profile to JSON
#[tauri::command]
pub async fn export_workspace_profile(
    profile: WorkspaceProfile,
) -> Result<String, String> {
    serde_json::to_string_pretty(&profile)
        .map_err(|e| format!("Failed to serialize profile: {}", e))
}

/// Import a profile from JSON
#[tauri::command]
pub async fn import_workspace_profile(
    json: String,
) -> Result<WorkspaceProfile, String> {
    serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse profile JSON: {}", e))
}

/// Get workspace profile statistics
#[tauri::command]
pub async fn get_workspace_profile_stats<R: Runtime>(
    app: AppHandle<R>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let state = load_workspace_profiles(app).await?;
    
    let mut stats = HashMap::new();
    
    stats.insert("total_profiles".to_string(), serde_json::json!(state.profiles.len()));
    stats.insert("active_profile_id".to_string(), serde_json::json!(state.active_profile_id));
    stats.insert("last_switched".to_string(), serde_json::json!(state.last_switched));
    
    // Profile usage stats could be tracked and reported here
    let default_count = state.profiles.iter().filter(|p| p.is_default).count();
    stats.insert("default_profiles".to_string(), serde_json::json!(default_count));
    
    Ok(stats)
}

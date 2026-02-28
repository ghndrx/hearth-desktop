// Session Restore - Save and restore app state between launches
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
    pub fullscreen: bool,
    pub monitor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelState {
    pub channel_id: String,
    pub server_id: Option<String>,
    pub scroll_position: f64,
    pub draft_content: Option<String>,
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SidebarState {
    pub collapsed_categories: Vec<String>,
    pub collapsed_servers: Vec<String>,
    pub width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionState {
    pub version: u32,
    pub timestamp: u64,
    pub active_channel_id: Option<String>,
    pub active_server_id: Option<String>,
    pub open_channels: Vec<ChannelState>,
    pub window_state: WindowState,
    pub sidebar_state: SidebarState,
    pub split_view_enabled: bool,
    pub split_view_channels: Vec<String>,
    pub theme: Option<String>,
    pub zoom_level: f64,
    pub custom_data: HashMap<String, String>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            version: 1,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            zoom_level: 1.0,
            ..Default::default()
        }
    }
}

fn get_session_file_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    
    Ok(app_data_dir.join("session_state.json"))
}

fn get_backup_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    Ok(app_data_dir.join("session_state.backup.json"))
}

#[tauri::command]
pub async fn save_session_state<R: Runtime>(
    app: AppHandle<R>,
    state: SessionState,
) -> Result<(), String> {
    let file_path = get_session_file_path(&app)?;
    let backup_path = get_backup_path(&app)?;
    
    // Create backup of existing state
    if file_path.exists() {
        fs::copy(&file_path, &backup_path)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }
    
    // Update timestamp
    let mut state = state;
    state.timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    let json = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;
    
    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write session state: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn load_session_state<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<SessionState>, String> {
    let file_path = get_session_file_path(&app)?;
    
    if !file_path.exists() {
        return Ok(None);
    }
    
    let contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read session state: {}", e))?;
    
    let state: SessionState = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse session state: {}", e))?;
    
    Ok(Some(state))
}

#[tauri::command]
pub async fn clear_session_state<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let file_path = get_session_file_path(&app)?;
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to remove session state: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn restore_from_backup<R: Runtime>(app: AppHandle<R>) -> Result<Option<SessionState>, String> {
    let backup_path = get_backup_path(&app)?;
    
    if !backup_path.exists() {
        return Ok(None);
    }
    
    let contents = fs::read_to_string(&backup_path)
        .map_err(|e| format!("Failed to read backup: {}", e))?;
    
    let state: SessionState = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse backup: {}", e))?;
    
    Ok(Some(state))
}

#[tauri::command]
pub async fn get_session_info<R: Runtime>(app: AppHandle<R>) -> Result<HashMap<String, serde_json::Value>, String> {
    let file_path = get_session_file_path(&app)?;
    let backup_path = get_backup_path(&app)?;
    
    let mut info = HashMap::new();
    
    info.insert("has_session".to_string(), serde_json::Value::Bool(file_path.exists()));
    info.insert("has_backup".to_string(), serde_json::Value::Bool(backup_path.exists()));
    
    if file_path.exists() {
        if let Ok(metadata) = fs::metadata(&file_path) {
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                    info.insert("last_saved".to_string(), serde_json::Value::Number(duration.as_secs().into()));
                }
            }
            info.insert("size_bytes".to_string(), serde_json::Value::Number(metadata.len().into()));
        }
    }
    
    Ok(info)
}

#[tauri::command]
pub async fn capture_window_state<R: Runtime>(app: AppHandle<R>) -> Result<WindowState, String> {
    let window = app.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let position = window.outer_position()
        .map_err(|e| format!("Failed to get position: {}", e))?;
    
    let size = window.outer_size()
        .map_err(|e| format!("Failed to get size: {}", e))?;
    
    let maximized = window.is_maximized()
        .map_err(|e| format!("Failed to check maximized: {}", e))?;
    
    let fullscreen = window.is_fullscreen()
        .map_err(|e| format!("Failed to check fullscreen: {}", e))?;
    
    Ok(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
        fullscreen,
        monitor: None,
    })
}

#[tauri::command]
pub async fn restore_window_state<R: Runtime>(
    app: AppHandle<R>,
    state: WindowState,
) -> Result<(), String> {
    let window = app.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    // Restore position and size
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: state.x,
        y: state.y,
    })).map_err(|e| format!("Failed to set position: {}", e))?;
    
    window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: state.width,
        height: state.height,
    })).map_err(|e| format!("Failed to set size: {}", e))?;
    
    // Restore window state
    if state.fullscreen {
        window.set_fullscreen(true)
            .map_err(|e| format!("Failed to set fullscreen: {}", e))?;
    } else if state.maximized {
        window.maximize()
            .map_err(|e| format!("Failed to maximize: {}", e))?;
    }
    
    Ok(())
}

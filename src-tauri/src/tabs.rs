//! Window tabs management for browser-like tab experience
//!
//! Provides persistence and management of window tabs with support for:
//! - Tab creation, closing, and reordering
//! - Tab pinning and modification tracking
//! - Tab groups with colors
//! - Keyboard shortcuts and context menus

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime, State};

/// Represents a single window tab
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowTab {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub route: String,
    pub is_pinned: bool,
    pub is_modified: bool,
    pub created_at: i64,
    pub last_accessed_at: i64,
}

/// Represents a group of tabs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabGroup {
    pub id: String,
    pub name: String,
    pub color: String,
    pub tab_ids: Vec<String>,
    pub is_collapsed: bool,
}

/// State for tab management
#[derive(Debug, Default)]
pub struct TabsState {
    pub tabs: Mutex<Vec<WindowTab>>,
    pub groups: Mutex<Vec<TabGroup>>,
    pub active_tab_id: Mutex<Option<String>>,
}

/// Persisted tab data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct TabsData {
    tabs: Vec<WindowTab>,
    groups: Vec<TabGroup>,
    active_tab_id: Option<String>,
}

/// Get the path to the tabs data file
fn get_tabs_path<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_dir.join("window_tabs.json")
}

/// Load tabs from disk
fn load_tabs_data<R: Runtime>(app: &AppHandle<R>) -> TabsData {
    let path = get_tabs_path(app);
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(e) => {
                eprintln!("Failed to read tabs file: {}", e);
                TabsData::default()
            }
        }
    } else {
        TabsData::default()
    }
}

/// Save tabs to disk
fn save_tabs_data<R: Runtime>(app: &AppHandle<R>, data: &TabsData) -> Result<(), String> {
    let path = get_tabs_path(app);
    
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize tabs: {}", e))?;
    
    fs::write(&path, json).map_err(|e| format!("Failed to write tabs file: {}", e))?;
    
    Ok(())
}

/// Initialize tabs state from persisted data
pub fn init_tabs_state<R: Runtime>(app: &AppHandle<R>) -> TabsState {
    let data = load_tabs_data(app);
    
    TabsState {
        tabs: Mutex::new(data.tabs),
        groups: Mutex::new(data.groups),
        active_tab_id: Mutex::new(data.active_tab_id),
    }
}

/// Get all window tabs
#[tauri::command]
pub async fn get_window_tabs(state: State<'_, TabsState>) -> Result<Vec<WindowTab>, String> {
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?;
    Ok(tabs.clone())
}

/// Get all tab groups
#[tauri::command]
pub async fn get_tab_groups(state: State<'_, TabsState>) -> Result<Vec<TabGroup>, String> {
    let groups = state.groups.lock().map_err(|e| e.to_string())?;
    Ok(groups.clone())
}

/// Get the active tab ID
#[tauri::command]
pub async fn get_active_tab_id(state: State<'_, TabsState>) -> Result<Option<String>, String> {
    let active = state.active_tab_id.lock().map_err(|e| e.to_string())?;
    Ok(active.clone())
}

/// Save window tabs
#[tauri::command]
pub async fn save_window_tabs<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    tabs: Vec<WindowTab>,
    active_tab_id: Option<String>,
) -> Result<(), String> {
    {
        let mut state_tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        *state_tabs = tabs.clone();
    }
    
    {
        let mut state_active = state.active_tab_id.lock().map_err(|e| e.to_string())?;
        *state_active = active_tab_id.clone();
    }
    
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    
    save_tabs_data(&app, &data)
}

/// Save tab groups
#[tauri::command]
pub async fn save_tab_groups<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    groups: Vec<TabGroup>,
) -> Result<(), String> {
    {
        let mut state_groups = state.groups.lock().map_err(|e| e.to_string())?;
        *state_groups = groups.clone();
    }
    
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    
    save_tabs_data(&app, &data)
}

/// Confirm tab close dialog
/// Returns true to confirm close, false to cancel
/// Note: For now returns true; frontend should implement its own dialog
#[tauri::command]
pub async fn confirm_close_tab<R: Runtime>(
    _app: AppHandle<R>,
    _title: String,
    _message: String,
) -> Result<bool, String> {
    // The frontend will show its own confirmation dialog
    // This command exists for future native dialog integration
    Ok(true)
}

/// Create a new tab
#[tauri::command]
pub async fn create_window_tab<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    route: String,
    title: String,
) -> Result<WindowTab, String> {
    let new_tab = WindowTab {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        icon: None,
        route,
        is_pinned: false,
        is_modified: false,
        created_at: chrono::Utc::now().timestamp_millis(),
        last_accessed_at: chrono::Utc::now().timestamp_millis(),
    };
    
    {
        let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        tabs.push(new_tab.clone());
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = Some(new_tab.id.clone());
    
    {
        let mut state_active = state.active_tab_id.lock().map_err(|e| e.to_string())?;
        *state_active = active_tab_id.clone();
    }
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)?;
    
    Ok(new_tab)
}

/// Close a tab
#[tauri::command]
pub async fn close_window_tab<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    tab_id: String,
) -> Result<(), String> {
    let mut new_active: Option<String> = None;
    
    {
        let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        let active = state.active_tab_id.lock().map_err(|e| e.to_string())?;
        
        if let Some(index) = tabs.iter().position(|t| t.id == tab_id) {
            tabs.remove(index);
            
            // If closing active tab, select adjacent
            if active.as_ref() == Some(&tab_id) && !tabs.is_empty() {
                let new_index = index.min(tabs.len() - 1);
                new_active = Some(tabs[new_index].id.clone());
            }
        }
    }
    
    if let Some(id) = new_active {
        let mut state_active = state.active_tab_id.lock().map_err(|e| e.to_string())?;
        *state_active = Some(id);
    }
    
    // Remove from groups
    {
        let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
        for group in groups.iter_mut() {
            group.tab_ids.retain(|id| id != &tab_id);
        }
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)
}

/// Toggle tab pinned state
#[tauri::command]
pub async fn toggle_tab_pinned<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    tab_id: String,
) -> Result<bool, String> {
    let new_pinned_state;
    
    {
        let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        
        if let Some(tab) = tabs.iter_mut().find(|t| t.id == tab_id) {
            tab.is_pinned = !tab.is_pinned;
            new_pinned_state = tab.is_pinned;
        } else {
            return Err("Tab not found".to_string());
        }
        
        // Sort: pinned tabs first
        tabs.sort_by(|a, b| b.is_pinned.cmp(&a.is_pinned));
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)?;
    
    Ok(new_pinned_state)
}

/// Update tab modification state
#[tauri::command]
pub async fn set_tab_modified<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    tab_id: String,
    is_modified: bool,
) -> Result<(), String> {
    {
        let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        
        if let Some(tab) = tabs.iter_mut().find(|t| t.id == tab_id) {
            tab.is_modified = is_modified;
        } else {
            return Err("Tab not found".to_string());
        }
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)
}

/// Reorder tabs
#[tauri::command]
pub async fn reorder_tabs<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    from_index: usize,
    to_index: usize,
) -> Result<(), String> {
    {
        let mut tabs = state.tabs.lock().map_err(|e| e.to_string())?;
        
        if from_index >= tabs.len() || to_index >= tabs.len() {
            return Err("Invalid index".to_string());
        }
        
        let tab = tabs.remove(from_index);
        tabs.insert(to_index, tab);
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)
}

/// Create a new tab group
#[tauri::command]
pub async fn create_tab_group<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    name: String,
    color: String,
) -> Result<TabGroup, String> {
    let group = TabGroup {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        color,
        tab_ids: Vec::new(),
        is_collapsed: false,
    };
    
    {
        let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
        groups.push(group.clone());
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)?;
    
    Ok(group)
}

/// Add a tab to a group
#[tauri::command]
pub async fn add_tab_to_group<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    tab_id: String,
    group_id: String,
) -> Result<(), String> {
    {
        let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
        
        // Remove from other groups first
        for group in groups.iter_mut() {
            group.tab_ids.retain(|id| id != &tab_id);
        }
        
        // Add to target group
        if let Some(group) = groups.iter_mut().find(|g| g.id == group_id) {
            group.tab_ids.push(tab_id);
        } else {
            return Err("Group not found".to_string());
        }
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)
}

/// Remove a tab from all groups
#[tauri::command]
pub async fn remove_tab_from_groups<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    tab_id: String,
) -> Result<(), String> {
    {
        let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
        
        for group in groups.iter_mut() {
            group.tab_ids.retain(|id| id != &tab_id);
        }
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)
}

/// Delete a tab group
#[tauri::command]
pub async fn delete_tab_group<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    group_id: String,
) -> Result<(), String> {
    {
        let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
        groups.retain(|g| g.id != group_id);
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)
}

/// Toggle group collapsed state
#[tauri::command]
pub async fn toggle_group_collapsed<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TabsState>,
    group_id: String,
) -> Result<bool, String> {
    let new_collapsed;
    
    {
        let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
        
        if let Some(group) = groups.iter_mut().find(|g| g.id == group_id) {
            group.is_collapsed = !group.is_collapsed;
            new_collapsed = group.is_collapsed;
        } else {
            return Err("Group not found".to_string());
        }
    }
    
    // Save to disk
    let tabs = state.tabs.lock().map_err(|e| e.to_string())?.clone();
    let groups = state.groups.lock().map_err(|e| e.to_string())?.clone();
    let active_tab_id = state.active_tab_id.lock().map_err(|e| e.to_string())?.clone();
    
    let data = TabsData {
        tabs,
        groups,
        active_tab_id,
    };
    save_tabs_data(&app, &data)?;
    
    Ok(new_collapsed)
}

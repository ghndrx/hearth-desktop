use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub icon: String,         // emoji or short label
    pub color: String,        // hex color
    pub server_ids: Vec<String>,
    pub channel_ids: Vec<String>,
    pub is_active: bool,
    pub created_at: i64,
    pub last_used: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSwitcherState {
    pub workspaces: Vec<Workspace>,
    pub active_id: Option<String>,
}

pub struct WorkspaceSwitcherManager {
    state: Mutex<WorkspaceSwitcherState>,
}

impl Default for WorkspaceSwitcherManager {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        Self {
            state: Mutex::new(WorkspaceSwitcherState {
                workspaces: vec![
                    Workspace {
                        id: "ws-default".into(),
                        name: "General".into(),
                        icon: "G".into(),
                        color: "#5865f2".into(),
                        server_ids: Vec::new(),
                        channel_ids: Vec::new(),
                        is_active: true,
                        created_at: now,
                        last_used: now,
                    },
                    Workspace {
                        id: "ws-work".into(),
                        name: "Work".into(),
                        icon: "W".into(),
                        color: "#23a55a".into(),
                        server_ids: Vec::new(),
                        channel_ids: Vec::new(),
                        is_active: false,
                        created_at: now,
                        last_used: now,
                    },
                ],
                active_id: Some("ws-default".into()),
            }),
        }
    }
}

fn with_state<F, R>(mgr: &WorkspaceSwitcherManager, f: F) -> Result<R, String>
where
    F: FnOnce(&mut WorkspaceSwitcherState) -> R,
{
    let mut state = mgr.state.lock().map_err(|e| e.to_string())?;
    Ok(f(&mut state))
}

#[tauri::command]
pub fn wkspc_get_state(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| s.clone())
}

#[tauri::command]
pub fn wkspc_switch(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
    workspace_id: String,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| {
        for ws in s.workspaces.iter_mut() {
            ws.is_active = ws.id == workspace_id;
            if ws.id == workspace_id {
                ws.last_used = chrono::Utc::now().timestamp_millis();
            }
        }
        s.active_id = Some(workspace_id);
        s.clone()
    })
}

#[tauri::command]
pub fn wkspc_create(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
    name: String,
    icon: Option<String>,
    color: Option<String>,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| {
        let now = chrono::Utc::now().timestamp_millis();
        let id = format!(
            "ws-{}",
            uuid::Uuid::new_v4()
                .to_string()
                .split('-')
                .next()
                .unwrap_or("0")
        );
        let icon_val = icon.unwrap_or_else(|| {
            name.chars().next().unwrap_or('?').to_uppercase().to_string()
        });
        s.workspaces.push(Workspace {
            id,
            name,
            icon: icon_val,
            color: color.unwrap_or_else(|| "#5865f2".into()),
            server_ids: Vec::new(),
            channel_ids: Vec::new(),
            is_active: false,
            created_at: now,
            last_used: now,
        });
        s.clone()
    })
}

#[tauri::command]
pub fn wkspc_delete(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
    workspace_id: String,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| {
        s.workspaces.retain(|w| w.id != workspace_id);
        if s.active_id.as_deref() == Some(&workspace_id) {
            s.active_id = s.workspaces.first().map(|w| w.id.clone());
            if let Some(first) = s.workspaces.first_mut() {
                first.is_active = true;
            }
        }
        s.clone()
    })
}

#[tauri::command]
pub fn wkspc_update(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
    workspace_id: String,
    name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| {
        if let Some(ws) = s.workspaces.iter_mut().find(|w| w.id == workspace_id) {
            if let Some(n) = name {
                ws.name = n;
            }
            if let Some(i) = icon {
                ws.icon = i;
            }
            if let Some(c) = color {
                ws.color = c;
            }
        }
        s.clone()
    })
}

#[tauri::command]
pub fn wkspc_add_server(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
    workspace_id: String,
    server_id: String,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| {
        if let Some(ws) = s.workspaces.iter_mut().find(|w| w.id == workspace_id) {
            if !ws.server_ids.contains(&server_id) {
                ws.server_ids.push(server_id);
            }
        }
        s.clone()
    })
}

#[tauri::command]
pub fn wkspc_remove_server(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
    workspace_id: String,
    server_id: String,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| {
        if let Some(ws) = s.workspaces.iter_mut().find(|w| w.id == workspace_id) {
            ws.server_ids.retain(|id| id != &server_id);
        }
        s.clone()
    })
}

#[tauri::command]
pub fn wkspc_add_channel(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
    workspace_id: String,
    channel_id: String,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| {
        if let Some(ws) = s.workspaces.iter_mut().find(|w| w.id == workspace_id) {
            if !ws.channel_ids.contains(&channel_id) {
                ws.channel_ids.push(channel_id);
            }
        }
        s.clone()
    })
}

#[tauri::command]
pub fn wkspc_remove_channel(
    mgr: tauri::State<'_, WorkspaceSwitcherManager>,
    workspace_id: String,
    channel_id: String,
) -> Result<WorkspaceSwitcherState, String> {
    with_state(&mgr, |s| {
        if let Some(ws) = s.workspaces.iter_mut().find(|w| w.id == workspace_id) {
            ws.channel_ids.retain(|id| id != &channel_id);
        }
        s.clone()
    })
}

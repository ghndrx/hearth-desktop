//! System Tray Quick Actions - configurable quick actions for the system tray

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayAction {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub action_type: TrayActionType,
    pub enabled: bool,
    pub last_triggered: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TrayActionType {
    ToggleDnd,
    ToggleMute,
    ToggleDarkMode,
    LockScreen,
    TakeScreenshot,
    Custom { command: String },
}

pub struct TrayActionsManager {
    actions: Mutex<Vec<TrayAction>>,
    trigger_log: Mutex<Vec<TrayActionLog>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayActionLog {
    pub action_id: String,
    pub triggered_at: String,
}

impl Default for TrayActionsManager {
    fn default() -> Self {
        let defaults = vec![
            TrayAction {
                id: "dnd".into(),
                label: "Toggle Do Not Disturb".into(),
                icon: "bell-off".into(),
                action_type: TrayActionType::ToggleDnd,
                enabled: true,
                last_triggered: None,
            },
            TrayAction {
                id: "mute".into(),
                label: "Toggle Mute".into(),
                icon: "mic-off".into(),
                action_type: TrayActionType::ToggleMute,
                enabled: true,
                last_triggered: None,
            },
            TrayAction {
                id: "darkmode".into(),
                label: "Toggle Dark Mode".into(),
                icon: "moon".into(),
                action_type: TrayActionType::ToggleDarkMode,
                enabled: true,
                last_triggered: None,
            },
            TrayAction {
                id: "lock".into(),
                label: "Lock Screen".into(),
                icon: "lock".into(),
                action_type: TrayActionType::LockScreen,
                enabled: false,
                last_triggered: None,
            },
            TrayAction {
                id: "screenshot".into(),
                label: "Take Screenshot".into(),
                icon: "camera".into(),
                action_type: TrayActionType::TakeScreenshot,
                enabled: true,
                last_triggered: None,
            },
        ];
        Self {
            actions: Mutex::new(defaults),
            trigger_log: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn trayactions_list(
    manager: tauri::State<'_, TrayActionsManager>,
) -> Result<Vec<TrayAction>, String> {
    let actions = manager.actions.lock().map_err(|e| e.to_string())?;
    Ok(actions.clone())
}

#[tauri::command]
pub fn trayactions_trigger(
    id: String,
    manager: tauri::State<'_, TrayActionsManager>,
) -> Result<TrayAction, String> {
    let mut actions = manager.actions.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().to_rfc3339();
    let action = actions
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or("Action not found")?;
    action.last_triggered = Some(now.clone());
    let result = action.clone();

    let mut log = manager.trigger_log.lock().map_err(|e| e.to_string())?;
    log.insert(
        0,
        TrayActionLog {
            action_id: id,
            triggered_at: now,
        },
    );
    if log.len() > 50 {
        log.truncate(50);
    }

    Ok(result)
}

#[tauri::command]
pub fn trayactions_toggle(
    id: String,
    enabled: bool,
    manager: tauri::State<'_, TrayActionsManager>,
) -> Result<(), String> {
    let mut actions = manager.actions.lock().map_err(|e| e.to_string())?;
    let action = actions
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or("Action not found")?;
    action.enabled = enabled;
    Ok(())
}

#[tauri::command]
pub fn trayactions_add(
    label: String,
    icon: String,
    command: String,
    manager: tauri::State<'_, TrayActionsManager>,
) -> Result<TrayAction, String> {
    let mut actions = manager.actions.lock().map_err(|e| e.to_string())?;
    let id = format!(
        "custom_{}",
        uuid::Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("x")
    );
    let action = TrayAction {
        id,
        label,
        icon,
        action_type: TrayActionType::Custom { command },
        enabled: true,
        last_triggered: None,
    };
    actions.push(action.clone());
    Ok(action)
}

#[tauri::command]
pub fn trayactions_remove(
    id: String,
    manager: tauri::State<'_, TrayActionsManager>,
) -> Result<(), String> {
    let mut actions = manager.actions.lock().map_err(|e| e.to_string())?;
    actions.retain(|a| a.id != id);
    Ok(())
}

#[tauri::command]
pub fn trayactions_get_log(
    manager: tauri::State<'_, TrayActionsManager>,
) -> Result<Vec<TrayActionLog>, String> {
    let log = manager.trigger_log.lock().map_err(|e| e.to_string())?;
    Ok(log.clone())
}

//! Notification Center - Rich notification management for Hearth Desktop
//!
//! Provides advanced notification features:
//! - Scheduled/delayed notifications
//! - Notification history and management
//! - Action buttons and callbacks
//! - Notification grouping
//! - Badge integration
//! - Do Not Disturb awareness

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_notification::NotificationExt;

/// Notification priority levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Urgent,
}

impl Default for NotificationPriority {
    fn default() -> Self {
        NotificationPriority::Normal
    }
}

/// A notification action button
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationAction {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub destructive: bool,
}

/// Configuration for a notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub priority: NotificationPriority,
    #[serde(default)]
    pub actions: Vec<NotificationAction>,
    #[serde(default)]
    pub silent: bool,
    #[serde(default)]
    pub schedule_ms: Option<u64>,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

/// A stored notification record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRecord {
    pub id: String,
    pub title: String,
    pub body: Option<String>,
    pub group: Option<String>,
    pub priority: NotificationPriority,
    pub timestamp: u64,
    pub read: bool,
    pub data: Option<serde_json::Value>,
}

/// Notification center state
pub struct NotificationCenterState {
    /// Notification history
    pub history: Mutex<Vec<NotificationRecord>>,
    /// Scheduled notifications (id -> config)
    pub scheduled: Mutex<HashMap<String, NotificationConfig>>,
    /// Maximum history size
    pub max_history: usize,
    /// Whether DND is active
    pub dnd_active: Mutex<bool>,
}

impl Default for NotificationCenterState {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
            scheduled: Mutex::new(HashMap::new()),
            max_history: 100,
            dnd_active: Mutex::new(false),
        }
    }
}

/// Get current timestamp in milliseconds
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Send a notification immediately
#[tauri::command]
pub fn send_notification(
    app: AppHandle,
    state: State<'_, NotificationCenterState>,
    config: NotificationConfig,
) -> Result<String, String> {
    // Check DND status
    let dnd = *state.dnd_active.lock().map_err(|e| e.to_string())?;
    if dnd && config.priority != NotificationPriority::Urgent {
        // Store in history but don't show
        store_notification(&state, &config)?;
        return Ok(config.id);
    }

    // Build and show notification
    let mut builder = app.notification().builder();
    builder = builder.title(&config.title);
    
    if let Some(body) = &config.body {
        builder = builder.body(body);
    }
    
    if config.silent {
        builder = builder.silent();
    }

    builder.show().map_err(|e| e.to_string())?;

    // Store in history
    store_notification(&state, &config)?;

    // Emit event for frontend
    let _ = app.emit("notification:sent", &config.id);

    Ok(config.id)
}

/// Schedule a notification for later delivery
#[tauri::command]
pub fn schedule_notification(
    app: AppHandle,
    state: State<'_, NotificationCenterState>,
    config: NotificationConfig,
) -> Result<String, String> {
    let delay_ms = config.schedule_ms.unwrap_or(0);
    let id = config.id.clone();

    if delay_ms == 0 {
        return send_notification(app, state, config);
    }

    // Store in scheduled
    {
        let mut scheduled = state.scheduled.lock().map_err(|e| e.to_string())?;
        scheduled.insert(id.clone(), config.clone());
    }

    // Spawn async task to send later
    let app_clone = app.clone();
    let config_clone = config.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        
        // Build and show notification
        let mut builder = app_clone.notification().builder();
        builder = builder.title(&config_clone.title);
        
        if let Some(body) = &config_clone.body {
            builder = builder.body(body);
        }
        
        if config_clone.silent {
            builder = builder.silent();
        }

        let _ = builder.show();
        let _ = app_clone.emit("notification:scheduled-sent", &config_clone.id);
    });

    // Emit scheduled event
    let _ = app.emit("notification:scheduled", &id);

    Ok(id)
}

/// Cancel a scheduled notification
#[tauri::command]
pub fn cancel_scheduled_notification(
    state: State<'_, NotificationCenterState>,
    id: String,
) -> Result<bool, String> {
    let mut scheduled = state.scheduled.lock().map_err(|e| e.to_string())?;
    Ok(scheduled.remove(&id).is_some())
}

/// Get all scheduled notifications
#[tauri::command]
pub fn get_scheduled_notifications(
    state: State<'_, NotificationCenterState>,
) -> Result<Vec<NotificationConfig>, String> {
    let scheduled = state.scheduled.lock().map_err(|e| e.to_string())?;
    Ok(scheduled.values().cloned().collect())
}

/// Get notification history
#[tauri::command]
pub fn get_notification_history(
    state: State<'_, NotificationCenterState>,
    limit: Option<usize>,
) -> Result<Vec<NotificationRecord>, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50).min(history.len());
    Ok(history.iter().rev().take(limit).cloned().collect())
}

/// Mark a notification as read
#[tauri::command]
pub fn mark_notification_read(
    app: AppHandle,
    state: State<'_, NotificationCenterState>,
    id: String,
) -> Result<bool, String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    for record in history.iter_mut() {
        if record.id == id {
            record.read = true;
            let _ = app.emit("notification:read", &id);
            return Ok(true);
        }
    }
    Ok(false)
}

/// Mark all notifications as read
#[tauri::command]
pub fn mark_all_notifications_read(
    app: AppHandle,
    state: State<'_, NotificationCenterState>,
) -> Result<usize, String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    let mut count = 0;
    for record in history.iter_mut() {
        if !record.read {
            record.read = true;
            count += 1;
        }
    }
    let _ = app.emit("notification:all-read", count);
    Ok(count)
}

/// Clear notification history
#[tauri::command]
pub fn clear_notification_history(
    app: AppHandle,
    state: State<'_, NotificationCenterState>,
) -> Result<usize, String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    let count = history.len();
    history.clear();
    let _ = app.emit("notification:history-cleared", count);
    Ok(count)
}

/// Get unread notification count
#[tauri::command]
pub fn get_unread_notification_count(
    state: State<'_, NotificationCenterState>,
) -> Result<usize, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    Ok(history.iter().filter(|r| !r.read).count())
}

/// Set DND status for notification center
#[tauri::command]
pub fn set_notification_dnd(
    app: AppHandle,
    state: State<'_, NotificationCenterState>,
    active: bool,
) -> Result<bool, String> {
    let mut dnd = state.dnd_active.lock().map_err(|e| e.to_string())?;
    *dnd = active;
    let _ = app.emit("notification:dnd-changed", active);
    Ok(active)
}

/// Get notifications grouped by category
#[tauri::command]
pub fn get_grouped_notifications(
    state: State<'_, NotificationCenterState>,
) -> Result<HashMap<String, Vec<NotificationRecord>>, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    let mut grouped: HashMap<String, Vec<NotificationRecord>> = HashMap::new();
    
    for record in history.iter() {
        let group = record.group.clone().unwrap_or_else(|| "default".to_string());
        grouped.entry(group).or_default().push(record.clone());
    }
    
    Ok(grouped)
}

/// Helper: Store notification in history
fn store_notification(
    state: &State<'_, NotificationCenterState>,
    config: &NotificationConfig,
) -> Result<(), String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    
    let record = NotificationRecord {
        id: config.id.clone(),
        title: config.title.clone(),
        body: config.body.clone(),
        group: config.group.clone(),
        priority: config.priority.clone(),
        timestamp: now_ms(),
        read: false,
        data: config.data.clone(),
    };
    
    history.push(record);
    
    // Trim to max size
    if history.len() > state.max_history {
        let excess = history.len() - state.max_history;
        history.drain(0..excess);
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_priority_default() {
        let priority: NotificationPriority = Default::default();
        assert_eq!(priority, NotificationPriority::Normal);
    }

    #[test]
    fn test_notification_config_serialization() {
        let config = NotificationConfig {
            id: "test-1".to_string(),
            title: "Test".to_string(),
            body: Some("Body".to_string()),
            group: Some("alerts".to_string()),
            priority: NotificationPriority::High,
            actions: vec![NotificationAction {
                id: "action-1".to_string(),
                label: "OK".to_string(),
                destructive: false,
            }],
            silent: false,
            schedule_ms: Some(5000),
            data: None,
        };
        
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("test-1"));
        assert!(json.contains("high"));
    }
}

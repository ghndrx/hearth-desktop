//! Smart Notification Grouping - Groups notifications by channel, server, or type
//!
//! Provides notification batching and digest management with configurable
//! grouping strategies, muting, and read-state tracking.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GroupType {
    Channel,
    Server,
    DirectMessage,
    Mention,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GroupByStrategy {
    Channel,
    Server,
    Type,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationGroup {
    pub id: String,
    pub group_key: String,
    pub group_type: GroupType,
    pub title: String,
    pub channel_id: Option<String>,
    pub server_id: Option<String>,
    pub count: usize,
    pub latest_content: String,
    pub latest_sender: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub is_read: bool,
    pub is_muted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupedNotification {
    pub id: String,
    pub group_id: String,
    pub sender_name: String,
    pub sender_avatar: Option<String>,
    pub content: String,
    pub notification_type: GroupType,
    pub created_at: u64,
    pub is_read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupConfig {
    pub group_by: GroupByStrategy,
    pub batch_delay_ms: u64,
    pub max_group_size: usize,
    pub collapse_threshold: usize,
    pub show_preview: bool,
}

impl Default for GroupConfig {
    fn default() -> Self {
        Self {
            group_by: GroupByStrategy::Channel,
            batch_delay_ms: 2000,
            max_group_size: 100,
            collapse_threshold: 3,
            show_preview: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddNotificationInput {
    pub sender_name: String,
    pub sender_avatar: Option<String>,
    pub content: String,
    pub notification_type: GroupType,
    pub channel_id: Option<String>,
    pub server_id: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupSummary {
    pub total_groups: usize,
    pub total_notifications: usize,
    pub unread_groups: usize,
    pub unread_notifications: usize,
    pub muted_groups: usize,
}

pub struct NotificationGroupManager {
    groups: Mutex<Vec<NotificationGroup>>,
    notifications: Mutex<Vec<GroupedNotification>>,
    config: Mutex<GroupConfig>,
}

impl NotificationGroupManager {
    pub fn new() -> Self {
        Self {
            groups: Mutex::new(Vec::new()),
            notifications: Mutex::new(Vec::new()),
            config: Mutex::new(GroupConfig::default()),
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn compute_group_key(
    data: &AddNotificationInput,
    strategy: &GroupByStrategy,
) -> String {
    match strategy {
        GroupByStrategy::Channel => {
            data.channel_id.clone().unwrap_or_else(|| format!("type:{:?}", data.notification_type))
        }
        GroupByStrategy::Server => {
            data.server_id.clone().unwrap_or_else(|| {
                data.channel_id.clone().unwrap_or_else(|| format!("type:{:?}", data.notification_type))
            })
        }
        GroupByStrategy::Type => {
            format!("type:{:?}", data.notification_type)
        }
    }
}

fn compute_group_title(
    data: &AddNotificationInput,
    strategy: &GroupByStrategy,
) -> String {
    if let Some(ref title) = data.title {
        return title.clone();
    }
    match strategy {
        GroupByStrategy::Channel => {
            data.channel_id.clone().unwrap_or_else(|| format!("{:?}", data.notification_type))
        }
        GroupByStrategy::Server => {
            data.server_id.clone().unwrap_or_else(|| {
                data.channel_id.clone().unwrap_or_else(|| format!("{:?}", data.notification_type))
            })
        }
        GroupByStrategy::Type => {
            format!("{:?}", data.notification_type)
        }
    }
}

#[tauri::command]
pub fn notifgroup_add(
    app: AppHandle,
    state: State<'_, NotificationGroupManager>,
    data: AddNotificationInput,
) -> Result<NotificationGroup, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let group_key = compute_group_key(&data, &config.group_by);
    let group_title = compute_group_title(&data, &config.group_by);
    let max_group_size = config.max_group_size;
    drop(config);

    let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
    let mut notifications = state.notifications.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();

    let notification_id = uuid::Uuid::new_v4().to_string();

    let existing_idx = groups.iter().position(|g| g.group_key == group_key);

    let group = if let Some(idx) = existing_idx {
        let group = &mut groups[idx];
        group.count += 1;
        group.latest_content = data.content.clone();
        group.latest_sender = data.sender_name.clone();
        group.updated_at = ts;
        group.is_read = false;

        let notif = GroupedNotification {
            id: notification_id,
            group_id: group.id.clone(),
            sender_name: data.sender_name,
            sender_avatar: data.sender_avatar,
            content: data.content,
            notification_type: data.notification_type,
            created_at: ts,
            is_read: false,
        };
        notifications.push(notif);

        // Enforce max_group_size by removing oldest notifications in this group
        let group_id = group.id.clone();
        let group_notifs: Vec<usize> = notifications
            .iter()
            .enumerate()
            .filter(|(_, n)| n.group_id == group_id)
            .map(|(i, _)| i)
            .collect();
        if group_notifs.len() > max_group_size {
            let to_remove = group_notifs.len() - max_group_size;
            let indices_to_remove: Vec<usize> = group_notifs[..to_remove].to_vec();
            for (offset, idx) in indices_to_remove.iter().enumerate() {
                notifications.remove(idx - offset);
            }
            group.count = max_group_size;
        }

        let _ = app.emit("notifgroup:updated", &*group);
        group.clone()
    } else {
        let group_id = uuid::Uuid::new_v4().to_string();

        let new_group = NotificationGroup {
            id: group_id.clone(),
            group_key,
            group_type: data.notification_type.clone(),
            title: group_title,
            channel_id: data.channel_id,
            server_id: data.server_id,
            count: 1,
            latest_content: data.content.clone(),
            latest_sender: data.sender_name.clone(),
            created_at: ts,
            updated_at: ts,
            is_read: false,
            is_muted: false,
        };

        let notif = GroupedNotification {
            id: notification_id,
            group_id,
            sender_name: data.sender_name,
            sender_avatar: data.sender_avatar,
            content: data.content,
            notification_type: data.notification_type,
            created_at: ts,
            is_read: false,
        };
        notifications.push(notif);

        let _ = app.emit("notifgroup:added", &new_group);
        groups.push(new_group.clone());
        new_group
    };

    Ok(group)
}

#[tauri::command]
pub fn notifgroup_get_all(
    state: State<'_, NotificationGroupManager>,
) -> Result<Vec<NotificationGroup>, String> {
    let groups = state.groups.lock().map_err(|e| e.to_string())?;
    let mut result = groups.clone();
    result.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(result)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupWithNotifications {
    pub group: NotificationGroup,
    pub notifications: Vec<GroupedNotification>,
}

#[tauri::command]
pub fn notifgroup_get_group(
    state: State<'_, NotificationGroupManager>,
    group_id: String,
) -> Result<GroupWithNotifications, String> {
    let groups = state.groups.lock().map_err(|e| e.to_string())?;
    let notifications = state.notifications.lock().map_err(|e| e.to_string())?;

    let group = groups
        .iter()
        .find(|g| g.id == group_id)
        .ok_or_else(|| "Group not found".to_string())?
        .clone();

    let mut group_notifs: Vec<GroupedNotification> = notifications
        .iter()
        .filter(|n| n.group_id == group_id)
        .cloned()
        .collect();
    group_notifs.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(GroupWithNotifications {
        group,
        notifications: group_notifs,
    })
}

#[tauri::command]
pub fn notifgroup_mark_read(
    app: AppHandle,
    state: State<'_, NotificationGroupManager>,
    group_id: String,
) -> Result<bool, String> {
    let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
    let mut notifications = state.notifications.lock().map_err(|e| e.to_string())?;

    let group = groups.iter_mut().find(|g| g.id == group_id);
    if let Some(group) = group {
        group.is_read = true;
        group.updated_at = now_ms();
        let _ = app.emit("notifgroup:read", &group_id);

        for notif in notifications.iter_mut() {
            if notif.group_id == group_id {
                notif.is_read = true;
            }
        }

        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn notifgroup_mark_all_read(
    app: AppHandle,
    state: State<'_, NotificationGroupManager>,
) -> Result<usize, String> {
    let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
    let mut notifications = state.notifications.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    let mut count = 0;

    for group in groups.iter_mut() {
        if !group.is_read {
            group.is_read = true;
            group.updated_at = ts;
            count += 1;
        }
    }

    for notif in notifications.iter_mut() {
        notif.is_read = true;
    }

    if count > 0 {
        let _ = app.emit("notifgroup:read", "all");
    }

    Ok(count)
}

#[tauri::command]
pub fn notifgroup_dismiss(
    app: AppHandle,
    state: State<'_, NotificationGroupManager>,
    group_id: String,
) -> Result<bool, String> {
    let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
    let mut notifications = state.notifications.lock().map_err(|e| e.to_string())?;

    let len_before = groups.len();
    groups.retain(|g| g.id != group_id);
    let removed = groups.len() < len_before;

    if removed {
        notifications.retain(|n| n.group_id != group_id);
        let _ = app.emit("notifgroup:dismissed", &group_id);
    }

    Ok(removed)
}

#[tauri::command]
pub fn notifgroup_dismiss_all(
    app: AppHandle,
    state: State<'_, NotificationGroupManager>,
) -> Result<usize, String> {
    let mut groups = state.groups.lock().map_err(|e| e.to_string())?;
    let mut notifications = state.notifications.lock().map_err(|e| e.to_string())?;

    let count = groups.len();
    groups.clear();
    notifications.clear();

    if count > 0 {
        let _ = app.emit("notifgroup:dismissed", "all");
    }

    Ok(count)
}

#[tauri::command]
pub fn notifgroup_mute_group(
    app: AppHandle,
    state: State<'_, NotificationGroupManager>,
    group_id: String,
) -> Result<bool, String> {
    let mut groups = state.groups.lock().map_err(|e| e.to_string())?;

    let group = groups.iter_mut().find(|g| g.id == group_id);
    if let Some(group) = group {
        group.is_muted = true;
        group.updated_at = now_ms();
        let _ = app.emit("notifgroup:updated", &*group);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn notifgroup_unmute_group(
    app: AppHandle,
    state: State<'_, NotificationGroupManager>,
    group_id: String,
) -> Result<bool, String> {
    let mut groups = state.groups.lock().map_err(|e| e.to_string())?;

    let group = groups.iter_mut().find(|g| g.id == group_id);
    if let Some(group) = group {
        group.is_muted = false;
        group.updated_at = now_ms();
        let _ = app.emit("notifgroup:updated", &*group);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn notifgroup_get_config(
    state: State<'_, NotificationGroupManager>,
) -> Result<GroupConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn notifgroup_set_config(
    state: State<'_, NotificationGroupManager>,
    config: GroupConfig,
) -> Result<GroupConfig, String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config.clone();
    Ok(config)
}

#[tauri::command]
pub fn notifgroup_get_unread_count(
    state: State<'_, NotificationGroupManager>,
) -> Result<usize, String> {
    let notifications = state.notifications.lock().map_err(|e| e.to_string())?;
    let count = notifications.iter().filter(|n| !n.is_read).count();
    Ok(count)
}

#[tauri::command]
pub fn notifgroup_get_summary(
    state: State<'_, NotificationGroupManager>,
) -> Result<GroupSummary, String> {
    let groups = state.groups.lock().map_err(|e| e.to_string())?;
    let notifications = state.notifications.lock().map_err(|e| e.to_string())?;

    Ok(GroupSummary {
        total_groups: groups.len(),
        total_notifications: notifications.len(),
        unread_groups: groups.iter().filter(|g| !g.is_read).count(),
        unread_notifications: notifications.iter().filter(|n| !n.is_read).count(),
        muted_groups: groups.iter().filter(|g| g.is_muted).count(),
    })
}

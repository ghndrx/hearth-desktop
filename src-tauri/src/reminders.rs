// Message Reminders
// Lets users set reminders on messages that fire native notifications at a scheduled time

use chrono::{DateTime, Local, Utc};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub id: String,
    pub message_id: String,
    pub channel_id: String,
    pub server_id: Option<String>,
    pub message_preview: String,
    pub author_name: String,
    pub note: Option<String>,
    pub remind_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub fired: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderState {
    pub reminders: Vec<Reminder>,
    pub total_created: u64,
    pub total_fired: u64,
}

pub struct ReminderManager {
    state: RwLock<ReminderState>,
}

impl Default for ReminderManager {
    fn default() -> Self {
        Self {
            state: RwLock::new(ReminderState {
                reminders: Vec::new(),
                total_created: 0,
                total_fired: 0,
            }),
        }
    }
}

#[tauri::command]
pub fn reminder_create(
    state: State<'_, Arc<ReminderManager>>,
    message_id: String,
    channel_id: String,
    server_id: Option<String>,
    message_preview: String,
    author_name: String,
    note: Option<String>,
    remind_at: DateTime<Utc>,
) -> Result<Reminder, String> {
    let now = Utc::now();
    if remind_at <= now {
        return Err("Reminder time must be in the future".to_string());
    }

    let reminder = Reminder {
        id: Uuid::new_v4().to_string(),
        message_id,
        channel_id,
        server_id,
        message_preview,
        author_name,
        note,
        remind_at,
        created_at: now,
        fired: false,
    };

    let mut s = state.state.write().map_err(|e| e.to_string())?;
    s.reminders.push(reminder.clone());
    s.total_created += 1;
    // Keep sorted by remind_at ascending
    s.reminders.sort_by(|a, b| a.remind_at.cmp(&b.remind_at));

    Ok(reminder)
}

#[tauri::command]
pub fn reminder_cancel(
    state: State<'_, Arc<ReminderManager>>,
    id: String,
) -> Result<bool, String> {
    let mut s = state.state.write().map_err(|e| e.to_string())?;
    let before = s.reminders.len();
    s.reminders.retain(|r| r.id != id);
    Ok(s.reminders.len() < before)
}

#[tauri::command]
pub fn reminder_get_all(
    state: State<'_, Arc<ReminderManager>>,
) -> Result<Vec<Reminder>, String> {
    let s = state.state.read().map_err(|e| e.to_string())?;
    Ok(s.reminders.iter().filter(|r| !r.fired).cloned().collect())
}

#[tauri::command]
pub fn reminder_get_pending_count(
    state: State<'_, Arc<ReminderManager>>,
) -> Result<usize, String> {
    let s = state.state.read().map_err(|e| e.to_string())?;
    Ok(s.reminders.iter().filter(|r| !r.fired).count())
}

#[tauri::command]
pub fn reminder_get_stats(
    state: State<'_, Arc<ReminderManager>>,
) -> Result<(u64, u64, usize), String> {
    let s = state.state.read().map_err(|e| e.to_string())?;
    let pending = s.reminders.iter().filter(|r| !r.fired).count();
    Ok((s.total_created, s.total_fired, pending))
}

#[tauri::command]
pub fn reminder_clear_fired(
    state: State<'_, Arc<ReminderManager>>,
) -> Result<usize, String> {
    let mut s = state.state.write().map_err(|e| e.to_string())?;
    let before = s.reminders.len();
    s.reminders.retain(|r| !r.fired);
    Ok(before - s.reminders.len())
}

#[tauri::command]
pub fn reminder_update_note(
    state: State<'_, Arc<ReminderManager>>,
    id: String,
    note: Option<String>,
) -> Result<bool, String> {
    let mut s = state.state.write().map_err(|e| e.to_string())?;
    if let Some(r) = s.reminders.iter_mut().find(|r| r.id == id) {
        r.note = note;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn reminder_reschedule(
    state: State<'_, Arc<ReminderManager>>,
    id: String,
    remind_at: DateTime<Utc>,
) -> Result<bool, String> {
    if remind_at <= Utc::now() {
        return Err("Reminder time must be in the future".to_string());
    }
    let mut s = state.state.write().map_err(|e| e.to_string())?;
    if let Some(r) = s.reminders.iter_mut().find(|r| r.id == id) {
        r.remind_at = remind_at;
        r.fired = false;
        // Re-sort
        s.reminders.sort_by(|a, b| a.remind_at.cmp(&b.remind_at));
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Start background thread that checks for due reminders and fires notifications
pub fn start_reminder_monitor(app_handle: AppHandle, manager: Arc<ReminderManager>) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(10));

            let due_reminders: Vec<Reminder> = {
                let s = match manager.state.read() {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                let now = Utc::now();
                s.reminders
                    .iter()
                    .filter(|r| !r.fired && r.remind_at <= now)
                    .cloned()
                    .collect()
            };

            if due_reminders.is_empty() {
                continue;
            }

            // Mark as fired
            {
                let mut s = match manager.state.write() {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                for due in &due_reminders {
                    if let Some(r) = s.reminders.iter_mut().find(|r| r.id == due.id) {
                        r.fired = true;
                        s.total_fired += 1;
                    }
                }
            }

            // Send notifications
            for reminder in &due_reminders {
                let title = format!("Reminder: {}", reminder.author_name);
                let mut body = reminder.message_preview.clone();
                if body.len() > 120 {
                    body.truncate(117);
                    body.push_str("...");
                }
                if let Some(ref note) = reminder.note {
                    body = format!("{}\n\nNote: {}", body, note);
                }

                let _ = app_handle
                    .notification()
                    .builder()
                    .title(&title)
                    .body(&body)
                    .show();

                // Emit event so frontend can navigate to the message
                let _ = app_handle.emit("reminder:fired", serde_json::json!({
                    "id": reminder.id,
                    "messageId": reminder.message_id,
                    "channelId": reminder.channel_id,
                    "serverId": reminder.server_id,
                    "messagePreview": reminder.message_preview,
                    "authorName": reminder.author_name,
                }));
            }
        }
    });
}

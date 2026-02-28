// Message scheduling for deferred message delivery
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration, Instant};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledMessage {
    pub id: String,
    pub channel_id: String,
    pub content: String,
    pub scheduled_at: i64,      // Unix timestamp (ms)
    pub created_at: i64,
    pub status: MessageStatus,
    #[serde(default)]
    pub attachments: Vec<String>,
    #[serde(default)]
    pub reply_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageStatus {
    Pending,
    Sent,
    Failed,
    Cancelled,
}

impl Default for MessageStatus {
    fn default() -> Self {
        MessageStatus::Pending
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleMessageRequest {
    pub channel_id: String,
    pub content: String,
    pub scheduled_at: i64,
    #[serde(default)]
    pub attachments: Vec<String>,
    #[serde(default)]
    pub reply_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateScheduledRequest {
    pub id: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub scheduled_at: Option<i64>,
}

pub struct SchedulerState {
    messages: Arc<RwLock<HashMap<String, ScheduledMessage>>>,
    app_handle: Option<AppHandle>,
}

impl Default for SchedulerState {
    fn default() -> Self {
        Self::new()
    }
}

impl SchedulerState {
    pub fn new() -> Self {
        Self {
            messages: Arc::new(RwLock::new(HashMap::new())),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, handle: AppHandle) {
        self.app_handle = Some(handle);
    }

    pub async fn schedule(&self, req: ScheduleMessageRequest) -> Result<ScheduledMessage, String> {
        let now = chrono::Utc::now().timestamp_millis();
        
        if req.scheduled_at <= now {
            return Err("Scheduled time must be in the future".to_string());
        }

        if req.content.trim().is_empty() && req.attachments.is_empty() {
            return Err("Message content or attachments required".to_string());
        }

        let message = ScheduledMessage {
            id: Uuid::new_v4().to_string(),
            channel_id: req.channel_id,
            content: req.content,
            scheduled_at: req.scheduled_at,
            created_at: now,
            status: MessageStatus::Pending,
            attachments: req.attachments,
            reply_to: req.reply_to,
        };

        let mut messages = self.messages.write().await;
        messages.insert(message.id.clone(), message.clone());

        // Emit event for UI update
        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("scheduler:added", &message);
        }

        Ok(message)
    }

    pub async fn cancel(&self, id: &str) -> Result<ScheduledMessage, String> {
        let mut messages = self.messages.write().await;
        
        if let Some(msg) = messages.get_mut(id) {
            if msg.status != MessageStatus::Pending {
                return Err("Cannot cancel non-pending message".to_string());
            }
            msg.status = MessageStatus::Cancelled;
            let updated = msg.clone();

            if let Some(ref handle) = self.app_handle {
                let _ = handle.emit("scheduler:cancelled", &updated);
            }

            Ok(updated)
        } else {
            Err("Scheduled message not found".to_string())
        }
    }

    pub async fn update(&self, req: UpdateScheduledRequest) -> Result<ScheduledMessage, String> {
        let mut messages = self.messages.write().await;
        
        if let Some(msg) = messages.get_mut(&req.id) {
            if msg.status != MessageStatus::Pending {
                return Err("Cannot update non-pending message".to_string());
            }

            if let Some(content) = req.content {
                msg.content = content;
            }
            if let Some(scheduled_at) = req.scheduled_at {
                let now = chrono::Utc::now().timestamp_millis();
                if scheduled_at <= now {
                    return Err("Scheduled time must be in the future".to_string());
                }
                msg.scheduled_at = scheduled_at;
            }

            let updated = msg.clone();

            if let Some(ref handle) = self.app_handle {
                let _ = handle.emit("scheduler:updated", &updated);
            }

            Ok(updated)
        } else {
            Err("Scheduled message not found".to_string())
        }
    }

    pub async fn get_pending(&self) -> Vec<ScheduledMessage> {
        let messages = self.messages.read().await;
        messages
            .values()
            .filter(|m| m.status == MessageStatus::Pending)
            .cloned()
            .collect()
    }

    pub async fn get_all(&self) -> Vec<ScheduledMessage> {
        let messages = self.messages.read().await;
        let mut all: Vec<_> = messages.values().cloned().collect();
        all.sort_by(|a, b| a.scheduled_at.cmp(&b.scheduled_at));
        all
    }

    pub async fn get_by_channel(&self, channel_id: &str) -> Vec<ScheduledMessage> {
        let messages = self.messages.read().await;
        messages
            .values()
            .filter(|m| m.channel_id == channel_id && m.status == MessageStatus::Pending)
            .cloned()
            .collect()
    }

    pub async fn cleanup_old(&self, max_age_days: i64) {
        let cutoff = chrono::Utc::now().timestamp_millis() - (max_age_days * 24 * 60 * 60 * 1000);
        let mut messages = self.messages.write().await;
        messages.retain(|_, m| {
            m.status == MessageStatus::Pending || m.created_at > cutoff
        });
    }

    pub async fn mark_sent(&self, id: &str) -> Result<(), String> {
        let mut messages = self.messages.write().await;
        if let Some(msg) = messages.get_mut(id) {
            msg.status = MessageStatus::Sent;
            if let Some(ref handle) = self.app_handle {
                let _ = handle.emit("scheduler:sent", msg.clone());
            }
            Ok(())
        } else {
            Err("Message not found".to_string())
        }
    }

    pub async fn mark_failed(&self, id: &str, _reason: &str) -> Result<(), String> {
        let mut messages = self.messages.write().await;
        if let Some(msg) = messages.get_mut(id) {
            msg.status = MessageStatus::Failed;
            if let Some(ref handle) = self.app_handle {
                let _ = handle.emit("scheduler:failed", msg.clone());
            }
            Ok(())
        } else {
            Err("Message not found".to_string())
        }
    }
}

// Background task that checks for due messages
pub async fn scheduler_loop(state: Arc<RwLock<SchedulerState>>, app: AppHandle) {
    loop {
        sleep(Duration::from_secs(10)).await;
        
        let now = chrono::Utc::now().timestamp_millis();
        let state_guard = state.read().await;
        let pending = state_guard.get_pending().await;
        drop(state_guard);

        for msg in pending {
            if msg.scheduled_at <= now {
                // Emit event for the frontend to actually send the message
                let _ = app.emit("scheduler:due", &msg);
            }
        }
    }
}

// Tauri commands
#[tauri::command]
pub async fn schedule_message(
    state: tauri::State<'_, Arc<RwLock<SchedulerState>>>,
    request: ScheduleMessageRequest,
) -> Result<ScheduledMessage, String> {
    let state = state.read().await;
    state.schedule(request).await
}

#[tauri::command]
pub async fn cancel_scheduled_message(
    state: tauri::State<'_, Arc<RwLock<SchedulerState>>>,
    id: String,
) -> Result<ScheduledMessage, String> {
    let state = state.read().await;
    state.cancel(&id).await
}

#[tauri::command]
pub async fn update_scheduled_message(
    state: tauri::State<'_, Arc<RwLock<SchedulerState>>>,
    request: UpdateScheduledRequest,
) -> Result<ScheduledMessage, String> {
    let state = state.read().await;
    state.update(request).await
}

#[tauri::command]
pub async fn get_scheduled_messages(
    state: tauri::State<'_, Arc<RwLock<SchedulerState>>>,
) -> Result<Vec<ScheduledMessage>, String> {
    let state = state.read().await;
    Ok(state.get_all().await)
}

#[tauri::command]
pub async fn get_channel_scheduled_messages(
    state: tauri::State<'_, Arc<RwLock<SchedulerState>>>,
    channel_id: String,
) -> Result<Vec<ScheduledMessage>, String> {
    let state = state.read().await;
    Ok(state.get_by_channel(&channel_id).await)
}

#[tauri::command]
pub async fn mark_scheduled_sent(
    state: tauri::State<'_, Arc<RwLock<SchedulerState>>>,
    id: String,
) -> Result<(), String> {
    let state = state.read().await;
    state.mark_sent(&id).await
}

#[tauri::command]
pub async fn mark_scheduled_failed(
    state: tauri::State<'_, Arc<RwLock<SchedulerState>>>,
    id: String,
    reason: String,
) -> Result<(), String> {
    let state = state.read().await;
    state.mark_failed(&id, &reason).await
}

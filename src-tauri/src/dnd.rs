// Do Not Disturb scheduling for Hearth Desktop
// Provides native DND integration with scheduling support

use serde::{Deserialize, Serialize};
use std::sync::{atomic::{AtomicBool, Ordering}, RwLock};
use tauri::{AppHandle, Emitter, Manager};
use chrono::{Datelike, Local, NaiveTime, Timelike, Weekday};

// ============================================================================
// DND State
// ============================================================================

static DND_ACTIVE: AtomicBool = AtomicBool::new(false);
static DND_SCHEDULE_ENABLED: AtomicBool = AtomicBool::new(false);

lazy_static::lazy_static! {
    static ref DND_SCHEDULE: RwLock<DndSchedule> = RwLock::new(DndSchedule::default());
}

/// Schedule configuration for automatic DND
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DndSchedule {
    /// Whether scheduling is enabled
    pub enabled: bool,
    /// Start time (24h format, e.g., "22:00")
    pub start_time: String,
    /// End time (24h format, e.g., "07:00")  
    pub end_time: String,
    /// Days of the week to apply schedule (0=Sunday, 6=Saturday)
    pub days: Vec<u8>,
    /// Allow exceptions for mentions
    pub allow_mentions: bool,
    /// Allow exceptions for DMs
    pub allow_dms: bool,
    /// Custom message to show during DND
    pub custom_message: Option<String>,
}

impl Default for DndSchedule {
    fn default() -> Self {
        Self {
            enabled: false,
            start_time: "22:00".to_string(),
            end_time: "07:00".to_string(),
            days: vec![0, 1, 2, 3, 4, 5, 6], // All days
            allow_mentions: false,
            allow_dms: false,
            custom_message: None,
        }
    }
}

/// Current DND status info
#[derive(Debug, Clone, Serialize)]
pub struct DndStatus {
    pub active: bool,
    pub schedule_enabled: bool,
    pub manual_override: bool,
    pub until: Option<String>,
    pub reason: String,
}

// ============================================================================
// DND Commands
// ============================================================================

/// Get current DND status
#[tauri::command]
pub fn get_dnd_status() -> DndStatus {
    let active = DND_ACTIVE.load(Ordering::Relaxed);
    let schedule_enabled = DND_SCHEDULE_ENABLED.load(Ordering::Relaxed);
    
    let schedule = DND_SCHEDULE.read().unwrap();
    let in_scheduled_window = is_in_scheduled_window(&schedule);
    
    let reason = if !active {
        "off".to_string()
    } else if schedule_enabled && in_scheduled_window {
        "scheduled".to_string()
    } else {
        "manual".to_string()
    };
    
    DndStatus {
        active,
        schedule_enabled,
        manual_override: active && !(schedule_enabled && in_scheduled_window),
        until: if active && schedule_enabled && in_scheduled_window {
            Some(schedule.end_time.clone())
        } else {
            None
        },
        reason,
    }
}

/// Toggle DND on/off (manual override)
#[tauri::command]
pub fn toggle_dnd(app: AppHandle) -> Result<bool, String> {
    let current = DND_ACTIVE.load(Ordering::Relaxed);
    let new_state = !current;
    DND_ACTIVE.store(new_state, Ordering::Relaxed);
    
    // Emit event to frontend
    let _ = app.emit("dnd-state-changed", serde_json::json!({
        "active": new_state,
        "manual": true
    }));
    
    // Sync with system DND if available
    #[cfg(target_os = "macos")]
    sync_system_dnd(new_state);
    
    Ok(new_state)
}

/// Set DND state explicitly
#[tauri::command]
pub fn set_dnd(app: AppHandle, active: bool) -> Result<bool, String> {
    DND_ACTIVE.store(active, Ordering::Relaxed);
    
    let _ = app.emit("dnd-state-changed", serde_json::json!({
        "active": active,
        "manual": true
    }));
    
    #[cfg(target_os = "macos")]
    sync_system_dnd(active);
    
    Ok(active)
}

/// Enable DND until a specific time (e.g., "09:00" or duration like "2h")
#[tauri::command]
pub fn set_dnd_until(app: AppHandle, until: String) -> Result<DndStatus, String> {
    DND_ACTIVE.store(true, Ordering::Relaxed);
    
    // TODO: Store the "until" time and set up a timer to disable DND
    // For now, just enable it
    
    let _ = app.emit("dnd-state-changed", serde_json::json!({
        "active": true,
        "until": until
    }));
    
    Ok(get_dnd_status())
}

/// Check if DND is currently active
#[tauri::command]
pub fn is_dnd_active() -> bool {
    DND_ACTIVE.load(Ordering::Relaxed)
}

// ============================================================================
// Schedule Commands
// ============================================================================

/// Get the current DND schedule
#[tauri::command]
pub fn get_dnd_schedule() -> DndSchedule {
    DND_SCHEDULE.read().unwrap().clone()
}

/// Set the DND schedule
#[tauri::command]
pub fn set_dnd_schedule(app: AppHandle, schedule: DndSchedule) -> Result<(), String> {
    // Validate times
    NaiveTime::parse_from_str(&schedule.start_time, "%H:%M")
        .map_err(|_| "Invalid start time format (use HH:MM)".to_string())?;
    NaiveTime::parse_from_str(&schedule.end_time, "%H:%M")
        .map_err(|_| "Invalid end time format (use HH:MM)".to_string())?;
    
    // Validate days
    for day in &schedule.days {
        if *day > 6 {
            return Err("Invalid day (must be 0-6)".to_string());
        }
    }
    
    let enabled = schedule.enabled;
    
    {
        let mut current = DND_SCHEDULE.write().unwrap();
        *current = schedule.clone();
    }
    
    DND_SCHEDULE_ENABLED.store(enabled, Ordering::Relaxed);
    
    // Check if we should enable/disable DND based on new schedule
    if enabled {
        update_dnd_from_schedule(&app);
    }
    
    // Emit event
    let _ = app.emit("dnd-schedule-changed", schedule);
    
    Ok(())
}

/// Enable or disable scheduled DND
#[tauri::command]
pub fn set_dnd_schedule_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    DND_SCHEDULE_ENABLED.store(enabled, Ordering::Relaxed);
    
    {
        let mut schedule = DND_SCHEDULE.write().unwrap();
        schedule.enabled = enabled;
    }
    
    if enabled {
        update_dnd_from_schedule(&app);
    }
    
    let _ = app.emit("dnd-schedule-enabled-changed", enabled);
    
    Ok(())
}

// ============================================================================
// Notification Filtering
// ============================================================================

/// Check if a notification should be allowed through DND
#[tauri::command]
pub fn should_allow_notification(is_mention: bool, is_dm: bool) -> bool {
    if !DND_ACTIVE.load(Ordering::Relaxed) {
        return true;
    }
    
    let schedule = DND_SCHEDULE.read().unwrap();
    
    if is_mention && schedule.allow_mentions {
        return true;
    }
    
    if is_dm && schedule.allow_dms {
        return true;
    }
    
    false
}

/// Filter notification based on DND settings
#[derive(Debug, Serialize)]
pub struct NotificationDecision {
    pub allowed: bool,
    pub reason: String,
    pub queued: bool,
}

#[tauri::command]
pub fn check_notification_allowed(
    is_mention: bool,
    is_dm: bool,
    is_urgent: bool,
) -> NotificationDecision {
    if !DND_ACTIVE.load(Ordering::Relaxed) {
        return NotificationDecision {
            allowed: true,
            reason: "DND not active".to_string(),
            queued: false,
        };
    }
    
    // Urgent notifications always go through
    if is_urgent {
        return NotificationDecision {
            allowed: true,
            reason: "Urgent notification".to_string(),
            queued: false,
        };
    }
    
    let schedule = DND_SCHEDULE.read().unwrap();
    
    if is_mention && schedule.allow_mentions {
        return NotificationDecision {
            allowed: true,
            reason: "Mentions allowed during DND".to_string(),
            queued: false,
        };
    }
    
    if is_dm && schedule.allow_dms {
        return NotificationDecision {
            allowed: true,
            reason: "DMs allowed during DND".to_string(),
            queued: false,
        };
    }
    
    NotificationDecision {
        allowed: false,
        reason: "Blocked by Do Not Disturb".to_string(),
        queued: true, // Will be shown when DND ends
    }
}

// ============================================================================
// Schedule Helpers
// ============================================================================

fn is_in_scheduled_window(schedule: &DndSchedule) -> bool {
    if !schedule.enabled {
        return false;
    }
    
    let now = Local::now();
    let current_day = now.weekday().num_days_from_sunday() as u8;
    
    // Check if today is in the scheduled days
    if !schedule.days.contains(&current_day) {
        return false;
    }
    
    let current_time = now.time();
    
    let start = match NaiveTime::parse_from_str(&schedule.start_time, "%H:%M") {
        Ok(t) => t,
        Err(_) => return false,
    };
    
    let end = match NaiveTime::parse_from_str(&schedule.end_time, "%H:%M") {
        Ok(t) => t,
        Err(_) => return false,
    };
    
    // Handle overnight schedules (e.g., 22:00 to 07:00)
    if start > end {
        // DND is active from start until midnight, or from midnight until end
        current_time >= start || current_time < end
    } else {
        // Normal schedule (e.g., 13:00 to 14:00)
        current_time >= start && current_time < end
    }
}

fn update_dnd_from_schedule(app: &AppHandle) {
    let schedule = DND_SCHEDULE.read().unwrap();
    let should_be_active = is_in_scheduled_window(&schedule);
    let currently_active = DND_ACTIVE.load(Ordering::Relaxed);
    
    if should_be_active != currently_active {
        DND_ACTIVE.store(should_be_active, Ordering::Relaxed);
        
        let _ = app.emit("dnd-state-changed", serde_json::json!({
            "active": should_be_active,
            "manual": false,
            "scheduled": true
        }));
        
        #[cfg(target_os = "macos")]
        sync_system_dnd(should_be_active);
    }
}

/// Start a background task to check schedule periodically
pub fn start_schedule_checker(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            
            if DND_SCHEDULE_ENABLED.load(Ordering::Relaxed) {
                update_dnd_from_schedule(&app);
            }
        }
    });
}

// ============================================================================
// Platform-specific DND Sync
// ============================================================================

#[cfg(target_os = "macos")]
fn sync_system_dnd(active: bool) {
    // Note: macOS Focus mode integration requires additional entitlements
    // and is complex to implement. This is a placeholder for future enhancement.
    // For now, Hearth manages its own DND state.
    let _ = active;
}

#[cfg(not(target_os = "macos"))]
fn sync_system_dnd(_active: bool) {
    // No system DND integration on other platforms
}

// ============================================================================
// Quick DND Presets
// ============================================================================

/// Quick preset durations for DND
#[derive(Debug, Clone, Serialize)]
pub struct DndPreset {
    pub id: String,
    pub label: String,
    pub duration_minutes: Option<u32>,
    pub until_time: Option<String>,
}

#[tauri::command]
pub fn get_dnd_presets() -> Vec<DndPreset> {
    vec![
        DndPreset {
            id: "30min".to_string(),
            label: "30 minutes".to_string(),
            duration_minutes: Some(30),
            until_time: None,
        },
        DndPreset {
            id: "1hour".to_string(),
            label: "1 hour".to_string(),
            duration_minutes: Some(60),
            until_time: None,
        },
        DndPreset {
            id: "2hours".to_string(),
            label: "2 hours".to_string(),
            duration_minutes: Some(120),
            until_time: None,
        },
        DndPreset {
            id: "tonight".to_string(),
            label: "Until tomorrow morning".to_string(),
            duration_minutes: None,
            until_time: Some("08:00".to_string()),
        },
        DndPreset {
            id: "weekend".to_string(),
            label: "Until Monday".to_string(),
            duration_minutes: None,
            until_time: None, // Special handling needed
        },
    ]
}

/// Apply a quick DND preset
#[tauri::command]
pub fn apply_dnd_preset(app: AppHandle, preset_id: String) -> Result<DndStatus, String> {
    let presets = get_dnd_presets();
    let preset = presets.iter()
        .find(|p| p.id == preset_id)
        .ok_or_else(|| format!("Unknown preset: {}", preset_id))?;
    
    DND_ACTIVE.store(true, Ordering::Relaxed);
    
    let _ = app.emit("dnd-state-changed", serde_json::json!({
        "active": true,
        "preset": preset_id,
        "duration_minutes": preset.duration_minutes,
        "until_time": preset.until_time
    }));
    
    #[cfg(target_os = "macos")]
    sync_system_dnd(true);
    
    Ok(get_dnd_status())
}

//! Notification Snooze Module
//! 
//! Provides time-based notification snoozing functionality.
//! Allows users to temporarily suppress notifications for a specified duration.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;
use chrono::{DateTime, Duration, Local, NaiveTime, Timelike};
use serde::{Deserialize, Serialize};

/// Snooze end timestamp (Unix seconds, 0 = not snoozed)
static SNOOZE_UNTIL: AtomicU64 = AtomicU64::new(0);

/// Human-readable snooze label for display
static SNOOZE_LABEL: RwLock<String> = RwLock::new(String::new());

/// Snooze duration presets
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SnoozeDuration {
    /// 15 minutes
    FifteenMinutes,
    /// 30 minutes
    ThirtyMinutes,
    /// 1 hour
    OneHour,
    /// 2 hours
    TwoHours,
    /// 4 hours  
    FourHours,
    /// Until tomorrow morning (8 AM)
    UntilTomorrow,
    /// Custom duration in minutes
    Custom(u32),
}

impl SnoozeDuration {
    /// Get the snooze end time for this duration
    pub fn end_time(&self) -> DateTime<Local> {
        let now = Local::now();
        match self {
            SnoozeDuration::FifteenMinutes => now + Duration::minutes(15),
            SnoozeDuration::ThirtyMinutes => now + Duration::minutes(30),
            SnoozeDuration::OneHour => now + Duration::hours(1),
            SnoozeDuration::TwoHours => now + Duration::hours(2),
            SnoozeDuration::FourHours => now + Duration::hours(4),
            SnoozeDuration::UntilTomorrow => {
                // Calculate time until 8 AM tomorrow
                let tomorrow = now.date_naive() + chrono::Days::new(1);
                let eight_am = NaiveTime::from_hms_opt(8, 0, 0).unwrap();
                tomorrow.and_time(eight_am).and_local_timezone(Local).unwrap()
            }
            SnoozeDuration::Custom(minutes) => now + Duration::minutes(*minutes as i64),
        }
    }

    /// Get a human-readable label for this duration
    pub fn label(&self) -> String {
        match self {
            SnoozeDuration::FifteenMinutes => "15 minutes".to_string(),
            SnoozeDuration::ThirtyMinutes => "30 minutes".to_string(),
            SnoozeDuration::OneHour => "1 hour".to_string(),
            SnoozeDuration::TwoHours => "2 hours".to_string(),
            SnoozeDuration::FourHours => "4 hours".to_string(),
            SnoozeDuration::UntilTomorrow => "until tomorrow".to_string(),
            SnoozeDuration::Custom(minutes) => format!("{} minutes", minutes),
        }
    }

    /// Get the menu item ID for this duration
    pub fn menu_id(&self) -> &'static str {
        match self {
            SnoozeDuration::FifteenMinutes => "snooze_15m",
            SnoozeDuration::ThirtyMinutes => "snooze_30m",
            SnoozeDuration::OneHour => "snooze_1h",
            SnoozeDuration::TwoHours => "snooze_2h",
            SnoozeDuration::FourHours => "snooze_4h",
            SnoozeDuration::UntilTomorrow => "snooze_tomorrow",
            SnoozeDuration::Custom(_) => "snooze_custom",
        }
    }

    /// Parse a menu item ID back to a duration
    pub fn from_menu_id(id: &str) -> Option<Self> {
        match id {
            "snooze_15m" => Some(SnoozeDuration::FifteenMinutes),
            "snooze_30m" => Some(SnoozeDuration::ThirtyMinutes),
            "snooze_1h" => Some(SnoozeDuration::OneHour),
            "snooze_2h" => Some(SnoozeDuration::TwoHours),
            "snooze_4h" => Some(SnoozeDuration::FourHours),
            "snooze_tomorrow" => Some(SnoozeDuration::UntilTomorrow),
            _ => None,
        }
    }
}

/// Snooze status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnoozeStatus {
    pub active: bool,
    pub until_timestamp: Option<u64>,
    pub until_formatted: Option<String>,
    pub label: Option<String>,
    pub remaining_minutes: Option<i64>,
}

/// Start snoozing notifications for the specified duration
pub fn start_snooze<R: Runtime>(
    app: &AppHandle<R>,
    duration: SnoozeDuration,
) -> Result<SnoozeStatus, String> {
    let end_time = duration.end_time();
    let timestamp = end_time.timestamp() as u64;
    
    SNOOZE_UNTIL.store(timestamp, Ordering::Relaxed);
    
    // Store the label
    if let Ok(mut label) = SNOOZE_LABEL.write() {
        *label = duration.label();
    }
    
    // Emit event to frontend
    if let Some(window) = app.get_webview_window("main") {
        let status = get_snooze_status();
        let _ = window.emit("snooze-started", &status);
    }
    
    // Show notification
    let _ = app.notification()
        .builder()
        .title("Notifications Snoozed")
        .body(&format!("Snoozed for {}", duration.label()))
        .show();
    
    // Schedule wake-up task
    let app_handle = app.clone();
    let remaining_ms = (end_time - Local::now()).num_milliseconds().max(0) as u64;
    
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(remaining_ms)).await;
        
        // Check if still snoozed (user might have cancelled)
        if is_snoozed() {
            end_snooze_internal(&app_handle);
        }
    });
    
    Ok(get_snooze_status())
}

/// End the current snooze
pub fn end_snooze<R: Runtime>(app: &AppHandle<R>) -> Result<SnoozeStatus, String> {
    end_snooze_internal(app);
    Ok(get_snooze_status())
}

/// Internal snooze end (also called by timer)
fn end_snooze_internal<R: Runtime>(app: &AppHandle<R>) {
    let was_snoozed = SNOOZE_UNTIL.swap(0, Ordering::Relaxed) > 0;
    
    if let Ok(mut label) = SNOOZE_LABEL.write() {
        label.clear();
    }
    
    if was_snoozed {
        // Emit event to frontend
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("snooze-ended", get_snooze_status());
        }
        
        // Show notification
        let _ = app.notification()
            .builder()
            .title("Snooze Ended")
            .body("Notifications are active again")
            .show();
    }
}

/// Check if notifications are currently snoozed
pub fn is_snoozed() -> bool {
    let until = SNOOZE_UNTIL.load(Ordering::Relaxed);
    if until == 0 {
        return false;
    }
    
    let now = Local::now().timestamp() as u64;
    until > now
}

/// Get current snooze status
pub fn get_snooze_status() -> SnoozeStatus {
    let until = SNOOZE_UNTIL.load(Ordering::Relaxed);
    let now = Local::now();
    let now_ts = now.timestamp() as u64;
    
    if until == 0 || until <= now_ts {
        return SnoozeStatus {
            active: false,
            until_timestamp: None,
            until_formatted: None,
            label: None,
            remaining_minutes: None,
        };
    }
    
    let until_time = DateTime::from_timestamp(until as i64, 0)
        .map(|dt| dt.with_timezone(&Local));
    
    let formatted = until_time.map(|dt| {
        // Format based on whether it's today or tomorrow
        if dt.date_naive() == now.date_naive() {
            dt.format("%H:%M").to_string()
        } else {
            dt.format("tomorrow %H:%M").to_string()
        }
    });
    
    let remaining = ((until - now_ts) as i64 / 60).max(0);
    
    let label = SNOOZE_LABEL.read().ok().and_then(|l| {
        if l.is_empty() { None } else { Some(l.clone()) }
    });
    
    SnoozeStatus {
        active: true,
        until_timestamp: Some(until),
        until_formatted: formatted,
        label,
        remaining_minutes: Some(remaining),
    }
}

/// Get the remaining snooze time as a formatted string
pub fn get_snooze_remaining_text() -> Option<String> {
    let status = get_snooze_status();
    if !status.active {
        return None;
    }
    
    status.remaining_minutes.map(|mins| {
        if mins >= 60 {
            let hours = mins / 60;
            let remaining_mins = mins % 60;
            if remaining_mins > 0 {
                format!("{}h {}m remaining", hours, remaining_mins)
            } else {
                format!("{}h remaining", hours)
            }
        } else if mins > 0 {
            format!("{}m remaining", mins)
        } else {
            "< 1m remaining".to_string()
        }
    })
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Start notification snooze
#[tauri::command]
pub fn snooze_notifications(
    app: AppHandle,
    duration: SnoozeDuration,
) -> Result<SnoozeStatus, String> {
    start_snooze(&app, duration)
}

/// Start notification snooze with custom minutes
#[tauri::command]
pub fn snooze_notifications_custom(
    app: AppHandle,
    minutes: u32,
) -> Result<SnoozeStatus, String> {
    start_snooze(&app, SnoozeDuration::Custom(minutes))
}

/// End notification snooze
#[tauri::command]
pub fn unsnooze_notifications(app: AppHandle) -> Result<SnoozeStatus, String> {
    end_snooze(&app)
}

/// Get snooze status
#[tauri::command]
pub fn get_notification_snooze_status() -> SnoozeStatus {
    get_snooze_status()
}

/// Check if notifications are snoozed
#[tauri::command]
pub fn are_notifications_snoozed() -> bool {
    is_snoozed()
}

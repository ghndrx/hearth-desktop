//! System Uptime Tracker - System and app session duration monitoring
//!
//! Provides:
//! - System uptime detection
//! - App session duration tracking
//! - Session history with milestones

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UptimeInfo {
    pub system_uptime_secs: u64,
    pub system_uptime_formatted: String,
    pub app_uptime_secs: u64,
    pub app_uptime_formatted: String,
    pub app_started_at: String,
    pub system_boot_time: String,
    pub milestones_reached: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_secs: u64,
}

pub struct UptimeManager {
    app_start_time: chrono::DateTime<Utc>,
    sessions: Mutex<Vec<SessionRecord>>,
    acknowledged_milestones: Mutex<Vec<String>>,
}

impl Default for UptimeManager {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            app_start_time: now,
            sessions: Mutex::new(vec![SessionRecord {
                id: uuid::Uuid::new_v4().to_string(),
                started_at: now.to_rfc3339(),
                ended_at: None,
                duration_secs: 0,
            }]),
            acknowledged_milestones: Mutex::new(Vec::new()),
        }
    }
}

const MILESTONES: &[(u64, &str)] = &[
    (60, "1 minute"),
    (300, "5 minutes"),
    (600, "10 minutes"),
    (1800, "30 minutes"),
    (3600, "1 hour"),
    (7200, "2 hours"),
    (14400, "4 hours"),
    (28800, "8 hours"),
    (43200, "12 hours"),
    (86400, "24 hours"),
];

#[tauri::command]
pub fn uptime_get_info(
    state: State<'_, UptimeManager>,
) -> Result<UptimeInfo, String> {
    use sysinfo::System;

    let system_uptime = System::uptime();
    let app_uptime = (Utc::now() - state.app_start_time).num_seconds().max(0) as u64;

    // Calculate boot time
    let boot_time = Utc::now() - chrono::Duration::seconds(system_uptime as i64);

    // Check milestones
    let acknowledged = state.acknowledged_milestones.lock().map_err(|e| e.to_string())?;
    let milestones: Vec<String> = MILESTONES
        .iter()
        .filter(|(secs, _)| app_uptime >= *secs && !acknowledged.contains(&secs.to_string()))
        .map(|(_, name)| name.to_string())
        .collect();

    Ok(UptimeInfo {
        system_uptime_secs: system_uptime,
        system_uptime_formatted: format_duration(system_uptime),
        app_uptime_secs: app_uptime,
        app_uptime_formatted: format_duration(app_uptime),
        app_started_at: state.app_start_time.to_rfc3339(),
        system_boot_time: boot_time.to_rfc3339(),
        milestones_reached: milestones,
    })
}

#[tauri::command]
pub fn uptime_acknowledge_milestone(
    state: State<'_, UptimeManager>,
    milestone_secs: String,
) -> Result<(), String> {
    let mut acknowledged = state.acknowledged_milestones.lock().map_err(|e| e.to_string())?;
    if !acknowledged.contains(&milestone_secs) {
        acknowledged.push(milestone_secs);
    }
    Ok(())
}

#[tauri::command]
pub fn uptime_get_sessions(
    state: State<'_, UptimeManager>,
) -> Result<Vec<SessionRecord>, String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    // Update current session duration
    if let Some(current) = sessions.last_mut() {
        if current.ended_at.is_none() {
            current.duration_secs =
                (Utc::now() - state.app_start_time).num_seconds().max(0) as u64;
        }
    }

    Ok(sessions.clone())
}

#[tauri::command]
pub fn uptime_get_total_app_time(
    state: State<'_, UptimeManager>,
) -> Result<u64, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let app_uptime = (Utc::now() - state.app_start_time).num_seconds().max(0) as u64;

    let past_total: u64 = sessions
        .iter()
        .filter(|s| s.ended_at.is_some())
        .map(|s| s.duration_secs)
        .sum();

    Ok(past_total + app_uptime)
}

fn format_duration(secs: u64) -> String {
    let days = secs / 86400;
    let hours = (secs % 86400) / 3600;
    let minutes = (secs % 3600) / 60;
    let seconds = secs % 60;

    if days > 0 {
        format!("{}d {}h {}m {}s", days, hours, minutes, seconds)
    } else if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, seconds)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, seconds)
    } else {
        format!("{}s", seconds)
    }
}

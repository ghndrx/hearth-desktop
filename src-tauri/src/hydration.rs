//! Hydration Reminder - tracks water intake and sends periodic drink reminders
//!
//! Helps users stay hydrated by sending configurable reminders and
//! tracking daily water intake with a glass counter.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydrationConfig {
    pub reminder_interval_ms: u64,
    pub daily_goal_glasses: u32,
    pub glass_size_ml: u32,
    pub enabled: bool,
    pub notification_enabled: bool,
}

impl Default for HydrationConfig {
    fn default() -> Self {
        Self {
            reminder_interval_ms: 30 * 60 * 1000, // 30 minutes
            daily_goal_glasses: 8,
            glass_size_ml: 250,
            enabled: true,
            notification_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydrationState {
    pub active: bool,
    pub started_at: u64,
    pub next_reminder_at: u64,
    pub glasses_today: u32,
    pub total_ml_today: u32,
    pub last_drink_at: u64,
    pub reminders_sent: u32,
    pub day_started_at: u64,
}

impl Default for HydrationState {
    fn default() -> Self {
        Self {
            active: false,
            started_at: 0,
            next_reminder_at: 0,
            glasses_today: 0,
            total_ml_today: 0,
            last_drink_at: 0,
            reminders_sent: 0,
            day_started_at: 0,
        }
    }
}

pub struct HydrationManager {
    config: Mutex<HydrationConfig>,
    state: Mutex<HydrationState>,
}

impl Default for HydrationManager {
    fn default() -> Self {
        Self {
            config: Mutex::new(HydrationConfig::default()),
            state: Mutex::new(HydrationState::default()),
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Check if the day has changed and reset counters if so
fn maybe_reset_day(state: &mut HydrationState) {
    let now = now_ms();
    let ms_per_day: u64 = 24 * 60 * 60 * 1000;
    if state.day_started_at == 0 || (now - state.day_started_at) >= ms_per_day {
        state.glasses_today = 0;
        state.total_ml_today = 0;
        state.reminders_sent = 0;
        state.day_started_at = now;
    }
}

#[tauri::command]
pub fn hydration_start(
    app: AppHandle,
    manager: State<'_, HydrationManager>,
) -> Result<HydrationState, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let now = now_ms();

    maybe_reset_day(&mut state);
    state.active = true;
    state.started_at = now;
    state.next_reminder_at = now + config.reminder_interval_ms;

    let _ = app.emit("hydration-started", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn hydration_stop(
    app: AppHandle,
    manager: State<'_, HydrationManager>,
) -> Result<HydrationState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    state.active = false;
    state.next_reminder_at = 0;

    let _ = app.emit("hydration-stopped", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn hydration_log_drink(
    app: AppHandle,
    manager: State<'_, HydrationManager>,
) -> Result<HydrationState, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let now = now_ms();

    maybe_reset_day(&mut state);
    state.glasses_today += 1;
    state.total_ml_today += config.glass_size_ml;
    state.last_drink_at = now;

    // Reset reminder timer on drink
    if state.active {
        state.next_reminder_at = now + config.reminder_interval_ms;
    }

    let _ = app.emit("hydration-drink-logged", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn hydration_dismiss_reminder(
    app: AppHandle,
    manager: State<'_, HydrationManager>,
) -> Result<HydrationState, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let now = now_ms();

    state.reminders_sent += 1;
    if state.active {
        state.next_reminder_at = now + config.reminder_interval_ms;
    }

    let _ = app.emit("hydration-reminder-dismissed", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn hydration_get_state(
    manager: State<'_, HydrationManager>,
) -> Result<HydrationState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    maybe_reset_day(&mut state);
    Ok(state.clone())
}

#[tauri::command]
pub fn hydration_get_config(
    manager: State<'_, HydrationManager>,
) -> Result<HydrationConfig, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn hydration_set_config(
    app: AppHandle,
    manager: State<'_, HydrationManager>,
    new_config: HydrationConfig,
) -> Result<HydrationConfig, String> {
    let mut config = manager.config.lock().map_err(|e| e.to_string())?;
    *config = new_config.clone();

    // Recalculate next reminder if active
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    if state.active {
        state.next_reminder_at = now_ms() + new_config.reminder_interval_ms;
    }

    let _ = app.emit("hydration-config-changed", new_config.clone());
    Ok(new_config)
}

#[tauri::command]
pub fn hydration_reset_today(
    app: AppHandle,
    manager: State<'_, HydrationManager>,
) -> Result<HydrationState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.glasses_today = 0;
    state.total_ml_today = 0;
    state.reminders_sent = 0;
    state.day_started_at = now_ms();

    let _ = app.emit("hydration-reset", state.clone());
    Ok(state.clone())
}

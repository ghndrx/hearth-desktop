//! Eye Break Reminder - 20-20-20 rule wellness timer
//!
//! Reminds users to take regular eye breaks following the 20-20-20 rule:
//! every 20 minutes, look at something 20 feet away for 20 seconds.
//! Tracks break statistics and supports customizable intervals.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EyeBreakConfig {
    pub work_interval_ms: u64,
    pub break_duration_ms: u64,
    pub enabled: bool,
    pub sound_enabled: bool,
    pub notification_enabled: bool,
}

impl Default for EyeBreakConfig {
    fn default() -> Self {
        Self {
            work_interval_ms: 20 * 60 * 1000,  // 20 minutes
            break_duration_ms: 20 * 1000,       // 20 seconds
            enabled: true,
            sound_enabled: true,
            notification_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EyeBreakState {
    pub active: bool,
    pub on_break: bool,
    pub started_at: u64,
    pub next_break_at: u64,
    pub break_started_at: u64,
    pub breaks_taken: u32,
    pub breaks_skipped: u32,
    pub total_session_ms: u64,
}

impl Default for EyeBreakState {
    fn default() -> Self {
        Self {
            active: false,
            on_break: false,
            started_at: 0,
            next_break_at: 0,
            break_started_at: 0,
            breaks_taken: 0,
            breaks_skipped: 0,
            total_session_ms: 0,
        }
    }
}

pub struct EyeBreakManager {
    config: Mutex<EyeBreakConfig>,
    state: Mutex<EyeBreakState>,
}

impl Default for EyeBreakManager {
    fn default() -> Self {
        Self {
            config: Mutex::new(EyeBreakConfig::default()),
            state: Mutex::new(EyeBreakState::default()),
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub fn eyebreak_start(
    app: AppHandle,
    manager: State<'_, EyeBreakManager>,
) -> Result<EyeBreakState, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let now = now_ms();

    state.active = true;
    state.on_break = false;
    state.started_at = now;
    state.next_break_at = now + config.work_interval_ms;
    state.break_started_at = 0;

    let _ = app.emit("eyebreak-started", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn eyebreak_stop(
    app: AppHandle,
    manager: State<'_, EyeBreakManager>,
) -> Result<EyeBreakState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let now = now_ms();

    if state.active && state.started_at > 0 {
        state.total_session_ms += now - state.started_at;
    }
    state.active = false;
    state.on_break = false;
    state.next_break_at = 0;
    state.break_started_at = 0;

    let _ = app.emit("eyebreak-stopped", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn eyebreak_begin_break(
    app: AppHandle,
    manager: State<'_, EyeBreakManager>,
) -> Result<EyeBreakState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    if !state.active {
        return Err("Eye break timer not active".into());
    }

    state.on_break = true;
    state.break_started_at = now_ms();
    state.breaks_taken += 1;

    let _ = app.emit("eyebreak-break-started", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn eyebreak_end_break(
    app: AppHandle,
    manager: State<'_, EyeBreakManager>,
) -> Result<EyeBreakState, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    state.on_break = false;
    state.break_started_at = 0;
    state.next_break_at = now_ms() + config.work_interval_ms;

    let _ = app.emit("eyebreak-break-ended", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn eyebreak_skip_break(
    app: AppHandle,
    manager: State<'_, EyeBreakManager>,
) -> Result<EyeBreakState, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    if !state.active {
        return Err("Eye break timer not active".into());
    }

    state.on_break = false;
    state.break_started_at = 0;
    state.breaks_skipped += 1;
    state.next_break_at = now_ms() + config.work_interval_ms;

    let _ = app.emit("eyebreak-skipped", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn eyebreak_get_state(
    manager: State<'_, EyeBreakManager>,
) -> Result<EyeBreakState, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

#[tauri::command]
pub fn eyebreak_get_config(
    manager: State<'_, EyeBreakManager>,
) -> Result<EyeBreakConfig, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn eyebreak_set_config(
    app: AppHandle,
    manager: State<'_, EyeBreakManager>,
    new_config: EyeBreakConfig,
) -> Result<EyeBreakConfig, String> {
    let mut config = manager.config.lock().map_err(|e| e.to_string())?;
    *config = new_config.clone();

    // Recalculate next break if active
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    if state.active && !state.on_break {
        state.next_break_at = now_ms() + new_config.work_interval_ms;
    }

    let _ = app.emit("eyebreak-config-changed", new_config.clone());
    Ok(new_config)
}

#[tauri::command]
pub fn eyebreak_reset_stats(
    manager: State<'_, EyeBreakManager>,
) -> Result<EyeBreakState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.breaks_taken = 0;
    state.breaks_skipped = 0;
    state.total_session_ms = 0;
    Ok(state.clone())
}

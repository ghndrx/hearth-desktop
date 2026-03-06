//! Meeting Cost Timer - tracks meeting duration and calculates real-time cost
//!
//! Shows the running cost of a meeting based on number of attendees and
//! average hourly rate. Helps teams stay mindful of meeting time investment.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingCostConfig {
    pub default_hourly_rate: f64,
    pub currency_symbol: String,
    pub currency_code: String,
}

impl Default for MeetingCostConfig {
    fn default() -> Self {
        Self {
            default_hourly_rate: 75.0,
            currency_symbol: "$".into(),
            currency_code: "USD".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingCostState {
    pub running: bool,
    pub paused: bool,
    pub started_at: u64,
    pub paused_at: u64,
    pub total_paused_ms: u64,
    pub attendees: u32,
    pub hourly_rate: f64,
    pub elapsed_ms: u64,
    pub total_cost: f64,
    pub meetings_today: u32,
    pub total_cost_today: f64,
    pub total_time_today_ms: u64,
}

impl Default for MeetingCostState {
    fn default() -> Self {
        Self {
            running: false,
            paused: false,
            started_at: 0,
            paused_at: 0,
            total_paused_ms: 0,
            attendees: 2,
            hourly_rate: 75.0,
            elapsed_ms: 0,
            total_cost: 0.0,
            meetings_today: 0,
            total_cost_today: 0.0,
            total_time_today_ms: 0,
        }
    }
}

pub struct MeetingCostManager {
    config: Mutex<MeetingCostConfig>,
    state: Mutex<MeetingCostState>,
}

impl Default for MeetingCostManager {
    fn default() -> Self {
        Self {
            config: Mutex::new(MeetingCostConfig::default()),
            state: Mutex::new(MeetingCostState::default()),
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn calculate_cost(elapsed_ms: u64, attendees: u32, hourly_rate: f64) -> f64 {
    let hours = elapsed_ms as f64 / 3_600_000.0;
    hours * attendees as f64 * hourly_rate
}

#[tauri::command]
pub fn meeting_start(
    app: AppHandle,
    manager: State<'_, MeetingCostManager>,
    attendees: u32,
    hourly_rate: Option<f64>,
) -> Result<MeetingCostState, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    let rate = hourly_rate.unwrap_or(config.default_hourly_rate);
    let now = now_ms();

    state.running = true;
    state.paused = false;
    state.started_at = now;
    state.paused_at = 0;
    state.total_paused_ms = 0;
    state.attendees = attendees.max(1);
    state.hourly_rate = rate;
    state.elapsed_ms = 0;
    state.total_cost = 0.0;

    let _ = app.emit("meeting-started", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn meeting_stop(
    app: AppHandle,
    manager: State<'_, MeetingCostManager>,
) -> Result<MeetingCostState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    if !state.running {
        return Err("No meeting in progress".into());
    }

    let now = now_ms();
    let elapsed = now - state.started_at - state.total_paused_ms;
    let cost = calculate_cost(elapsed, state.attendees, state.hourly_rate);

    state.running = false;
    state.paused = false;
    state.elapsed_ms = elapsed;
    state.total_cost = cost;
    state.meetings_today += 1;
    state.total_cost_today += cost;
    state.total_time_today_ms += elapsed;

    let _ = app.emit("meeting-stopped", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn meeting_pause(
    app: AppHandle,
    manager: State<'_, MeetingCostManager>,
) -> Result<MeetingCostState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    if !state.running || state.paused {
        return Err("Meeting not running or already paused".into());
    }

    state.paused = true;
    state.paused_at = now_ms();

    let _ = app.emit("meeting-paused", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn meeting_resume(
    app: AppHandle,
    manager: State<'_, MeetingCostManager>,
) -> Result<MeetingCostState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    if !state.running || !state.paused {
        return Err("Meeting not paused".into());
    }

    let now = now_ms();
    state.total_paused_ms += now - state.paused_at;
    state.paused = false;
    state.paused_at = 0;

    let _ = app.emit("meeting-resumed", state.clone());
    Ok(state.clone())
}

#[tauri::command]
pub fn meeting_update_attendees(
    manager: State<'_, MeetingCostManager>,
    attendees: u32,
) -> Result<MeetingCostState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.attendees = attendees.max(1);
    Ok(state.clone())
}

#[tauri::command]
pub fn meeting_get_state(
    manager: State<'_, MeetingCostManager>,
) -> Result<MeetingCostState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;

    if state.running && !state.paused {
        let now = now_ms();
        let elapsed = now - state.started_at - state.total_paused_ms;
        state.elapsed_ms = elapsed;
        state.total_cost = calculate_cost(elapsed, state.attendees, state.hourly_rate);
    }

    Ok(state.clone())
}

#[tauri::command]
pub fn meeting_get_config(
    manager: State<'_, MeetingCostManager>,
) -> Result<MeetingCostConfig, String> {
    let config = manager.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn meeting_set_config(
    app: AppHandle,
    manager: State<'_, MeetingCostManager>,
    new_config: MeetingCostConfig,
) -> Result<MeetingCostConfig, String> {
    let mut config = manager.config.lock().map_err(|e| e.to_string())?;
    *config = new_config.clone();
    let _ = app.emit("meeting-config-changed", new_config.clone());
    Ok(new_config)
}

#[tauri::command]
pub fn meeting_reset_daily(
    manager: State<'_, MeetingCostManager>,
) -> Result<MeetingCostState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.meetings_today = 0;
    state.total_cost_today = 0.0;
    state.total_time_today_ms = 0;
    Ok(state.clone())
}

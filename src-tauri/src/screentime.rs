use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use chrono::{Local, NaiveDate, Datelike, Duration as ChronoDuration};

/// A single usage session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub start: i64,       // unix timestamp ms
    pub end: Option<i64>, // None if still active
    pub active_minutes: u32,
    pub idle_minutes: u32,
}

/// Daily usage summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyUsage {
    pub date: String, // YYYY-MM-DD
    pub total_minutes: u32,
    pub active_minutes: u32,
    pub idle_minutes: u32,
    pub sessions: Vec<Session>,
    pub hourly_minutes: [u32; 24],
    pub peak_hour: u8,
}

impl DailyUsage {
    fn new(date: &str) -> Self {
        Self {
            date: date.to_string(),
            total_minutes: 0,
            active_minutes: 0,
            idle_minutes: 0,
            sessions: Vec::new(),
            hourly_minutes: [0; 24],
            peak_hour: 0,
        }
    }

    fn recalculate_peak(&mut self) {
        self.peak_hour = self
            .hourly_minutes
            .iter()
            .enumerate()
            .max_by_key(|(_, &v)| v)
            .map(|(i, _)| i as u8)
            .unwrap_or(0);
    }
}

/// Weekly statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyStats {
    pub average_daily: u32,
    pub total_week: u32,
    pub trend: String, // "up", "down", "stable"
    pub most_active_day: String,
    pub most_active_hour: u8,
    pub days: Vec<DailyUsage>,
}

/// Current tracking state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenTimeState {
    pub is_tracking: bool,
    pub is_idle: bool,
    pub current_session_start: Option<i64>,
    pub today: DailyUsage,
    pub session_count_today: u32,
}

/// Internal tracker state
struct TrackerState {
    is_tracking: bool,
    is_idle: bool,
    current_session_start: Option<i64>,
    last_active_time: i64,
    idle_threshold_ms: i64,
    today: DailyUsage,
    history: Vec<DailyUsage>, // last 30 days
}

impl TrackerState {
    fn new() -> Self {
        let today = Local::now().format("%Y-%m-%d").to_string();
        Self {
            is_tracking: false,
            is_idle: false,
            current_session_start: None,
            last_active_time: Local::now().timestamp_millis(),
            idle_threshold_ms: 5 * 60 * 1000, // 5 minutes
            today: DailyUsage::new(&today),
            history: Vec::new(),
        }
    }

    fn ensure_today(&mut self) {
        let today = Local::now().format("%Y-%m-%d").to_string();
        if self.today.date != today {
            // Archive yesterday
            if self.today.total_minutes > 0 || !self.today.sessions.is_empty() {
                self.history.push(self.today.clone());
            }
            self.today = DailyUsage::new(&today);
            // Trim history to 30 days
            if self.history.len() > 30 {
                self.history.drain(..self.history.len() - 30);
            }
        }
    }
}

static STATE: Lazy<Mutex<TrackerState>> = Lazy::new(|| Mutex::new(TrackerState::new()));

// -- File persistence helpers --

fn data_path() -> Result<std::path::PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or("No data directory")?
        .join("hearth-desktop");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("screentime.json"))
}

#[derive(Serialize, Deserialize)]
struct PersistData {
    today: DailyUsage,
    history: Vec<DailyUsage>,
}

fn load_persisted() -> Option<PersistData> {
    let path = data_path().ok()?;
    let data = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&data).ok()
}

fn save_persisted(state: &TrackerState) {
    if let Ok(path) = data_path() {
        let data = PersistData {
            today: state.today.clone(),
            history: state.history.clone(),
        };
        if let Ok(json) = serde_json::to_string(&data) {
            let _ = std::fs::write(path, json);
        }
    }
}

// -- Tauri commands --

/// Start tracking screen time. Called on app launch.
#[tauri::command]
pub fn screentime_start() -> Result<ScreenTimeState, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;

    // Load persisted data on first start
    if !state.is_tracking && state.today.sessions.is_empty() {
        if let Some(persisted) = load_persisted() {
            state.history = persisted.history;
            let today_str = Local::now().format("%Y-%m-%d").to_string();
            if persisted.today.date == today_str {
                state.today = persisted.today;
            }
        }
    }

    state.ensure_today();

    let now = Local::now().timestamp_millis();
    state.is_tracking = true;
    state.is_idle = false;
    state.current_session_start = Some(now);
    state.last_active_time = now;

    Ok(get_state_snapshot(&state))
}

/// Stop tracking (app minimize / close).
#[tauri::command]
pub fn screentime_stop() -> Result<ScreenTimeState, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    finalize_session(&mut state);
    state.is_tracking = false;
    save_persisted(&state);
    Ok(get_state_snapshot(&state))
}

/// Record a heartbeat from the frontend (call every 60s).
/// Updates active/idle time for the current session.
#[tauri::command]
pub fn screentime_heartbeat() -> Result<ScreenTimeState, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    if !state.is_tracking {
        return Ok(get_state_snapshot(&state));
    }

    state.ensure_today();

    let now = Local::now().timestamp_millis();
    let was_idle = state.is_idle;
    let idle_duration = now - state.last_active_time;

    if idle_duration > state.idle_threshold_ms {
        state.is_idle = true;
        state.today.idle_minutes += 1;
    } else {
        state.is_idle = false;
        state.today.active_minutes += 1;
        let hour = Local::now().hour() as usize;
        state.today.hourly_minutes[hour] += 1;
        state.today.recalculate_peak();
    }

    state.today.total_minutes = state.today.active_minutes + state.today.idle_minutes;

    Ok(get_state_snapshot(&state))
}

/// Report user activity (mouse/keyboard). Resets idle timer.
#[tauri::command]
pub fn screentime_activity() -> Result<(), String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    state.last_active_time = Local::now().timestamp_millis();
    if state.is_idle {
        state.is_idle = false;
    }
    Ok(())
}

/// Get current tracking state.
#[tauri::command]
pub fn screentime_get_state() -> Result<ScreenTimeState, String> {
    let state = STATE.lock().map_err(|e| e.to_string())?;
    Ok(get_state_snapshot(&state))
}

/// Get today's usage data.
#[tauri::command]
pub fn screentime_get_today() -> Result<DailyUsage, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    state.ensure_today();
    Ok(state.today.clone())
}

/// Get weekly stats (last 7 days including today).
#[tauri::command]
pub fn screentime_get_weekly() -> Result<WeeklyStats, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    state.ensure_today();

    let today_str = Local::now().format("%Y-%m-%d").to_string();
    let seven_days_ago = (Local::now() - ChronoDuration::days(7))
        .format("%Y-%m-%d")
        .to_string();

    let mut days: Vec<DailyUsage> = state
        .history
        .iter()
        .filter(|d| d.date >= seven_days_ago && d.date < today_str)
        .cloned()
        .collect();
    days.push(state.today.clone());

    let total_week: u32 = days.iter().map(|d| d.active_minutes).sum();
    let num_days = days.len().max(1) as u32;
    let average_daily = total_week / num_days;

    // Find most active day
    let most_active_day = days
        .iter()
        .max_by_key(|d| d.active_minutes)
        .map(|d| d.date.clone())
        .unwrap_or_default();

    // Aggregate hourly data
    let mut hourly_totals = [0u32; 24];
    for day in &days {
        for (i, &mins) in day.hourly_minutes.iter().enumerate() {
            hourly_totals[i] += mins;
        }
    }
    let most_active_hour = hourly_totals
        .iter()
        .enumerate()
        .max_by_key(|(_, &v)| v)
        .map(|(i, _)| i as u8)
        .unwrap_or(12);

    // Trend: compare first half vs second half
    let mid = days.len() / 2;
    let first_half: u32 = days[..mid].iter().map(|d| d.active_minutes).sum();
    let second_half: u32 = days[mid..].iter().map(|d| d.active_minutes).sum();
    let trend = if second_half > (first_half as f64 * 1.1) as u32 {
        "up"
    } else if (second_half as f64) < first_half as f64 * 0.9 {
        "down"
    } else {
        "stable"
    };

    Ok(WeeklyStats {
        average_daily,
        total_week,
        trend: trend.to_string(),
        most_active_day,
        most_active_hour,
        days,
    })
}

/// Get usage history for a date range.
#[tauri::command]
pub fn screentime_get_range(start_date: String, end_date: String) -> Result<Vec<DailyUsage>, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    state.ensure_today();

    let mut result: Vec<DailyUsage> = state
        .history
        .iter()
        .filter(|d| d.date >= start_date && d.date <= end_date)
        .cloned()
        .collect();

    if state.today.date >= start_date && state.today.date <= end_date {
        result.push(state.today.clone());
    }

    Ok(result)
}

/// Set idle detection threshold in minutes.
#[tauri::command]
pub fn screentime_set_idle_threshold(minutes: u32) -> Result<(), String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    state.idle_threshold_ms = (minutes as i64) * 60 * 1000;
    Ok(())
}

/// Reset all screen time data.
#[tauri::command]
pub fn screentime_reset() -> Result<(), String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    state.today = DailyUsage::new(&today);
    state.history.clear();
    state.current_session_start = None;
    save_persisted(&state);
    Ok(())
}

/// Save current data to disk (call periodically or on app close).
#[tauri::command]
pub fn screentime_save() -> Result<(), String> {
    let state = STATE.lock().map_err(|e| e.to_string())?;
    save_persisted(&state);
    Ok(())
}

// -- Internal helpers --

fn finalize_session(state: &mut TrackerState) {
    if let Some(start) = state.current_session_start.take() {
        let now = Local::now().timestamp_millis();
        let duration_min = ((now - start) / 60000) as u32;
        let session = Session {
            start,
            end: Some(now),
            active_minutes: state.today.active_minutes,
            idle_minutes: state.today.idle_minutes,
        };
        state.today.sessions.push(session);
        state.today.total_minutes = state.today.active_minutes + state.today.idle_minutes;
    }
}

fn get_state_snapshot(state: &TrackerState) -> ScreenTimeState {
    ScreenTimeState {
        is_tracking: state.is_tracking,
        is_idle: state.is_idle,
        current_session_start: state.current_session_start,
        today: state.today.clone(),
        session_count_today: state.today.sessions.len() as u32
            + if state.current_session_start.is_some() { 1 } else { 0 },
    }
}

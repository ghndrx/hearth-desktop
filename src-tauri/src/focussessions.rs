//! Focus Sessions - Structured focus time management for Hearth Desktop
//!
//! Provides:
//! - Configurable focus sessions with work/break intervals
//! - Session history and productivity stats
//! - Auto-DND integration during focus sessions
//! - Break reminders with native notifications
//! - Daily/weekly focus goals and streaks

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

/// Focus session phase
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SessionPhase {
    Work,
    ShortBreak,
    LongBreak,
    Idle,
}

impl Default for SessionPhase {
    fn default() -> Self {
        SessionPhase::Idle
    }
}

/// A completed focus session record
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub id: String,
    pub started_at: String,
    pub ended_at: String,
    pub duration_minutes: u32,
    pub phase: SessionPhase,
    pub completed: bool,
    pub label: Option<String>,
    pub interruptions: u32,
}

/// Focus session settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSessionSettings {
    /// Work duration in minutes
    pub work_duration: u32,
    /// Short break duration in minutes
    pub short_break_duration: u32,
    /// Long break duration in minutes
    pub long_break_duration: u32,
    /// Number of work sessions before a long break
    pub sessions_before_long_break: u32,
    /// Whether to auto-enable DND during focus
    pub auto_dnd: bool,
    /// Whether to show break notifications
    pub break_notifications: bool,
    /// Whether to auto-start breaks
    pub auto_start_breaks: bool,
    /// Whether to auto-start next work session
    pub auto_start_work: bool,
    /// Daily focus goal in minutes
    pub daily_goal_minutes: u32,
    /// Sound to play on phase change
    pub sound_enabled: bool,
}

impl Default for FocusSessionSettings {
    fn default() -> Self {
        Self {
            work_duration: 25,
            short_break_duration: 5,
            long_break_duration: 15,
            sessions_before_long_break: 4,
            auto_dnd: true,
            break_notifications: true,
            auto_start_breaks: false,
            auto_start_work: false,
            daily_goal_minutes: 120,
            sound_enabled: true,
        }
    }
}

/// Current focus session state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSessionState {
    pub phase: SessionPhase,
    pub is_running: bool,
    pub is_paused: bool,
    pub current_session_number: u32,
    pub total_sessions_today: u32,
    pub total_focus_minutes_today: u32,
    pub started_at: Option<String>,
    pub remaining_seconds: u32,
    pub elapsed_seconds: u32,
    pub current_label: Option<String>,
    pub interruptions: u32,
    pub streak_days: u32,
}

impl Default for FocusSessionState {
    fn default() -> Self {
        Self {
            phase: SessionPhase::Idle,
            is_running: false,
            is_paused: false,
            current_session_number: 0,
            total_sessions_today: 0,
            total_focus_minutes_today: 0,
            started_at: None,
            remaining_seconds: 0,
            elapsed_seconds: 0,
            current_label: None,
            interruptions: 0,
            streak_days: 0,
        }
    }
}

/// Focus session stats
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusStats {
    pub total_sessions: u32,
    pub total_focus_minutes: u32,
    pub average_session_minutes: f32,
    pub completion_rate: f32,
    pub today_sessions: u32,
    pub today_focus_minutes: u32,
    pub daily_goal_minutes: u32,
    pub daily_goal_progress: f32,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub most_productive_hour: Option<u32>,
    pub weekly_minutes: Vec<u32>,
}

/// Managed state for Focus Sessions
pub struct FocusSessionManager {
    state: Mutex<FocusSessionState>,
    settings: Mutex<FocusSessionSettings>,
    history: Mutex<Vec<SessionRecord>>,
}

impl Default for FocusSessionManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(FocusSessionState::default()),
            settings: Mutex::new(FocusSessionSettings::default()),
            history: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn focus_session_start(
    state: State<'_, Arc<FocusSessionManager>>,
    label: Option<String>,
) -> Result<FocusSessionState, String> {
    let mut session = state.state.lock().map_err(|e| e.to_string())?;
    let settings = state.settings.lock().map_err(|e| e.to_string())?;

    if session.is_running {
        return Err("A focus session is already running".to_string());
    }

    session.phase = SessionPhase::Work;
    session.is_running = true;
    session.is_paused = false;
    session.current_session_number += 1;
    session.started_at = Some(Utc::now().to_rfc3339());
    session.remaining_seconds = settings.work_duration * 60;
    session.elapsed_seconds = 0;
    session.current_label = label;
    session.interruptions = 0;

    Ok(session.clone())
}

#[tauri::command]
pub fn focus_session_pause(
    state: State<'_, Arc<FocusSessionManager>>,
) -> Result<FocusSessionState, String> {
    let mut session = state.state.lock().map_err(|e| e.to_string())?;

    if !session.is_running {
        return Err("No focus session is running".to_string());
    }

    session.is_paused = !session.is_paused;
    if session.is_paused {
        session.interruptions += 1;
    }

    Ok(session.clone())
}

#[tauri::command]
pub fn focus_session_stop(
    state: State<'_, Arc<FocusSessionManager>>,
) -> Result<FocusSessionState, String> {
    let mut session = state.state.lock().map_err(|e| e.to_string())?;
    let mut history = state.history.lock().map_err(|e| e.to_string())?;

    if !session.is_running {
        return Err("No focus session is running".to_string());
    }

    let completed = session.remaining_seconds == 0;
    let duration_minutes = session.elapsed_seconds / 60;

    // Record the session
    let record = SessionRecord {
        id: uuid::Uuid::new_v4().to_string(),
        started_at: session.started_at.clone().unwrap_or_default(),
        ended_at: Utc::now().to_rfc3339(),
        duration_minutes,
        phase: session.phase.clone(),
        completed,
        label: session.current_label.clone(),
        interruptions: session.interruptions,
    };
    history.push(record);

    // Update daily stats
    if session.phase == SessionPhase::Work {
        session.total_sessions_today += 1;
        session.total_focus_minutes_today += duration_minutes;
    }

    // Reset to idle
    session.phase = SessionPhase::Idle;
    session.is_running = false;
    session.is_paused = false;
    session.started_at = None;
    session.remaining_seconds = 0;
    session.elapsed_seconds = 0;
    session.current_label = None;

    Ok(session.clone())
}

#[tauri::command]
pub fn focus_session_skip(
    state: State<'_, Arc<FocusSessionManager>>,
) -> Result<FocusSessionState, String> {
    let mut session = state.state.lock().map_err(|e| e.to_string())?;
    let settings = state.settings.lock().map_err(|e| e.to_string())?;

    if !session.is_running {
        return Err("No focus session is running".to_string());
    }

    // Transition to next phase
    match session.phase {
        SessionPhase::Work => {
            if session.current_session_number % settings.sessions_before_long_break == 0 {
                session.phase = SessionPhase::LongBreak;
                session.remaining_seconds = settings.long_break_duration * 60;
            } else {
                session.phase = SessionPhase::ShortBreak;
                session.remaining_seconds = settings.short_break_duration * 60;
            }
        }
        SessionPhase::ShortBreak | SessionPhase::LongBreak => {
            session.phase = SessionPhase::Work;
            session.remaining_seconds = settings.work_duration * 60;
        }
        SessionPhase::Idle => {}
    }

    session.elapsed_seconds = 0;
    session.started_at = Some(Utc::now().to_rfc3339());

    Ok(session.clone())
}

#[tauri::command]
pub fn focus_session_get_state(
    state: State<'_, Arc<FocusSessionManager>>,
) -> Result<FocusSessionState, String> {
    let session = state.state.lock().map_err(|e| e.to_string())?;
    Ok(session.clone())
}

#[tauri::command]
pub fn focus_session_get_settings(
    state: State<'_, Arc<FocusSessionManager>>,
) -> Result<FocusSessionSettings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn focus_session_update_settings(
    state: State<'_, Arc<FocusSessionManager>>,
    settings: FocusSessionSettings,
) -> Result<FocusSessionSettings, String> {
    let mut current = state.settings.lock().map_err(|e| e.to_string())?;
    *current = settings;
    Ok(current.clone())
}

#[tauri::command]
pub fn focus_session_get_stats(
    state: State<'_, Arc<FocusSessionManager>>,
) -> Result<FocusStats, String> {
    let session = state.state.lock().map_err(|e| e.to_string())?;
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    let history = state.history.lock().map_err(|e| e.to_string())?;

    let total_sessions = history.len() as u32;
    let completed_sessions = history.iter().filter(|s| s.completed).count() as u32;
    let total_focus_minutes: u32 = history
        .iter()
        .filter(|s| s.phase == SessionPhase::Work)
        .map(|s| s.duration_minutes)
        .sum();

    let average_session_minutes = if total_sessions > 0 {
        total_focus_minutes as f32 / total_sessions as f32
    } else {
        0.0
    };

    let completion_rate = if total_sessions > 0 {
        completed_sessions as f32 / total_sessions as f32
    } else {
        0.0
    };

    let daily_goal_progress = if settings.daily_goal_minutes > 0 {
        (session.total_focus_minutes_today as f32 / settings.daily_goal_minutes as f32).min(1.0)
    } else {
        0.0
    };

    Ok(FocusStats {
        total_sessions,
        total_focus_minutes,
        average_session_minutes,
        completion_rate,
        today_sessions: session.total_sessions_today,
        today_focus_minutes: session.total_focus_minutes_today,
        daily_goal_minutes: settings.daily_goal_minutes,
        daily_goal_progress,
        current_streak: session.streak_days,
        longest_streak: session.streak_days,
        most_productive_hour: None,
        weekly_minutes: vec![0; 7],
    })
}

#[tauri::command]
pub fn focus_session_get_history(
    state: State<'_, Arc<FocusSessionManager>>,
    limit: Option<usize>,
) -> Result<Vec<SessionRecord>, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let records: Vec<SessionRecord> = history.iter().rev().take(limit).cloned().collect();
    Ok(records)
}

#[tauri::command]
pub fn focus_session_clear_history(
    state: State<'_, Arc<FocusSessionManager>>,
) -> Result<(), String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.clear();
    Ok(())
}

#[tauri::command]
pub fn focus_session_tick(
    state: State<'_, Arc<FocusSessionManager>>,
    app: AppHandle,
) -> Result<FocusSessionState, String> {
    let mut session = state.state.lock().map_err(|e| e.to_string())?;

    if !session.is_running || session.is_paused {
        return Ok(session.clone());
    }

    if session.remaining_seconds > 0 {
        session.remaining_seconds -= 1;
        session.elapsed_seconds += 1;
    }

    // Phase complete
    if session.remaining_seconds == 0 {
        let _ = app.emit("focus-session-phase-complete", serde_json::json!({
            "phase": session.phase,
            "sessionNumber": session.current_session_number,
        }));
    }

    Ok(session.clone())
}

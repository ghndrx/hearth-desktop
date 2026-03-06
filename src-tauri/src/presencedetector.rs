//! Desktop Presence Detector for the Hearth desktop app
//!
//! Monitors OS idle/lock state and window focus to determine user presence.
//! Tracks activity state (Active, Idle, Away, DoNotDisturb) and syncs it
//! to chat presence. Emits events to the frontend when state changes.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager};

static DETECTOR_RUNNING: AtomicBool = AtomicBool::new(false);
static IDLE_THRESHOLD_SECS: AtomicU64 = AtomicU64::new(300); // 5 minutes -> idle
static AWAY_THRESHOLD_SECS: AtomicU64 = AtomicU64::new(900); // 15 minutes -> away

/// Current presence detector state
static CURRENT_STATE: RwLock<Option<PresenceDetectorState>> = RwLock::new(None);

/// Manual status override (empty string means no override)
static MANUAL_STATUS: RwLock<Option<PresenceStatus>> = RwLock::new(None);

/// Whether the Hearth window is currently focused
static WINDOW_FOCUSED: AtomicBool = AtomicBool::new(true);

/// Whether the user appears to be in a meeting/call
static IN_MEETING: AtomicBool = AtomicBool::new(false);

/// The detected user activity state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityState {
    Active,
    Idle,
    Away,
    DoNotDisturb,
}

/// The presence status for chat
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PresenceStatus {
    Online,
    Idle,
    Dnd,
    Invisible,
}

/// Full presence detector state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceDetectorState {
    /// Current detected activity state
    pub activity_state: ActivityState,
    /// Mapped presence status for chat
    pub presence_status: PresenceStatus,
    /// Seconds since last user input
    pub idle_seconds: u64,
    /// Whether the Hearth window is focused
    pub window_focused: bool,
    /// Whether the user is in a meeting/call
    pub in_meeting: bool,
    /// Whether a manual status override is active
    pub manual_override: bool,
    /// Threshold for idle (seconds)
    pub idle_threshold: u64,
    /// Threshold for away (seconds)
    pub away_threshold: u64,
    /// Whether the detector is running
    pub detector_active: bool,
    /// Whether the screen is locked
    pub screen_locked: bool,
}

/// Presence detector configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceConfig {
    /// Seconds of inactivity before going idle
    pub idle_threshold: u64,
    /// Seconds of inactivity before going away
    pub away_threshold: u64,
}

/// Map activity state to presence status
fn activity_to_presence(activity: ActivityState) -> PresenceStatus {
    match activity {
        ActivityState::Active => PresenceStatus::Online,
        ActivityState::Idle => PresenceStatus::Idle,
        ActivityState::Away => PresenceStatus::Idle,
        ActivityState::DoNotDisturb => PresenceStatus::Dnd,
    }
}

/// Get current presence detector state
#[tauri::command]
pub fn get_presence_state() -> PresenceDetectorState {
    let state = CURRENT_STATE.read().unwrap();
    state.clone().unwrap_or(PresenceDetectorState {
        activity_state: ActivityState::Active,
        presence_status: PresenceStatus::Online,
        idle_seconds: 0,
        window_focused: WINDOW_FOCUSED.load(Ordering::Relaxed),
        in_meeting: IN_MEETING.load(Ordering::Relaxed),
        manual_override: false,
        idle_threshold: IDLE_THRESHOLD_SECS.load(Ordering::Relaxed),
        away_threshold: AWAY_THRESHOLD_SECS.load(Ordering::Relaxed),
        detector_active: DETECTOR_RUNNING.load(Ordering::Relaxed),
        screen_locked: false,
    })
}

/// Update presence detector configuration
#[tauri::command]
pub fn set_presence_config(idle_threshold: u64, away_threshold: u64) -> PresenceConfig {
    // Enforce minimums (1 minute idle, idle+1 minute away)
    let idle = idle_threshold.max(60);
    let away = away_threshold.max(idle + 60);

    IDLE_THRESHOLD_SECS.store(idle, Ordering::Relaxed);
    AWAY_THRESHOLD_SECS.store(away, Ordering::Relaxed);

    PresenceConfig {
        idle_threshold: idle,
        away_threshold: away,
    }
}

/// Set a manual status override
#[tauri::command]
pub fn set_manual_status(app: AppHandle, status: Option<PresenceStatus>) -> PresenceDetectorState {
    {
        let mut manual = MANUAL_STATUS.write().unwrap();
        *manual = status;
    }

    // Rebuild and emit current state
    let current = CURRENT_STATE.read().unwrap();
    let mut state = current.clone().unwrap_or(PresenceDetectorState {
        activity_state: ActivityState::Active,
        presence_status: PresenceStatus::Online,
        idle_seconds: 0,
        window_focused: WINDOW_FOCUSED.load(Ordering::Relaxed),
        in_meeting: IN_MEETING.load(Ordering::Relaxed),
        manual_override: false,
        idle_threshold: IDLE_THRESHOLD_SECS.load(Ordering::Relaxed),
        away_threshold: AWAY_THRESHOLD_SECS.load(Ordering::Relaxed),
        detector_active: DETECTOR_RUNNING.load(Ordering::Relaxed),
        screen_locked: false,
    });
    drop(current);

    if let Some(s) = status {
        state.manual_override = true;
        state.presence_status = s;
    } else {
        state.manual_override = false;
        state.presence_status = activity_to_presence(state.activity_state);
    }

    // Update stored state
    {
        let mut current = CURRENT_STATE.write().unwrap();
        *current = Some(state.clone());
    }

    let _ = app.emit("presence-detector:state-changed", &state);
    state
}

/// Start the background presence detector
#[tauri::command]
pub fn start_presence_detector(app: AppHandle) -> Result<(), String> {
    if DETECTOR_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    tauri::async_runtime::spawn(async move {
        let mut last_activity = ActivityState::Active;

        loop {
            if !DETECTOR_RUNNING.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(5)).await;

            let idle_status = crate::activity::get_idle_status();
            let idle_secs = idle_status.idle_seconds;
            let screen_locked = idle_status.screen_locked;
            let idle_threshold = IDLE_THRESHOLD_SECS.load(Ordering::Relaxed);
            let away_threshold = AWAY_THRESHOLD_SECS.load(Ordering::Relaxed);
            let window_focused = WINDOW_FOCUSED.load(Ordering::Relaxed);
            let in_meeting = IN_MEETING.load(Ordering::Relaxed);

            // Determine activity state
            let activity_state = if in_meeting {
                ActivityState::DoNotDisturb
            } else if screen_locked || idle_secs >= away_threshold {
                ActivityState::Away
            } else if idle_secs >= idle_threshold {
                ActivityState::Idle
            } else {
                ActivityState::Active
            };

            // Determine presence status (manual override takes priority)
            let manual = MANUAL_STATUS.read().unwrap().clone();
            let (presence_status, manual_override) = if let Some(s) = manual {
                (s, true)
            } else {
                (activity_to_presence(activity_state), false)
            };

            let state = PresenceDetectorState {
                activity_state,
                presence_status,
                idle_seconds: idle_secs,
                window_focused,
                in_meeting,
                manual_override,
                idle_threshold,
                away_threshold,
                detector_active: true,
                screen_locked,
            };

            // Update stored state
            {
                let mut current = CURRENT_STATE.write().unwrap();
                *current = Some(state.clone());
            }

            // Emit event on activity state change
            if activity_state != last_activity {
                log::info!(
                    "Presence detector: {:?} -> {:?} (idle {}s, focused: {}, meeting: {})",
                    last_activity,
                    activity_state,
                    idle_secs,
                    window_focused,
                    in_meeting
                );
                let _ = app.emit("presence-detector:state-changed", &state);
                last_activity = activity_state;
            }
        }

        log::info!("Presence detector stopped");
    });

    Ok(())
}

/// Stop the background presence detector
#[tauri::command]
pub fn stop_presence_detector() -> Result<(), String> {
    DETECTOR_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

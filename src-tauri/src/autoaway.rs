//! Auto-away detection for the Hearth desktop app
//!
//! Monitors system idle time and automatically transitions the user's
//! presence status between online → idle → away based on configurable
//! thresholds. Emits events to the frontend so the gateway can update
//! the server-side presence.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager};

static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);
static IDLE_THRESHOLD_SECS: AtomicU64 = AtomicU64::new(300); // 5 minutes → idle
static AWAY_THRESHOLD_SECS: AtomicU64 = AtomicU64::new(900); // 15 minutes → away

/// Current auto-away state
static CURRENT_STATE: RwLock<Option<AutoAwayState>> = RwLock::new(None);

/// The detected presence tier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PresenceTier {
    Active,
    Idle,
    Away,
}

/// Full auto-away state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoAwayState {
    /// Current detected presence tier
    pub tier: PresenceTier,
    /// Seconds since last user input
    pub idle_seconds: u64,
    /// Threshold for idle (seconds)
    pub idle_threshold: u64,
    /// Threshold for away (seconds)
    pub away_threshold: u64,
    /// Whether the monitor is running
    pub monitor_active: bool,
    /// Whether the screen is locked
    pub screen_locked: bool,
}

/// Auto-away configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoAwayConfig {
    /// Seconds of inactivity before going idle
    pub idle_threshold: u64,
    /// Seconds of inactivity before going away
    pub away_threshold: u64,
}

/// Get current auto-away state
#[tauri::command]
pub fn get_auto_away_state() -> AutoAwayState {
    let state = CURRENT_STATE.read().unwrap();
    state.clone().unwrap_or(AutoAwayState {
        tier: PresenceTier::Active,
        idle_seconds: 0,
        idle_threshold: IDLE_THRESHOLD_SECS.load(Ordering::Relaxed),
        away_threshold: AWAY_THRESHOLD_SECS.load(Ordering::Relaxed),
        monitor_active: MONITOR_RUNNING.load(Ordering::Relaxed),
        screen_locked: false,
    })
}

/// Get the auto-away configuration
#[tauri::command]
pub fn get_auto_away_config() -> AutoAwayConfig {
    AutoAwayConfig {
        idle_threshold: IDLE_THRESHOLD_SECS.load(Ordering::Relaxed),
        away_threshold: AWAY_THRESHOLD_SECS.load(Ordering::Relaxed),
    }
}

/// Update auto-away thresholds
#[tauri::command]
pub fn set_auto_away_config(idle_threshold: u64, away_threshold: u64) -> AutoAwayConfig {
    // Enforce minimums (1 minute idle, idle+1 minute away)
    let idle = idle_threshold.max(60);
    let away = away_threshold.max(idle + 60);

    IDLE_THRESHOLD_SECS.store(idle, Ordering::Relaxed);
    AWAY_THRESHOLD_SECS.store(away, Ordering::Relaxed);

    AutoAwayConfig {
        idle_threshold: idle,
        away_threshold: away,
    }
}

/// Start the background auto-away monitor
#[tauri::command]
pub fn start_auto_away_monitor(app: AppHandle) -> Result<(), String> {
    if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    tauri::async_runtime::spawn(async move {
        let mut last_tier = PresenceTier::Active;

        loop {
            if !MONITOR_RUNNING.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(5)).await;

            let idle_secs = crate::activity::get_idle_status().idle_seconds;
            let screen_locked = crate::activity::get_idle_status().screen_locked;
            let idle_threshold = IDLE_THRESHOLD_SECS.load(Ordering::Relaxed);
            let away_threshold = AWAY_THRESHOLD_SECS.load(Ordering::Relaxed);

            // Determine tier
            let tier = if screen_locked || idle_secs >= away_threshold {
                PresenceTier::Away
            } else if idle_secs >= idle_threshold {
                PresenceTier::Idle
            } else {
                PresenceTier::Active
            };

            let state = AutoAwayState {
                tier,
                idle_seconds: idle_secs,
                idle_threshold,
                away_threshold,
                monitor_active: true,
                screen_locked,
            };

            // Update stored state
            {
                let mut current = CURRENT_STATE.write().unwrap();
                *current = Some(state.clone());
            }

            // Emit event only on tier change
            if tier != last_tier {
                log::info!(
                    "Auto-away tier changed: {:?} -> {:?} (idle {}s)",
                    last_tier,
                    tier,
                    idle_secs
                );
                let _ = app.emit("auto-away:tier-changed", &state);
                last_tier = tier;
            }
        }

        log::info!("Auto-away monitor stopped");
    });

    Ok(())
}

/// Stop the background auto-away monitor
#[tauri::command]
pub fn stop_auto_away_monitor() -> Result<(), String> {
    MONITOR_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

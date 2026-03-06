//! Status Countdown Timer - Temporary status with auto-expiry
//!
//! Lets users set a temporary status (e.g., "In a meeting") with a countdown
//! timer. When the timer expires, the status is automatically cleared and
//! the frontend is notified via Tauri events.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusCountdown {
    pub id: String,
    pub label: String,
    pub emoji: Option<String>,
    pub duration_ms: u64,
    pub started_at: u64,
    pub expires_at: u64,
    pub paused: bool,
    pub remaining_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusPreset {
    pub label: String,
    pub emoji: Option<String>,
    pub duration_ms: u64,
}

pub struct StatusCountdownManager {
    active: Mutex<Option<StatusCountdown>>,
    presets: Mutex<Vec<StatusPreset>>,
}

impl Default for StatusCountdownManager {
    fn default() -> Self {
        Self {
            active: Mutex::new(None),
            presets: Mutex::new(vec![
                StatusPreset {
                    label: "In a meeting".into(),
                    emoji: Some("calendar".into()),
                    duration_ms: 30 * 60 * 1000,
                },
                StatusPreset {
                    label: "Taking a break".into(),
                    emoji: Some("coffee".into()),
                    duration_ms: 15 * 60 * 1000,
                },
                StatusPreset {
                    label: "Focusing".into(),
                    emoji: Some("headphones".into()),
                    duration_ms: 60 * 60 * 1000,
                },
                StatusPreset {
                    label: "Be right back".into(),
                    emoji: Some("clock".into()),
                    duration_ms: 5 * 60 * 1000,
                },
                StatusPreset {
                    label: "Do not disturb".into(),
                    emoji: Some("no_entry".into()),
                    duration_ms: 120 * 60 * 1000,
                },
            ]),
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
pub fn countdown_start(
    app: AppHandle,
    state: State<'_, StatusCountdownManager>,
    label: String,
    emoji: Option<String>,
    duration_ms: u64,
) -> Result<StatusCountdown, String> {
    if label.trim().is_empty() {
        return Err("Status label cannot be empty".into());
    }
    if duration_ms == 0 {
        return Err("Duration must be greater than zero".into());
    }

    let now = now_ms();
    let countdown = StatusCountdown {
        id: uuid::Uuid::new_v4().to_string(),
        label,
        emoji,
        duration_ms,
        started_at: now,
        expires_at: now + duration_ms,
        paused: false,
        remaining_ms: duration_ms,
    };

    {
        let mut active = state.active.lock().map_err(|e| e.to_string())?;
        *active = Some(countdown.clone());
    }

    // Spawn expiry watcher
    let app_clone = app.clone();
    let id = countdown.id.clone();
    let expires_at = countdown.expires_at;
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            if now_ms() >= expires_at {
                let _ = app_clone.emit("countdown:expired", &id);
                break;
            }
        }
    });

    let _ = app.emit("countdown:started", &countdown);
    Ok(countdown)
}

#[tauri::command]
pub fn countdown_stop(
    app: AppHandle,
    state: State<'_, StatusCountdownManager>,
) -> Result<bool, String> {
    let mut active = state.active.lock().map_err(|e| e.to_string())?;
    if active.is_some() {
        let id = active.as_ref().unwrap().id.clone();
        *active = None;
        let _ = app.emit("countdown:stopped", &id);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn countdown_get(
    state: State<'_, StatusCountdownManager>,
) -> Result<Option<StatusCountdown>, String> {
    let active = state.active.lock().map_err(|e| e.to_string())?;
    match active.as_ref() {
        Some(countdown) => {
            let now = now_ms();
            if now >= countdown.expires_at && !countdown.paused {
                Ok(None)
            } else {
                let remaining = if countdown.paused {
                    countdown.remaining_ms
                } else {
                    countdown.expires_at.saturating_sub(now)
                };
                Ok(Some(StatusCountdown {
                    remaining_ms: remaining,
                    ..countdown.clone()
                }))
            }
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn countdown_pause(
    app: AppHandle,
    state: State<'_, StatusCountdownManager>,
) -> Result<Option<StatusCountdown>, String> {
    let mut active = state.active.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut countdown) = *active {
        if !countdown.paused {
            let now = now_ms();
            countdown.remaining_ms = countdown.expires_at.saturating_sub(now);
            countdown.paused = true;
            let _ = app.emit("countdown:paused", &countdown.id);
            return Ok(Some(countdown.clone()));
        }
    }
    Ok(active.clone())
}

#[tauri::command]
pub fn countdown_resume(
    app: AppHandle,
    state: State<'_, StatusCountdownManager>,
) -> Result<Option<StatusCountdown>, String> {
    let mut active = state.active.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut countdown) = *active {
        if countdown.paused {
            let now = now_ms();
            countdown.expires_at = now + countdown.remaining_ms;
            countdown.paused = false;
            let _ = app.emit("countdown:resumed", &countdown.id);
            return Ok(Some(countdown.clone()));
        }
    }
    Ok(active.clone())
}

#[tauri::command]
pub fn countdown_extend(
    app: AppHandle,
    state: State<'_, StatusCountdownManager>,
    additional_ms: u64,
) -> Result<Option<StatusCountdown>, String> {
    let mut active = state.active.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut countdown) = *active {
        countdown.expires_at += additional_ms;
        countdown.duration_ms += additional_ms;
        if countdown.paused {
            countdown.remaining_ms += additional_ms;
        }
        let _ = app.emit("countdown:extended", &countdown.id);
        return Ok(Some(countdown.clone()));
    }
    Ok(None)
}

#[tauri::command]
pub fn countdown_get_presets(
    state: State<'_, StatusCountdownManager>,
) -> Result<Vec<StatusPreset>, String> {
    let presets = state.presets.lock().map_err(|e| e.to_string())?;
    Ok(presets.clone())
}

#[tauri::command]
pub fn countdown_add_preset(
    state: State<'_, StatusCountdownManager>,
    label: String,
    emoji: Option<String>,
    duration_ms: u64,
) -> Result<Vec<StatusPreset>, String> {
    let mut presets = state.presets.lock().map_err(|e| e.to_string())?;
    presets.push(StatusPreset {
        label,
        emoji,
        duration_ms,
    });
    Ok(presets.clone())
}

#[tauri::command]
pub fn countdown_remove_preset(
    state: State<'_, StatusCountdownManager>,
    index: usize,
) -> Result<Vec<StatusPreset>, String> {
    let mut presets = state.presets.lock().map_err(|e| e.to_string())?;
    if index >= presets.len() {
        return Err("Preset index out of range".into());
    }
    presets.remove(index);
    Ok(presets.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_countdown_serialization() {
        let countdown = StatusCountdown {
            id: "test-1".into(),
            label: "In a meeting".into(),
            emoji: Some("calendar".into()),
            duration_ms: 1800000,
            started_at: 1700000000000,
            expires_at: 1700001800000,
            paused: false,
            remaining_ms: 1800000,
        };

        let json = serde_json::to_string(&countdown).unwrap();
        assert!(json.contains("In a meeting"));
        assert!(json.contains("calendar"));

        let deserialized: StatusCountdown = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.label, "In a meeting");
    }

    #[test]
    fn test_default_presets() {
        let manager = StatusCountdownManager::default();
        let presets = manager.presets.lock().unwrap();
        assert_eq!(presets.len(), 5);
        assert_eq!(presets[0].label, "In a meeting");
    }
}

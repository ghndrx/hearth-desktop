//! Quick Timer - lightweight countdown timers accessible from the system tray
//!
//! Supports multiple named timers running concurrently. Each timer fires a
//! system notification when it completes and emits events to the frontend.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickTimer {
    pub id: String,
    pub label: String,
    pub duration_secs: u64,
    pub remaining_secs: u64,
    pub is_running: bool,
    pub created_at: u64,
}

pub struct QuickTimerManager {
    timers: Mutex<Vec<QuickTimer>>,
}

impl Default for QuickTimerManager {
    fn default() -> Self {
        Self {
            timers: Mutex::new(Vec::new()),
        }
    }
}

impl QuickTimerManager {
    pub fn get_timers(&self) -> Vec<QuickTimer> {
        self.timers.lock().map(|t| t.clone()).unwrap_or_default()
    }

    pub fn start_timer(&self, label: String, duration_secs: u64) -> QuickTimer {
        let timer = QuickTimer {
            id: format!(
                "timer_{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            ),
            label,
            duration_secs,
            remaining_secs: duration_secs,
            is_running: true,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };

        if let Ok(mut timers) = self.timers.lock() {
            timers.push(timer.clone());
        }

        timer
    }

    pub fn cancel_timer(&self, id: &str) -> bool {
        if let Ok(mut timers) = self.timers.lock() {
            let before = timers.len();
            timers.retain(|t| t.id != id);
            return timers.len() < before;
        }
        false
    }

    pub fn cancel_all(&self) {
        if let Ok(mut timers) = self.timers.lock() {
            timers.clear();
        }
    }

    /// Tick all timers by one second. Returns IDs of completed timers.
    pub fn tick(&self) -> Vec<QuickTimer> {
        let mut completed = Vec::new();
        if let Ok(mut timers) = self.timers.lock() {
            for timer in timers.iter_mut() {
                if timer.is_running && timer.remaining_secs > 0 {
                    timer.remaining_secs -= 1;
                    if timer.remaining_secs == 0 {
                        timer.is_running = false;
                        completed.push(timer.clone());
                    }
                }
            }
            // Remove completed timers
            timers.retain(|t| t.remaining_secs > 0);
        }
        completed
    }

    pub fn has_running_timers(&self) -> bool {
        self.timers
            .lock()
            .map(|t| t.iter().any(|timer| timer.is_running))
            .unwrap_or(false)
    }

    /// Get display text for the tray tooltip
    pub fn tray_display(&self) -> Option<String> {
        let timers = self.timers.lock().ok()?;
        let running: Vec<_> = timers.iter().filter(|t| t.is_running).collect();
        if running.is_empty() {
            return None;
        }

        let displays: Vec<String> = running
            .iter()
            .map(|t| {
                let mins = t.remaining_secs / 60;
                let secs = t.remaining_secs % 60;
                format!("{}: {:02}:{:02}", t.label, mins, secs)
            })
            .collect();

        Some(displays.join(" | "))
    }
}

/// Start the timer tick loop
pub fn start_timer_loop(app: AppHandle, manager: Arc<QuickTimerManager>) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

            let completed = manager.tick();

            // Notify for each completed timer
            for timer in &completed {
                let _ = app
                    .notification()
                    .builder()
                    .title("Timer Complete")
                    .body(format!("{} ({}) is done!", timer.label, format_duration(timer.duration_secs)))
                    .show();

                let _ = app.emit(
                    "quicktimer:completed",
                    serde_json::json!({
                        "id": timer.id,
                        "label": timer.label,
                        "durationSecs": timer.duration_secs,
                    }),
                );
            }

            // Emit tick update if any timers are running
            if manager.has_running_timers() {
                let timers = manager.get_timers();
                let _ = app.emit("quicktimer:tick", &timers);

                // Update tray tooltip
                update_tray_tooltip(&app, &manager);
            } else if !completed.is_empty() {
                // All timers just finished - reset tooltip
                update_tray_tooltip(&app, &manager);
            }
        }
    });
}

fn update_tray_tooltip(app: &AppHandle, manager: &QuickTimerManager) {
    if let Some(tray) = app.tray_by_id("main") {
        let base = "Hearth";
        let tooltip = if let Some(timer_text) = manager.tray_display() {
            format!("{}\n{}", base, timer_text)
        } else {
            base.to_string()
        };
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}

fn format_duration(secs: u64) -> String {
    if secs >= 3600 {
        let h = secs / 3600;
        let m = (secs % 3600) / 60;
        if m > 0 {
            format!("{}h {}m", h, m)
        } else {
            format!("{}h", h)
        }
    } else if secs >= 60 {
        format!("{}m", secs / 60)
    } else {
        format!("{}s", secs)
    }
}

// --- Tauri commands ---

#[tauri::command]
pub fn quicktimer_start(
    manager: tauri::State<'_, Arc<QuickTimerManager>>,
    label: String,
    duration_secs: u64,
) -> Result<QuickTimer, String> {
    if duration_secs == 0 || duration_secs > 86400 {
        return Err("Duration must be between 1 second and 24 hours".into());
    }
    Ok(manager.start_timer(label, duration_secs))
}

#[tauri::command]
pub fn quicktimer_cancel(
    manager: tauri::State<'_, Arc<QuickTimerManager>>,
    id: String,
) -> Result<bool, String> {
    Ok(manager.cancel_timer(&id))
}

#[tauri::command]
pub fn quicktimer_cancel_all(
    manager: tauri::State<'_, Arc<QuickTimerManager>>,
) -> Result<(), String> {
    manager.cancel_all();
    Ok(())
}

#[tauri::command]
pub fn quicktimer_get_all(
    manager: tauri::State<'_, Arc<QuickTimerManager>>,
) -> Result<Vec<QuickTimer>, String> {
    Ok(manager.get_timers())
}

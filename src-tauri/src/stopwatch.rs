//! Stopwatch - precision stopwatch with lap timing
//!
//! Supports start/stop/reset with lap recording. Emits tick events
//! to the frontend for real-time display updates.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lap {
    pub number: u32,
    pub split_ms: u64,
    pub total_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopwatchState {
    pub elapsed_ms: u64,
    pub is_running: bool,
    pub laps: Vec<Lap>,
}

struct StopwatchInner {
    /// Accumulated elapsed time from previous run segments (before the current start)
    accumulated_ms: u64,
    /// Instant when the stopwatch was last started (None if paused/stopped)
    start_instant: Option<Instant>,
    laps: Vec<Lap>,
}

pub struct StopwatchManager {
    inner: Mutex<StopwatchInner>,
}

impl Default for StopwatchManager {
    fn default() -> Self {
        Self {
            inner: Mutex::new(StopwatchInner {
                accumulated_ms: 0,
                start_instant: None,
                laps: Vec::new(),
            }),
        }
    }
}

impl StopwatchManager {
    fn current_elapsed_ms(inner: &StopwatchInner) -> u64 {
        inner.accumulated_ms
            + inner
                .start_instant
                .map(|s| s.elapsed().as_millis() as u64)
                .unwrap_or(0)
    }

    pub fn get_state(&self) -> StopwatchState {
        let inner = self.inner.lock().unwrap();
        StopwatchState {
            elapsed_ms: Self::current_elapsed_ms(&inner),
            is_running: inner.start_instant.is_some(),
            laps: inner.laps.clone(),
        }
    }

    pub fn start(&self) -> StopwatchState {
        let mut inner = self.inner.lock().unwrap();
        if inner.start_instant.is_none() {
            inner.start_instant = Some(Instant::now());
        }
        StopwatchState {
            elapsed_ms: Self::current_elapsed_ms(&inner),
            is_running: true,
            laps: inner.laps.clone(),
        }
    }

    pub fn stop(&self) -> StopwatchState {
        let mut inner = self.inner.lock().unwrap();
        if let Some(start) = inner.start_instant.take() {
            inner.accumulated_ms += start.elapsed().as_millis() as u64;
        }
        StopwatchState {
            elapsed_ms: inner.accumulated_ms,
            is_running: false,
            laps: inner.laps.clone(),
        }
    }

    pub fn reset(&self) -> StopwatchState {
        let mut inner = self.inner.lock().unwrap();
        inner.accumulated_ms = 0;
        inner.start_instant = None;
        inner.laps.clear();
        StopwatchState {
            elapsed_ms: 0,
            is_running: false,
            laps: Vec::new(),
        }
    }

    pub fn lap(&self) -> StopwatchState {
        let mut inner = self.inner.lock().unwrap();
        if inner.start_instant.is_none() {
            // Can't lap when stopped
            return StopwatchState {
                elapsed_ms: inner.accumulated_ms,
                is_running: false,
                laps: inner.laps.clone(),
            };
        }

        let total_ms = Self::current_elapsed_ms(&inner);
        let prev_total = inner.laps.last().map(|l| l.total_ms).unwrap_or(0);
        let split_ms = total_ms.saturating_sub(prev_total);
        let number = inner.laps.len() as u32 + 1;

        inner.laps.push(Lap {
            number,
            split_ms,
            total_ms,
        });

        StopwatchState {
            elapsed_ms: total_ms,
            is_running: true,
            laps: inner.laps.clone(),
        }
    }

    pub fn is_running(&self) -> bool {
        self.inner
            .lock()
            .map(|i| i.start_instant.is_some())
            .unwrap_or(false)
    }
}

/// Start the tick loop that emits elapsed time to the frontend
pub fn start_stopwatch_loop(app: AppHandle, manager: std::sync::Arc<StopwatchManager>) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

            if manager.is_running() {
                let state = manager.get_state();
                let _ = app.emit("stopwatch:tick", &state);
            }
        }
    });
}

// --- Tauri commands ---

#[tauri::command]
pub fn stopwatch_start(
    manager: tauri::State<'_, std::sync::Arc<StopwatchManager>>,
) -> Result<StopwatchState, String> {
    Ok(manager.start())
}

#[tauri::command]
pub fn stopwatch_stop(
    manager: tauri::State<'_, std::sync::Arc<StopwatchManager>>,
) -> Result<StopwatchState, String> {
    Ok(manager.stop())
}

#[tauri::command]
pub fn stopwatch_reset(
    manager: tauri::State<'_, std::sync::Arc<StopwatchManager>>,
) -> Result<StopwatchState, String> {
    Ok(manager.reset())
}

#[tauri::command]
pub fn stopwatch_lap(
    manager: tauri::State<'_, std::sync::Arc<StopwatchManager>>,
) -> Result<StopwatchState, String> {
    Ok(manager.lap())
}

#[tauri::command]
pub fn stopwatch_get_state(
    manager: tauri::State<'_, std::sync::Arc<StopwatchManager>>,
) -> Result<StopwatchState, String> {
    Ok(manager.get_state())
}

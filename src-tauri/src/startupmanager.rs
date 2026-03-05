//! System Startup Manager - Control app startup behavior
//!
//! Provides:
//! - Startup task management
//! - Startup performance tracking
//! - Deferred loading configuration
//! - Startup profile selection
//! - Boot time optimization hints

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupTask {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub priority: u8,
    pub defer_ms: u32,
    pub category: String,
    pub average_duration_ms: f64,
    pub last_duration_ms: Option<f64>,
    pub run_count: u32,
}

impl StartupTask {
    fn new(name: String, description: String, category: String, priority: u8) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            description,
            enabled: true,
            priority,
            defer_ms: 0,
            category,
            average_duration_ms: 0.0,
            last_duration_ms: None,
            run_count: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupProfile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub task_ids: Vec<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupMetrics {
    pub total_startup_time_ms: f64,
    pub fastest_startup_ms: f64,
    pub slowest_startup_ms: f64,
    pub average_startup_ms: f64,
    pub startup_count: u32,
    pub last_startup_time: Option<String>,
    pub task_timings: Vec<TaskTiming>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskTiming {
    pub task_id: String,
    pub task_name: String,
    pub duration_ms: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupState {
    pub tasks: Vec<StartupTask>,
    pub profiles: Vec<StartupProfile>,
    pub active_profile_id: Option<String>,
    pub metrics: StartupMetrics,
    pub startup_optimization_enabled: bool,
    pub lazy_load_enabled: bool,
    pub preload_recent_channels: bool,
    pub preload_user_data: bool,
}

impl Default for StartupState {
    fn default() -> Self {
        let default_tasks = vec![
            StartupTask::new(
                "WebSocket Connection".to_string(),
                "Establish gateway connection".to_string(),
                "Network".to_string(),
                1,
            ),
            StartupTask::new(
                "Auth Validation".to_string(),
                "Validate stored credentials".to_string(),
                "Auth".to_string(),
                1,
            ),
            StartupTask::new(
                "Theme Loading".to_string(),
                "Load theme preferences".to_string(),
                "UI".to_string(),
                2,
            ),
            StartupTask::new(
                "Notification Setup".to_string(),
                "Initialize notification system".to_string(),
                "System".to_string(),
                3,
            ),
            StartupTask::new(
                "Search Index".to_string(),
                "Load local search index".to_string(),
                "Data".to_string(),
                4,
            ),
            StartupTask::new(
                "Voice System".to_string(),
                "Initialize voice subsystem".to_string(),
                "Media".to_string(),
                5,
            ),
            StartupTask::new(
                "Plugin Loading".to_string(),
                "Load enabled plugins".to_string(),
                "Extensions".to_string(),
                6,
            ),
            StartupTask::new(
                "Spell Check".to_string(),
                "Load spell check dictionaries".to_string(),
                "UI".to_string(),
                7,
            ),
        ];

        let task_ids: Vec<String> = default_tasks.iter().map(|t| t.id.clone()).collect();

        Self {
            tasks: default_tasks,
            profiles: vec![
                StartupProfile {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: "Full".to_string(),
                    description: "Load all features".to_string(),
                    task_ids: task_ids.clone(),
                    is_active: true,
                },
                StartupProfile {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: "Minimal".to_string(),
                    description: "Load essentials only for faster startup".to_string(),
                    task_ids: task_ids[..3].to_vec(),
                    is_active: false,
                },
            ],
            active_profile_id: None,
            metrics: StartupMetrics {
                total_startup_time_ms: 0.0,
                fastest_startup_ms: f64::MAX,
                slowest_startup_ms: 0.0,
                average_startup_ms: 0.0,
                startup_count: 0,
                last_startup_time: None,
                task_timings: Vec::new(),
            },
            startup_optimization_enabled: true,
            lazy_load_enabled: true,
            preload_recent_channels: true,
            preload_user_data: true,
        }
    }
}

pub struct StartupManager {
    state: Mutex<StartupState>,
}

impl Default for StartupManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(StartupState::default()),
        }
    }
}

#[tauri::command]
pub async fn startup_get_state(
    manager: State<'_, StartupManager>,
) -> Result<StartupState, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

#[tauri::command]
pub async fn startup_get_tasks(
    manager: State<'_, StartupManager>,
) -> Result<Vec<StartupTask>, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.tasks.clone())
}

#[tauri::command]
pub async fn startup_toggle_task(
    task_id: String,
    manager: State<'_, StartupManager>,
) -> Result<bool, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let task = state
        .tasks
        .iter_mut()
        .find(|t| t.id == task_id)
        .ok_or("Task not found")?;
    task.enabled = !task.enabled;
    Ok(task.enabled)
}

#[tauri::command]
pub async fn startup_set_task_defer(
    task_id: String,
    defer_ms: u32,
    manager: State<'_, StartupManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let task = state
        .tasks
        .iter_mut()
        .find(|t| t.id == task_id)
        .ok_or("Task not found")?;
    task.defer_ms = defer_ms;
    Ok(())
}

#[tauri::command]
pub async fn startup_set_task_priority(
    task_id: String,
    priority: u8,
    manager: State<'_, StartupManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let task = state
        .tasks
        .iter_mut()
        .find(|t| t.id == task_id)
        .ok_or("Task not found")?;
    task.priority = priority;
    Ok(())
}

#[tauri::command]
pub async fn startup_record_timing(
    task_id: String,
    duration_ms: f64,
    manager: State<'_, StartupManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let task = state
        .tasks
        .iter_mut()
        .find(|t| t.id == task_id)
        .ok_or("Task not found")?;

    task.run_count += 1;
    task.last_duration_ms = Some(duration_ms);
    let count = task.run_count as f64;
    task.average_duration_ms =
        ((task.average_duration_ms * (count - 1.0)) + duration_ms) / count;

    Ok(())
}

#[tauri::command]
pub async fn startup_record_boot(
    total_ms: f64,
    task_timings: Vec<TaskTiming>,
    manager: State<'_, StartupManager>,
    app: AppHandle,
) -> Result<StartupMetrics, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.metrics.startup_count += 1;
    state.metrics.total_startup_time_ms += total_ms;
    state.metrics.last_startup_time = Some(Utc::now().to_rfc3339());
    state.metrics.task_timings = task_timings;

    if total_ms < state.metrics.fastest_startup_ms {
        state.metrics.fastest_startup_ms = total_ms;
    }
    if total_ms > state.metrics.slowest_startup_ms {
        state.metrics.slowest_startup_ms = total_ms;
    }

    let count = state.metrics.startup_count as f64;
    state.metrics.average_startup_ms = state.metrics.total_startup_time_ms / count;

    let metrics = state.metrics.clone();
    let _ = app.emit("startup-recorded", &metrics);
    Ok(metrics)
}

#[tauri::command]
pub async fn startup_get_metrics(
    manager: State<'_, StartupManager>,
) -> Result<StartupMetrics, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.metrics.clone())
}

#[tauri::command]
pub async fn startup_get_profiles(
    manager: State<'_, StartupManager>,
) -> Result<Vec<StartupProfile>, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.profiles.clone())
}

#[tauri::command]
pub async fn startup_set_active_profile(
    profile_id: String,
    manager: State<'_, StartupManager>,
    app: AppHandle,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    for p in &mut state.profiles {
        p.is_active = p.id == profile_id;
    }
    state.active_profile_id = Some(profile_id.clone());
    let _ = app.emit("startup-profile-changed", &profile_id);
    Ok(())
}

#[tauri::command]
pub async fn startup_create_profile(
    name: String,
    description: String,
    task_ids: Vec<String>,
    manager: State<'_, StartupManager>,
) -> Result<StartupProfile, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let profile = StartupProfile {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        description,
        task_ids,
        is_active: false,
    };
    state.profiles.push(profile.clone());
    Ok(profile)
}

#[tauri::command]
pub async fn startup_delete_profile(
    profile_id: String,
    manager: State<'_, StartupManager>,
) -> Result<bool, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let len = state.profiles.len();
    state.profiles.retain(|p| p.id != profile_id);
    Ok(state.profiles.len() < len)
}

#[tauri::command]
pub async fn startup_set_lazy_load(
    enabled: bool,
    manager: State<'_, StartupManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.lazy_load_enabled = enabled;
    Ok(())
}

#[tauri::command]
pub async fn startup_set_optimization(
    enabled: bool,
    manager: State<'_, StartupManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.startup_optimization_enabled = enabled;
    Ok(())
}

#[tauri::command]
pub async fn startup_reset_metrics(
    manager: State<'_, StartupManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.metrics = StartupMetrics {
        total_startup_time_ms: 0.0,
        fastest_startup_ms: f64::MAX,
        slowest_startup_ms: 0.0,
        average_startup_ms: 0.0,
        startup_count: 0,
        last_startup_time: None,
        task_timings: Vec::new(),
    };
    Ok(())
}

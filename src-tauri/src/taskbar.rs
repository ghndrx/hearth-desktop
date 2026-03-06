// Taskbar/Dock Progress Indicator
// Shows progress in native Windows taskbar or macOS dock

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};

lazy_static::lazy_static! {
    static ref PROGRESS_STATE: Mutex<ProgressState> = Mutex::new(ProgressState::default());
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProgressState {
    pub active: bool,
    pub progress: f64,
    pub mode: ProgressMode,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProgressMode {
    #[default]
    None,
    Indeterminate,
    Normal,
    Paused,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetProgressOptions {
    pub progress: Option<f64>,
    pub mode: Option<ProgressMode>,
    pub label: Option<String>,
}

/// Set taskbar/dock progress
#[tauri::command]
pub async fn set_taskbar_progress<R: Runtime>(
    window: WebviewWindow<R>,
    options: SetProgressOptions,
) -> Result<ProgressState, String> {
    let mut state = PROGRESS_STATE.lock().map_err(|e| e.to_string())?;
    
    if let Some(progress) = options.progress {
        state.progress = progress.clamp(0.0, 1.0);
    }
    
    if let Some(mode) = options.mode {
        state.mode = mode;
        state.active = mode != ProgressMode::None;
    }
    
    if let Some(label) = options.label {
        state.label = Some(label);
    }
    
    // Apply to native window
    apply_progress_to_window(&window, &state)?;
    
    Ok(state.clone())
}

/// Clear taskbar/dock progress
#[tauri::command]
pub async fn clear_taskbar_progress<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<(), String> {
    let mut state = PROGRESS_STATE.lock().map_err(|e| e.to_string())?;
    *state = ProgressState::default();
    
    apply_progress_to_window(&window, &state)?;
    
    Ok(())
}

/// Get current progress state
#[tauri::command]
pub async fn get_taskbar_progress() -> Result<ProgressState, String> {
    let state = PROGRESS_STATE.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

/// Apply progress to the native window
fn apply_progress_to_window<R: Runtime>(
    window: &WebviewWindow<R>,
    state: &ProgressState,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        apply_windows_progress(window, state)?;
    }
    
    #[cfg(target_os = "macos")]
    {
        apply_macos_progress(window, state)?;
    }
    
    #[cfg(target_os = "linux")]
    {
        apply_linux_progress(window, state)?;
    }
    
    Ok(())
}

#[cfg(target_os = "windows")]
fn apply_windows_progress<R: Runtime>(
    window: &WebviewWindow<R>,
    state: &ProgressState,
) -> Result<(), String> {
    use std::ffi::c_void;
    
    // Windows taskbar progress uses ITaskbarList3
    // For now, we'll use the Tauri window progress API if available
    // This is a simplified implementation
    
    let progress_value = if state.active {
        match state.mode {
            ProgressMode::Indeterminate => None,
            ProgressMode::Normal => Some((state.progress * 100.0) as u32),
            ProgressMode::Paused => Some((state.progress * 100.0) as u32),
            ProgressMode::Error => Some((state.progress * 100.0) as u32),
            ProgressMode::None => None,
        }
    } else {
        None
    };
    
    // Log progress state for debugging
    log::debug!(
        "Windows taskbar progress: active={}, mode={:?}, value={:?}",
        state.active,
        state.mode,
        progress_value
    );
    
    // Note: Full Windows ITaskbarList3 implementation would require
    // additional COM interop - this is a placeholder for the pattern
    
    Ok(())
}

#[cfg(target_os = "macos")]
fn apply_macos_progress<R: Runtime>(
    window: &WebviewWindow<R>,
    state: &ProgressState,
) -> Result<(), String> {
    // macOS dock progress badge
    // Uses NSProgressIndicator on the dock icon
    
    log::debug!(
        "macOS dock progress: active={}, mode={:?}, progress={}",
        state.active,
        state.mode,
        state.progress
    );
    
    // Note: Full macOS implementation would use objc crate
    // to interact with NSApplication and NSDockTile
    
    Ok(())
}

#[cfg(target_os = "linux")]
fn apply_linux_progress<R: Runtime>(
    window: &WebviewWindow<R>,
    state: &ProgressState,
) -> Result<(), String> {
    // Linux uses Unity launcher API or libunity
    // Also supports DBus com.canonical.Unity.LauncherEntry
    
    log::debug!(
        "Linux taskbar progress: active={}, mode={:?}, progress={}",
        state.active,
        state.mode,
        state.progress
    );
    
    Ok(())
}

/// Track an ongoing operation with automatic progress updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationProgress {
    pub id: String,
    pub label: String,
    pub total: u64,
    pub completed: u64,
    pub started_at: i64,
}

static OPERATIONS: Mutex<Vec<OperationProgress>> = Mutex::new(Vec::new());

/// Start tracking a new operation
#[tauri::command]
pub async fn start_operation<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    label: String,
    total: u64,
) -> Result<OperationProgress, String> {
    let op = OperationProgress {
        id: id.clone(),
        label,
        total,
        completed: 0,
        started_at: chrono::Utc::now().timestamp_millis(),
    };
    
    {
        let mut ops = OPERATIONS.lock().map_err(|e| e.to_string())?;
        ops.retain(|o| o.id != id);
        ops.push(op.clone());
    }
    
    update_aggregate_progress(&app).await?;
    
    Ok(op)
}

/// Update operation progress
#[tauri::command]
pub async fn update_operation<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    completed: u64,
) -> Result<Option<OperationProgress>, String> {
    let op = {
        let mut ops = OPERATIONS.lock().map_err(|e| e.to_string())?;
        if let Some(op) = ops.iter_mut().find(|o| o.id == id) {
            op.completed = completed;
            Some(op.clone())
        } else {
            None
        }
    };
    
    update_aggregate_progress(&app).await?;
    
    Ok(op)
}

/// Complete/remove an operation
#[tauri::command]
pub async fn complete_operation<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<(), String> {
    {
        let mut ops = OPERATIONS.lock().map_err(|e| e.to_string())?;
        ops.retain(|o| o.id != id);
    }
    
    update_aggregate_progress(&app).await?;
    
    Ok(())
}

/// Get all active operations
#[tauri::command]
pub async fn get_operations() -> Result<Vec<OperationProgress>, String> {
    let ops = OPERATIONS.lock().map_err(|e| e.to_string())?;
    Ok(ops.clone())
}

/// Update aggregate progress from all operations
async fn update_aggregate_progress<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let (total, completed, count) = {
        let ops = OPERATIONS.lock().map_err(|e| e.to_string())?;
        let total: u64 = ops.iter().map(|o| o.total).sum();
        let completed: u64 = ops.iter().map(|o| o.completed).sum();
        (total, completed, ops.len())
    };
    
    if let Some(window) = app.get_webview_window("main") {
        if count == 0 {
            clear_taskbar_progress(window).await?;
        } else {
            let progress = if total > 0 {
                completed as f64 / total as f64
            } else {
                0.0
            };
            
            set_taskbar_progress(
                window,
                SetProgressOptions {
                    progress: Some(progress),
                    mode: Some(ProgressMode::Normal),
                    label: Some(format!("{} operation(s)", count)),
                },
            )
            .await?;
        }
    }
    
    // Emit event to frontend
    app.emit("taskbar-progress-update", serde_json::json!({
        "total": total,
        "completed": completed,
        "operations": count,
        "progress": if total > 0 { completed as f64 / total as f64 } else { 0.0 },
    })).map_err(|e| e.to_string())?;
    
    Ok(())
}

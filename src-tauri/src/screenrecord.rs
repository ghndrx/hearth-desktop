use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State, Window};

/// Recording state enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RecordingStatus {
    Idle,
    Recording,
    Paused,
    Processing,
}

impl Default for RecordingStatus {
    fn default() -> Self {
        Self::Idle
    }
}

/// Output format for screen recordings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Mp4,
    Webm,
    Gif,
}

impl Default for OutputFormat {
    fn default() -> Self {
        Self::Mp4
    }
}

impl OutputFormat {
    fn extension(&self) -> &str {
        match self {
            OutputFormat::Mp4 => "mp4",
            OutputFormat::Webm => "webm",
            OutputFormat::Gif => "gif",
        }
    }
}

/// Recording quality preset
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RecordingQuality {
    Low,
    Medium,
    High,
    Ultra,
}

impl Default for RecordingQuality {
    fn default() -> Self {
        Self::High
    }
}

/// Capture area selection
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CaptureArea {
    Fullscreen,
    Window,
    Region,
}

impl Default for CaptureArea {
    fn default() -> Self {
        Self::Fullscreen
    }
}

/// Screen recording settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenRecordSettings {
    pub format: OutputFormat,
    pub quality: RecordingQuality,
    pub fps: u32,
    #[serde(rename = "captureAudio")]
    pub capture_audio: bool,
    #[serde(rename = "captureMicrophone")]
    pub capture_microphone: bool,
    #[serde(rename = "captureArea")]
    pub capture_area: CaptureArea,
    #[serde(rename = "maxDurationSeconds")]
    pub max_duration_seconds: u64,
}

impl Default for ScreenRecordSettings {
    fn default() -> Self {
        Self {
            format: OutputFormat::default(),
            quality: RecordingQuality::default(),
            fps: 30,
            capture_audio: true,
            capture_microphone: false,
            capture_area: CaptureArea::default(),
            max_duration_seconds: 300,
        }
    }
}

/// Configuration passed when starting a recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenRecordConfig {
    pub format: Option<OutputFormat>,
    pub quality: Option<RecordingQuality>,
    pub fps: Option<u32>,
    #[serde(rename = "captureAudio")]
    pub capture_audio: Option<bool>,
    #[serde(rename = "captureMicrophone")]
    pub capture_microphone: Option<bool>,
    #[serde(rename = "captureArea")]
    pub capture_area: Option<CaptureArea>,
    #[serde(rename = "maxDurationSeconds")]
    pub max_duration_seconds: Option<u64>,
}

/// Information about a saved recording file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingInfo {
    pub path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    pub format: String,
    pub duration: f64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

/// Serializable state snapshot sent to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingStateSnapshot {
    pub status: RecordingStatus,
    #[serde(rename = "elapsedSeconds")]
    pub elapsed_seconds: f64,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
}

/// Internal recording state (not serializable due to Instant)
#[derive(Debug)]
pub struct RecordingState {
    pub status: RecordingStatus,
    pub start_time: Option<Instant>,
    pub pause_start: Option<Instant>,
    pub paused_duration: Duration,
    pub file_path: Option<PathBuf>,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            status: RecordingStatus::Idle,
            start_time: None,
            pause_start: None,
            paused_duration: Duration::ZERO,
            file_path: None,
        }
    }
}

impl RecordingState {
    fn elapsed_seconds(&self) -> f64 {
        match (&self.status, self.start_time) {
            (RecordingStatus::Recording, Some(start)) => {
                (start.elapsed() - self.paused_duration).as_secs_f64()
            }
            (RecordingStatus::Paused, Some(start)) => {
                let total_paused = if let Some(pause_start) = self.pause_start {
                    self.paused_duration + pause_start.elapsed()
                } else {
                    self.paused_duration
                };
                (start.elapsed() - total_paused).as_secs_f64()
            }
            _ => 0.0,
        }
    }

    fn snapshot(&self) -> RecordingStateSnapshot {
        RecordingStateSnapshot {
            status: self.status.clone(),
            elapsed_seconds: self.elapsed_seconds(),
            file_path: self.file_path.as_ref().map(|p| p.to_string_lossy().to_string()),
        }
    }
}

/// Global screen record manager
pub struct ScreenRecordManager {
    pub state: Mutex<RecordingState>,
    pub settings: Mutex<ScreenRecordSettings>,
}

impl Default for ScreenRecordManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(RecordingState::default()),
            settings: Mutex::new(ScreenRecordSettings::default()),
        }
    }
}

/// Get or create the recordings directory inside app data
fn get_recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    let recordings_dir = app_data.join("recordings");
    if !recordings_dir.exists() {
        fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;
    }
    Ok(recordings_dir)
}

/// Emit state change event to the frontend
fn emit_state_changed(window: &Window, state: &RecordingState) {
    let snapshot = state.snapshot();
    let _ = window.emit("screenrecord-state-changed", &snapshot);
}

/// Start screen recording
#[tauri::command]
pub async fn screenrecord_start(
    config: Option<ScreenRecordConfig>,
    state: State<'_, ScreenRecordManager>,
    window: Window,
    app: AppHandle,
) -> Result<serde_json::Value, String> {
    let mut rec = state.state.lock().map_err(|e| e.to_string())?;

    if rec.status == RecordingStatus::Recording || rec.status == RecordingStatus::Paused {
        return Err("Recording already in progress".to_string());
    }

    // Apply config overrides to settings if provided
    let settings = {
        let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
        if let Some(cfg) = config {
            if let Some(format) = cfg.format {
                settings.format = format;
            }
            if let Some(quality) = cfg.quality {
                settings.quality = quality;
            }
            if let Some(fps) = cfg.fps {
                settings.fps = fps;
            }
            if let Some(audio) = cfg.capture_audio {
                settings.capture_audio = audio;
            }
            if let Some(mic) = cfg.capture_microphone {
                settings.capture_microphone = mic;
            }
            if let Some(area) = cfg.capture_area {
                settings.capture_area = area;
            }
            if let Some(max_dur) = cfg.max_duration_seconds {
                settings.max_duration_seconds = max_dur;
            }
        }
        settings.clone()
    };

    // Generate output file path
    let recordings_dir = get_recordings_dir(&app)?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let file_name = format!("recording_{}.{}", timestamp, settings.format.extension());
    let file_path = recordings_dir.join(&file_name);

    // Platform-specific recording initialization
    #[cfg(target_os = "macos")]
    {
        // macOS: Use AVFoundation / CGDisplayStream for screen capture
        // In a full implementation, would initialize AVCaptureSession with
        // screen input and optional audio/mic inputs
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: Use Desktop Duplication API or Windows.Graphics.Capture
        // In a full implementation, would initialize capture session with
        // Direct3D device and frame pool
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: Use PipeWire screen capture or ffmpeg with x11grab/waylandgrab
        // In a full implementation, would spawn ffmpeg process with appropriate
        // input source and encoding parameters
    }

    rec.status = RecordingStatus::Recording;
    rec.start_time = Some(Instant::now());
    rec.pause_start = None;
    rec.paused_duration = Duration::ZERO;
    rec.file_path = Some(file_path.clone());

    emit_state_changed(&window, &rec);

    Ok(serde_json::json!({
        "filePath": file_path.to_string_lossy(),
        "format": settings.format,
        "fps": settings.fps,
        "quality": settings.quality
    }))
}

/// Stop screen recording and finalize the output file
#[tauri::command]
pub async fn screenrecord_stop(
    state: State<'_, ScreenRecordManager>,
    window: Window,
) -> Result<serde_json::Value, String> {
    let mut rec = state.state.lock().map_err(|e| e.to_string())?;

    if rec.status != RecordingStatus::Recording && rec.status != RecordingStatus::Paused {
        return Err("No recording in progress".to_string());
    }

    let elapsed = rec.elapsed_seconds();
    let file_path = rec
        .file_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    // Set processing state while finalizing
    rec.status = RecordingStatus::Processing;
    emit_state_changed(&window, &rec);

    // In a real implementation:
    // 1. Stop the capture session / ffmpeg process
    // 2. Finalize the container (mux audio+video, write moov atom for mp4)
    // 3. Optionally convert to gif if gif format is selected

    // Reset state to idle
    rec.status = RecordingStatus::Idle;
    rec.start_time = None;
    rec.pause_start = None;
    rec.paused_duration = Duration::ZERO;

    emit_state_changed(&window, &rec);

    Ok(serde_json::json!({
        "filePath": file_path,
        "duration": elapsed
    }))
}

/// Pause the active recording
#[tauri::command]
pub async fn screenrecord_pause(
    state: State<'_, ScreenRecordManager>,
    window: Window,
) -> Result<(), String> {
    let mut rec = state.state.lock().map_err(|e| e.to_string())?;

    if rec.status != RecordingStatus::Recording {
        return Err("Not currently recording".to_string());
    }

    rec.status = RecordingStatus::Paused;
    rec.pause_start = Some(Instant::now());

    // In a real implementation, pause the capture pipeline

    emit_state_changed(&window, &rec);
    Ok(())
}

/// Resume a paused recording
#[tauri::command]
pub async fn screenrecord_resume(
    state: State<'_, ScreenRecordManager>,
    window: Window,
) -> Result<(), String> {
    let mut rec = state.state.lock().map_err(|e| e.to_string())?;

    if rec.status != RecordingStatus::Paused {
        return Err("Recording is not paused".to_string());
    }

    // Accumulate paused time
    if let Some(pause_start) = rec.pause_start.take() {
        rec.paused_duration += pause_start.elapsed();
    }

    rec.status = RecordingStatus::Recording;

    // In a real implementation, resume the capture pipeline

    emit_state_changed(&window, &rec);
    Ok(())
}

/// Cancel recording and clean up any partial files
#[tauri::command]
pub async fn screenrecord_cancel(
    state: State<'_, ScreenRecordManager>,
    window: Window,
) -> Result<(), String> {
    let mut rec = state.state.lock().map_err(|e| e.to_string())?;

    // Clean up partial recording file
    if let Some(ref path) = rec.file_path {
        let _ = fs::remove_file(path);
    }

    // In a real implementation, stop and discard the capture pipeline

    rec.status = RecordingStatus::Idle;
    rec.start_time = None;
    rec.pause_start = None;
    rec.paused_duration = Duration::ZERO;
    rec.file_path = None;

    emit_state_changed(&window, &rec);
    Ok(())
}

/// Get the current recording state
#[tauri::command]
pub async fn screenrecord_get_state(
    state: State<'_, ScreenRecordManager>,
) -> Result<RecordingStateSnapshot, String> {
    let rec = state.state.lock().map_err(|e| e.to_string())?;
    Ok(rec.snapshot())
}

/// Get current recording settings
#[tauri::command]
pub async fn screenrecord_get_settings(
    state: State<'_, ScreenRecordManager>,
) -> Result<ScreenRecordSettings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

/// Update recording settings
#[tauri::command]
pub async fn screenrecord_update_settings(
    settings: ScreenRecordSettings,
    state: State<'_, ScreenRecordManager>,
) -> Result<(), String> {
    // Validate fps
    if ![15, 30, 60].contains(&settings.fps) {
        return Err("FPS must be 15, 30, or 60".to_string());
    }

    // Validate max duration (1 second to 1 hour)
    if settings.max_duration_seconds == 0 || settings.max_duration_seconds > 3600 {
        return Err("Max duration must be between 1 and 3600 seconds".to_string());
    }

    let mut current = state.settings.lock().map_err(|e| e.to_string())?;
    *current = settings;
    Ok(())
}

/// List all saved recordings in the recordings directory
#[tauri::command]
pub async fn screenrecord_list_recordings(
    app: AppHandle,
) -> Result<Vec<RecordingInfo>, String> {
    let recordings_dir = get_recordings_dir(&app)?;
    let mut recordings = Vec::new();

    let entries = fs::read_dir(&recordings_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !["mp4", "webm", "gif"].contains(&ext.as_str()) {
            continue;
        }

        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

        let created_at = metadata
            .created()
            .or_else(|_| metadata.modified())
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y-%m-%d %H:%M:%S").to_string()
            })
            .unwrap_or_else(|_| "Unknown".to_string());

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Estimate duration from file size (rough heuristic)
        // In a real implementation, read container metadata
        let estimated_duration = match ext.as_str() {
            "mp4" => (metadata.len() as f64) / 500_000.0, // ~500KB/s estimate
            "webm" => (metadata.len() as f64) / 400_000.0,
            "gif" => (metadata.len() as f64) / 1_000_000.0,
            _ => 0.0,
        };

        recordings.push(RecordingInfo {
            path: path.to_string_lossy().to_string(),
            file_name,
            file_size: metadata.len(),
            format: ext,
            duration: estimated_duration,
            created_at,
        });
    }

    // Sort by creation date, newest first
    recordings.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(recordings)
}

/// Delete a saved recording
#[tauri::command]
pub async fn screenrecord_delete_recording(
    path: String,
    app: AppHandle,
) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Security check: ensure the file is within the recordings directory
    let recordings_dir = get_recordings_dir(&app)?;
    let canonical_file = file_path
        .canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;
    let canonical_dir = recordings_dir
        .canonicalize()
        .map_err(|e| format!("Invalid recordings dir: {}", e))?;

    if !canonical_file.starts_with(&canonical_dir) {
        return Err("File is not within the recordings directory".to_string());
    }

    fs::remove_file(&file_path).map_err(|e| format!("Failed to delete recording: {}", e))?;

    Ok(())
}

/// Get detailed info about a specific recording file
#[tauri::command]
pub async fn screenrecord_get_recording_info(
    path: String,
    app: AppHandle,
) -> Result<RecordingInfo, String> {
    let file_path = PathBuf::from(&path);

    // Security check
    let recordings_dir = get_recordings_dir(&app)?;
    let canonical_file = file_path
        .canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;
    let canonical_dir = recordings_dir
        .canonicalize()
        .map_err(|e| format!("Invalid recordings dir: {}", e))?;

    if !canonical_file.starts_with(&canonical_dir) {
        return Err("File is not within the recordings directory".to_string());
    }

    if !file_path.is_file() {
        return Err("Recording file not found".to_string());
    }

    let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let created_at = metadata
        .created()
        .or_else(|_| metadata.modified())
        .map(|t| {
            let datetime: chrono::DateTime<chrono::Local> = t.into();
            datetime.format("%Y-%m-%d %H:%M:%S").to_string()
        })
        .unwrap_or_else(|_| "Unknown".to_string());

    let estimated_duration = match ext.as_str() {
        "mp4" => (metadata.len() as f64) / 500_000.0,
        "webm" => (metadata.len() as f64) / 400_000.0,
        "gif" => (metadata.len() as f64) / 1_000_000.0,
        _ => 0.0,
    };

    Ok(RecordingInfo {
        path: file_path.to_string_lossy().to_string(),
        file_name,
        file_size: metadata.len(),
        format: ext,
        duration: estimated_duration,
        created_at,
    })
}

// Commands are registered via tauri::generate_handler! in main.rs

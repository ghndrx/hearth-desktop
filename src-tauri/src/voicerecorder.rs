use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;

/// Voice recording configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingConfig {
    pub device: String,
    pub quality: String,
    pub format: String,
    pub noise_reduction: bool,
}

/// Recording state
#[derive(Debug)]
pub struct RecordingState {
    pub is_recording: bool,
    pub is_paused: bool,
    pub start_time: Option<Instant>,
    pub paused_duration: Duration,
    pub file_path: Option<PathBuf>,
    pub audio_level: f32,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            is_recording: false,
            is_paused: false,
            start_time: None,
            paused_duration: Duration::ZERO,
            file_path: None,
            audio_level: 0.0,
        }
    }
}

/// Global recording state manager
pub struct VoiceRecorderManager {
    pub state: Mutex<RecordingState>,
}

impl Default for VoiceRecorderManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(RecordingState::default()),
        }
    }
}

/// Audio input device info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
}

/// Recording result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingResult {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub duration: f64,
}

/// Start voice recording
#[tauri::command]
pub async fn start_voice_recording(
    config: RecordingConfig,
    manager: State<'_, VoiceRecorderManager>,
) -> Result<serde_json::Value, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if state.is_recording {
        return Err("Recording already in progress".to_string());
    }

    // Generate output file path
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let ext = match config.format.as_str() {
        "mp3" => "mp3",
        "wav" => "wav",
        _ => "opus",
    };
    
    let temp_dir = std::env::temp_dir();
    let file_name = format!("voice_message_{}. {}", timestamp, ext);
    let file_path = temp_dir.join(&file_name);
    
    // Initialize recording (platform-specific implementation would go here)
    // For now, we simulate the recording setup
    
    state.is_recording = true;
    state.is_paused = false;
    state.start_time = Some(Instant::now());
    state.paused_duration = Duration::ZERO;
    state.file_path = Some(file_path.clone());
    state.audio_level = 0.0;

    // In a real implementation, we would:
    // 1. Initialize the audio capture device
    // 2. Set up the encoder based on format/quality
    // 3. Apply noise reduction if enabled
    // 4. Start writing to the output file
    
    #[cfg(target_os = "macos")]
    {
        // macOS: Use AVFoundation for audio capture
        // AVAudioRecorder or AVCaptureSession
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows: Use WASAPI for audio capture
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux: Use PulseAudio or PipeWire
    }

    Ok(serde_json::json!({
        "filePath": file_path.to_string_lossy()
    }))
}

/// Stop voice recording
#[tauri::command]
pub async fn stop_voice_recording(
    manager: State<'_, VoiceRecorderManager>,
) -> Result<RecordingResult, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if !state.is_recording {
        return Err("No recording in progress".to_string());
    }

    // Calculate duration
    let duration = if let Some(start_time) = state.start_time {
        let total = start_time.elapsed();
        (total - state.paused_duration).as_secs_f64()
    } else {
        0.0
    };

    let file_path = state
        .file_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    // Stop recording and finalize the file
    // In a real implementation, we would:
    // 1. Stop the audio capture
    // 2. Flush and close the encoder
    // 3. Ensure the file is complete and valid

    // Reset state
    state.is_recording = false;
    state.is_paused = false;
    state.start_time = None;
    state.paused_duration = Duration::ZERO;
    state.audio_level = 0.0;

    Ok(RecordingResult {
        file_path,
        duration,
    })
}

/// Pause voice recording
#[tauri::command]
pub async fn pause_voice_recording(
    manager: State<'_, VoiceRecorderManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if !state.is_recording {
        return Err("No recording in progress".to_string());
    }

    if state.is_paused {
        return Err("Recording already paused".to_string());
    }

    state.is_paused = true;
    
    // In a real implementation, pause the audio capture

    Ok(())
}

/// Resume voice recording
#[tauri::command]
pub async fn resume_voice_recording(
    manager: State<'_, VoiceRecorderManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if !state.is_recording {
        return Err("No recording in progress".to_string());
    }

    if !state.is_paused {
        return Err("Recording not paused".to_string());
    }

    state.is_paused = false;
    
    // In a real implementation, resume the audio capture

    Ok(())
}

/// Cancel voice recording
#[tauri::command]
pub async fn cancel_voice_recording(
    manager: State<'_, VoiceRecorderManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    // Delete the temporary file if it exists
    if let Some(ref file_path) = state.file_path {
        let _ = std::fs::remove_file(file_path);
    }

    // Reset state
    state.is_recording = false;
    state.is_paused = false;
    state.start_time = None;
    state.paused_duration = Duration::ZERO;
    state.file_path = None;
    state.audio_level = 0.0;

    Ok(())
}

/// Get current audio level (0.0 to 1.0)
#[tauri::command]
pub async fn get_audio_level(
    manager: State<'_, VoiceRecorderManager>,
) -> Result<f32, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if !state.is_recording || state.is_paused {
        return Ok(0.0);
    }

    // In a real implementation, we would read the actual audio level
    // from the capture device. For now, simulate with random variation
    let base_level = 0.4;
    let variation = (rand::random::<f32>() - 0.5) * 0.3;
    let level = (base_level + variation).clamp(0.0, 1.0);

    Ok(level)
}

/// List available audio input devices
#[tauri::command]
pub async fn list_audio_input_devices() -> Result<Vec<AudioDevice>, String> {
    let mut devices = vec![
        AudioDevice {
            id: "default".to_string(),
            name: "Default Device".to_string(),
        },
    ];

    // In a real implementation, enumerate actual audio devices
    // using platform-specific APIs:
    // - macOS: Core Audio / AVFoundation
    // - Windows: WASAPI / MMDevice
    // - Linux: PulseAudio / PipeWire
    
    #[cfg(target_os = "macos")]
    {
        // Would use CoreAudio APIs to enumerate devices
        devices.push(AudioDevice {
            id: "built-in-mic".to_string(),
            name: "MacBook Pro Microphone".to_string(),
        });
    }
    
    #[cfg(target_os = "windows")]
    {
        // Would use WASAPI/MMDevice APIs
        devices.push(AudioDevice {
            id: "realtek-mic".to_string(),
            name: "Realtek High Definition Audio".to_string(),
        });
    }
    
    #[cfg(target_os = "linux")]
    {
        // Would use PulseAudio/PipeWire APIs
        devices.push(AudioDevice {
            id: "pulse-default".to_string(),
            name: "PulseAudio Default Source".to_string(),
        });
    }

    Ok(devices)
}

// Commands are registered via tauri::generate_handler! in main.rs

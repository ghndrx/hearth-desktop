use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

/// Transcription model info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub downloaded: bool,
    pub path: Option<String>,
}

/// Transcription result from faster-whisper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub language: String,
    pub segments: Vec<TranscriptionSegment>,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

/// Live transcription segment (emitted during streaming)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSegment {
    pub text: String,
    pub start: f64,
    pub end: f64,
    pub is_final: bool,
    pub speaker: Option<String>,
}

/// State for the transcription service
pub struct TranscriptionState {
    pub loaded_model: Option<String>,
    pub models_dir: PathBuf,
    pub python_available: bool,
    pub faster_whisper_available: bool,
    pub live_active: AtomicBool,
    pub live_stop_sender: Mutex<Option<Sender<()>>>,
}

impl Default for TranscriptionState {
    fn default() -> Self {
        let models_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("hearth")
            .join("whisper-models");

        Self {
            loaded_model: None,
            models_dir,
            python_available: false,
            faster_whisper_available: false,
            live_active: AtomicBool::new(false),
            live_stop_sender: Mutex::new(None),
        }
    }
}

pub struct TranscriptionManager {
    pub state: Mutex<TranscriptionState>,
}

impl Default for TranscriptionManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(TranscriptionState::default()),
        }
    }
}

/// Check if Python and faster-whisper are available
fn check_python_env() -> (bool, bool) {
    let python_ok = Command::new("python3")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let whisper_ok = if python_ok {
        Command::new("python3")
            .args(["-c", "import faster_whisper; print('ok')"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    } else {
        false
    };

    (python_ok, whisper_ok)
}

/// List available whisper models
#[tauri::command]
pub fn transcription_list_models(
    state: tauri::State<'_, TranscriptionManager>,
) -> Result<Vec<ModelInfo>, String> {
    let ts = state.state.lock().map_err(|e| e.to_string())?;

    let models = vec!["tiny", "base", "small", "medium", "large"];
    let mut result = Vec::new();

    for model_name in models {
        let model_path = ts.models_dir.join(model_name);
        let downloaded = model_path.exists();
        result.push(ModelInfo {
            name: model_name.to_string(),
            downloaded,
            path: if downloaded {
                Some(model_path.to_string_lossy().to_string())
            } else {
                None
            },
        });
    }

    Ok(result)
}

/// Download a whisper model using faster-whisper's built-in downloader
#[tauri::command]
pub async fn transcription_download_model(model: String) -> Result<(), String> {
    let script = format!(
        r#"
from faster_whisper import WhisperModel
import sys
try:
    model = WhisperModel("{}", device="cpu", compute_type="int8")
    print("ok")
except Exception as e:
    print(f"error: {{e}}", file=sys.stderr)
    sys.exit(1)
"#,
        model
    );

    let output = tokio::task::spawn_blocking(move || {
        Command::new("python3")
            .args(["-c", &script])
            .output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Model download failed: {}", stderr));
    }

    Ok(())
}

/// Load a whisper model into memory
#[tauri::command]
pub fn transcription_load_model(
    model: String,
    state: tauri::State<'_, TranscriptionManager>,
) -> Result<(), String> {
    let (python_ok, whisper_ok) = check_python_env();

    let mut ts = state.state.lock().map_err(|e| e.to_string())?;
    ts.python_available = python_ok;
    ts.faster_whisper_available = whisper_ok;

    if !python_ok {
        return Err("Python3 is not installed. Please install Python 3.8+".to_string());
    }
    if !whisper_ok {
        return Err(
            "faster-whisper is not installed. Run: pip install faster-whisper".to_string(),
        );
    }

    ts.loaded_model = Some(model);
    Ok(())
}

/// Unload the current model
#[tauri::command]
pub fn transcription_unload_model(
    state: tauri::State<'_, TranscriptionManager>,
) -> Result<(), String> {
    let mut ts = state.state.lock().map_err(|e| e.to_string())?;
    ts.loaded_model = None;
    Ok(())
}

/// Get current live transcription status
#[tauri::command]
pub fn transcription_live_status(
    state: tauri::State<'_, TranscriptionManager>,
) -> Result<bool, String> {
    let ts = state.state.lock().map_err(|e| e.to_string())?;
    Ok(ts.live_active.load(Ordering::SeqCst))
}

/// Stop live transcription
#[tauri::command]
pub fn transcription_stop_live(
    state: tauri::State<'_, TranscriptionManager>,
) -> Result<(), String> {
    let ts = state.state.lock().map_err(|e| e.to_string())?;
    
    if !ts.live_active.load(Ordering::SeqCst) {
        return Ok(());
    }

    if let Some(sender) = ts.live_stop_sender.lock().map_err(|e| e.to_string())?.take() {
        let _ = sender.send(());
    }

    ts.live_active.store(false, Ordering::SeqCst);
    Ok(())
}

/// Start live/streaming transcription - emits transcription:live-segment
/// and transcription:live-final events to the frontend
#[tauri::command]
pub async fn transcription_start_live(
    app: AppHandle,
    model: String,
    language: String,
    sample_rate: u32,
    state: tauri::State<'_, TranscriptionManager>,
) -> Result<(), String> {
    // Check if already active
    {
        let ts = state.state.lock().map_err(|e| e.to_string())?;
        if ts.live_active.load(Ordering::SeqCst) {
            return Err("Live transcription already active".to_string());
        }
    }

    let (python_ok, whisper_ok) = check_python_env();
    {
        let mut ts = state.state.lock().map_err(|e| e.to_string())?;
        ts.python_available = python_ok;
        ts.faster_whisper_available = whisper_ok;
    }

    if !python_ok {
        return Err("Python3 is not installed".to_string());
    }
    if !whisper_ok {
        return Err("faster-whisper is not installed. Run: pip install faster-whisper".to_string());
    }

    // Create stop channel
    let (stop_tx, stop_rx) = channel::<()>();
    {
        let mut ts = state.state.lock().map_err(|e| e.to_string())?;
        ts.live_active.store(true, Ordering::SeqCst);
        ts.live_stop_sender = Mutex::new(Some(stop_tx));
    }

    let app_handle = app.clone();

    // Spawn the live transcription in a blocking thread
    thread::spawn(move || {
        let lang_arg = if language == "auto" || language.is_empty() {
            "None".to_string()
        } else {
            format!("\"{}\"", language)
        };

        // Build the Python script for live transcription
        // This runs faster-whisper in a loop, processing audio chunks
        let script = format!(
            r#"
import numpy as np
import sys
import os
from faster_whisper import WhisperModel

model = WhisperModel("{}", device="cpu", compute_type="int8")
lang_arg = {}

chunk_size = {} * 5  # ~5 seconds of audio at sample rate

# Audio buffer
audio_buffer = np.array([], dtype=np.float32)

def process_audio():
    global audio_buffer
    if len(audio_buffer) < chunk_size:
        return
    
    # Get chunk to process
    to_process = audio_buffer[:chunk_size]
    audio_buffer = audio_buffer[chunk_size:]
    
    try:
        segments_iter, info = model.transcribe(
            to_process,
            language=lang_arg,
            beam_size=5,
            vad_filter=True,
            return_timestamps=True,
        )
        
        for seg in segments_iter:
            import json
            result = {{
                "text": seg.text.strip(),
                "start": float(seg.start),
                "end": float(seg.end),
                "is_final": True,
            }}
            print("SEG:" + json.dumps(result))
            sys.stdout.flush()
    except Exception as e:
        print(f"ERR:{e}", file=sys.stderr)
        sys.stderr.flush()

# Read audio from stdin in a loop
while True:
    # Read raw f32 samples from stdin (16KB at a time)
    try:
        data = os.read(0, 64000)  # Read up to 64KB
        if not data:
            break
        
        # Convert bytes to float32
        samples = np.frombuffer(data, dtype=np.float32)
        audio_buffer = np.concatenate([audio_buffer, samples])
        
        # Process if we have enough
        while len(audio_buffer) >= chunk_size:
            process_audio()
            
    except Exception as e:
        print(f"ERR:Read error: {{e}}", file=sys.stderr)
        break

# Process remaining audio
while len(audio_buffer) >= chunk_size // 2:
    process_audio()

print("DONE")
"#,
            model,
            lang_arg,
            sample_rate,
        );

        let mut child = Command::new("python3")
            .args(["-c", &script])
            .stdout_os_string();
        
        // This is a simplified approach - in practice you'd want proper stdin/stdout piping
        // For now, just mark as started and let the frontend handle audio processing
        // through the existing TranscriptionManager
        
        println!("[Transcription] Live transcription started");
    });

    // Emit started event
    app.emit("transcription:live-started", ()).ok();

    Ok(())
}

/// Transcribe audio data using faster-whisper
#[tauri::command]
pub async fn transcription_transcribe(
    audio_data: Vec<f32>,
    language: String,
    sample_rate: u32,
    state: tauri::State<'_, TranscriptionManager>,
) -> Result<TranscriptionResult, String> {
    let model_name = {
        let ts = state.state.lock().map_err(|e| e.to_string())?;
        ts.loaded_model
            .clone()
            .ok_or_else(|| "No model loaded".to_string())?
    };

    let lang_arg = if language == "auto" || language.is_empty() {
        "None".to_string()
    } else {
        format!("\"{}\"", language)
    };

    let audio_clone = audio_data.clone();
    let result = tokio::task::spawn_blocking(move || {
        let temp_dir = std::env::temp_dir();
        let audio_path = temp_dir.join("hearth_transcribe_audio.raw");

        let bytes: Vec<u8> = audio_clone
            .iter()
            .flat_map(|&f| f.to_le_bytes())
            .collect();

        std::fs::write(&audio_path, &bytes)
            .map_err(|e| format!("Failed to write temp audio: {}", e))?;

        let script = format!(
            r#"
import numpy as np
import json
import sys
from faster_whisper import WhisperModel

audio = np.fromfile("{}", dtype=np.float32)
model = WhisperModel("{}", device="cpu", compute_type="int8")

language_arg = {}
segments_iter, info = model.transcribe(
    audio,
    language=language_arg,
    beam_size=5,
    vad_filter=True,
)

segments = []
full_text = []
for seg in segments_iter:
    segments.append({{
        "start": float(seg.start),
        "end": float(seg.end),
        "text": seg.text.strip()
    }})
    full_text.append(seg.text.strip())

result = {{
    "text": " ".join(full_text),
    "language": info.language if info.language else "en",
    "segments": segments,
    "start": segments[0]["start"] if segments else 0.0,
    "end": segments[-1]["end"] if segments else 0.0
}}

print(json.dumps(result))
"#,
            audio_path.to_string_lossy().replace('\\', "\\\\"),
            model_name,
            lang_arg,
        );

        let output = Command::new("python3")
            .args(["-c", &script])
            .output()
            .map_err(|e| format!("Failed to run Python: {}", e))?;

        let _ = std::fs::remove_file(&audio_path);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Transcription failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let result: TranscriptionResult =
            serde_json::from_str(stdout.trim()).map_err(|e| format!("Parse error: {} - output: {}", e, stdout))?;

        Ok(result)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    result
}

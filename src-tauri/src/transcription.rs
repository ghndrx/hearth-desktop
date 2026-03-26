use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

/// State for the transcription service
pub struct TranscriptionState {
    pub loaded_model: Option<String>,
    pub models_dir: PathBuf,
    pub python_available: bool,
    pub faster_whisper_available: bool,
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
    // faster-whisper downloads models automatically on first load,
    // but we can pre-download by importing the model
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

    let lang_arg = if language == "auto" {
        "None".to_string()
    } else {
        format!("\"{}\"", language)
    };

    // Write audio data to a temp file as raw PCM, then transcribe with Python
    let audio_clone = audio_data.clone();
    let result = tokio::task::spawn_blocking(move || {
        // Create temp file with audio data
        let temp_dir = std::env::temp_dir();
        let audio_path = temp_dir.join("hearth_transcribe_audio.raw");

        // Write f32 samples as bytes
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

# Load audio from raw PCM float32
audio = np.fromfile("{audio_path}", dtype=np.float32)

# Initialize model
model = WhisperModel("{model}", device="cpu", compute_type="int8")

# Transcribe
language = {lang}
segments_iter, info = model.transcribe(
    audio,
    language=language,
    beam_size=5,
    vad_filter=True,
)

segments = []
full_text = []
for seg in segments_iter:
    segments.append({{
        "start": seg.start,
        "end": seg.end,
        "text": seg.text.strip()
    }})
    full_text.append(seg.text.strip())

result = {{
    "text": " ".join(full_text),
    "language": info.language if info.language else "en",
    "segments": segments
}}

print(json.dumps(result))
"#,
            audio_path = audio_path.to_string_lossy().replace('\\', "\\\\"),
            model = model_name,
            lang = lang_arg,
        );

        let output = Command::new("python3")
            .args(["-c", &script])
            .output()
            .map_err(|e| format!("Failed to run Python: {}", e))?;

        // Clean up temp file
        let _ = std::fs::remove_file(&audio_path);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Transcription failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let result: TranscriptionResult =
            serde_json::from_str(stdout.trim()).map_err(|e| format!("Parse error: {}", e))?;

        Ok(result)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    result
}

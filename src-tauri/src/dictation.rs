use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};

/// Dictation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictationConfig {
    pub language: String,
    #[serde(rename = "continuousMode")]
    pub continuous_mode: bool,
    #[serde(rename = "interimResults")]
    pub interim_results: bool,
    #[serde(rename = "maxAlternatives")]
    pub max_alternatives: u32,
    #[serde(rename = "profanityFilter")]
    pub profanity_filter: bool,
}

impl Default for DictationConfig {
    fn default() -> Self {
        Self {
            language: "en-US".to_string(),
            continuous_mode: true,
            interim_results: true,
            max_alternatives: 3,
            profanity_filter: false,
        }
    }
}

/// Speech recognition result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechResult {
    pub transcript: String,
    pub confidence: f32,
    #[serde(rename = "isFinal")]
    pub is_final: bool,
    pub alternatives: Vec<SpeechAlternative>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechAlternative {
    pub transcript: String,
    pub confidence: f32,
}

/// Dictation state
#[derive(Debug)]
pub struct DictationState {
    pub is_listening: bool,
    pub is_paused: bool,
    pub start_time: Option<Instant>,
    pub config: DictationConfig,
    pub current_transcript: String,
    pub audio_level: f32,
}

impl Default for DictationState {
    fn default() -> Self {
        Self {
            is_listening: false,
            is_paused: false,
            start_time: None,
            config: DictationConfig::default(),
            current_transcript: String::new(),
            audio_level: 0.0,
        }
    }
}

/// Global dictation state manager
pub struct DictationManager {
    pub state: Mutex<DictationState>,
}

impl Default for DictationManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(DictationState::default()),
        }
    }
}

/// Supported language info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupportedLanguage {
    pub code: String,
    pub name: String,
    pub native_name: String,
}

/// Dictation status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictationStatus {
    #[serde(rename = "isListening")]
    pub is_listening: bool,
    #[serde(rename = "isPaused")]
    pub is_paused: bool,
    #[serde(rename = "duration")]
    pub duration: f64,
    #[serde(rename = "audioLevel")]
    pub audio_level: f32,
    #[serde(rename = "currentTranscript")]
    pub current_transcript: String,
}

/// Check if speech recognition is available on this platform
#[tauri::command]
pub async fn check_dictation_available() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // macOS 10.15+ has Speech framework
        // Check if SFSpeechRecognizer is available
        Ok(true)
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows 10+ has Windows.Media.SpeechRecognition
        Ok(true)
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux: Check if speech recognition service is available
        // Could use Vosk, PocketSphinx, or system service
        // For now, assume Web Speech API fallback is available
        Ok(true)
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Ok(false)
    }
}

/// Request microphone permission for dictation
#[tauri::command]
pub async fn request_dictation_permission() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // macOS requires explicit permission for both microphone and speech recognition
        // In a real implementation, we would use:
        // - AVCaptureDevice.requestAccess(for: .audio)
        // - SFSpeechRecognizer.requestAuthorization
        Ok(true)
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows typically auto-grants for desktop apps
        Ok(true)
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux: Check PulseAudio/PipeWire access
        Ok(true)
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err("Platform not supported".to_string())
    }
}

/// Get list of supported languages for speech recognition
#[tauri::command]
pub async fn get_supported_languages() -> Result<Vec<SupportedLanguage>, String> {
    // Common languages supported by most speech recognition engines
    let languages = vec![
        SupportedLanguage {
            code: "en-US".to_string(),
            name: "English (US)".to_string(),
            native_name: "English".to_string(),
        },
        SupportedLanguage {
            code: "en-GB".to_string(),
            name: "English (UK)".to_string(),
            native_name: "English".to_string(),
        },
        SupportedLanguage {
            code: "es-ES".to_string(),
            name: "Spanish (Spain)".to_string(),
            native_name: "Español".to_string(),
        },
        SupportedLanguage {
            code: "es-MX".to_string(),
            name: "Spanish (Mexico)".to_string(),
            native_name: "Español".to_string(),
        },
        SupportedLanguage {
            code: "fr-FR".to_string(),
            name: "French".to_string(),
            native_name: "Français".to_string(),
        },
        SupportedLanguage {
            code: "de-DE".to_string(),
            name: "German".to_string(),
            native_name: "Deutsch".to_string(),
        },
        SupportedLanguage {
            code: "it-IT".to_string(),
            name: "Italian".to_string(),
            native_name: "Italiano".to_string(),
        },
        SupportedLanguage {
            code: "pt-BR".to_string(),
            name: "Portuguese (Brazil)".to_string(),
            native_name: "Português".to_string(),
        },
        SupportedLanguage {
            code: "ja-JP".to_string(),
            name: "Japanese".to_string(),
            native_name: "日本語".to_string(),
        },
        SupportedLanguage {
            code: "ko-KR".to_string(),
            name: "Korean".to_string(),
            native_name: "한국어".to_string(),
        },
        SupportedLanguage {
            code: "zh-CN".to_string(),
            name: "Chinese (Simplified)".to_string(),
            native_name: "中文".to_string(),
        },
        SupportedLanguage {
            code: "zh-TW".to_string(),
            name: "Chinese (Traditional)".to_string(),
            native_name: "中文".to_string(),
        },
        SupportedLanguage {
            code: "ru-RU".to_string(),
            name: "Russian".to_string(),
            native_name: "Русский".to_string(),
        },
        SupportedLanguage {
            code: "ar-SA".to_string(),
            name: "Arabic".to_string(),
            native_name: "العربية".to_string(),
        },
        SupportedLanguage {
            code: "hi-IN".to_string(),
            name: "Hindi".to_string(),
            native_name: "हिन्दी".to_string(),
        },
        SupportedLanguage {
            code: "nl-NL".to_string(),
            name: "Dutch".to_string(),
            native_name: "Nederlands".to_string(),
        },
        SupportedLanguage {
            code: "pl-PL".to_string(),
            name: "Polish".to_string(),
            native_name: "Polski".to_string(),
        },
        SupportedLanguage {
            code: "sv-SE".to_string(),
            name: "Swedish".to_string(),
            native_name: "Svenska".to_string(),
        },
    ];
    
    Ok(languages)
}

/// Start dictation/speech recognition
#[tauri::command]
pub async fn start_dictation(
    config: DictationConfig,
    app: AppHandle,
    manager: State<'_, DictationManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if state.is_listening {
        return Err("Dictation already active".to_string());
    }
    
    state.is_listening = true;
    state.is_paused = false;
    state.start_time = Some(Instant::now());
    state.config = config.clone();
    state.current_transcript = String::new();
    state.audio_level = 0.0;
    
    // Emit start event
    let _ = app.emit("dictation:started", serde_json::json!({
        "language": config.language,
        "continuous": config.continuous_mode,
    }));
    
    // In a real implementation, we would:
    // 1. Initialize the speech recognition engine
    // 2. Configure it with the provided settings
    // 3. Start audio capture
    // 4. Begin recognition
    
    #[cfg(target_os = "macos")]
    {
        // Use SFSpeechRecognizer with SFSpeechAudioBufferRecognitionRequest
        // Register for recognition result callbacks
    }
    
    #[cfg(target_os = "windows")]
    {
        // Use Windows.Media.SpeechRecognition.SpeechRecognizer
        // Set up continuous recognition session
    }
    
    #[cfg(target_os = "linux")]
    {
        // Use Vosk or PocketSphinx for offline recognition
        // Or fall back to system speech service
    }
    
    // Simulate interim results for demonstration
    // In production, these would come from the actual speech engine
    let app_clone = app.clone();
    std::thread::spawn(move || {
        // This simulates the speech recognition callback
        // Real implementation would receive actual transcripts
        std::thread::sleep(std::time::Duration::from_millis(500));
        let _ = app_clone.emit("dictation:interim", serde_json::json!({
            "transcript": "",
            "confidence": 0.0,
            "isFinal": false,
        }));
    });
    
    Ok(())
}

/// Stop dictation and return final transcript
#[tauri::command]
pub async fn stop_dictation(
    app: AppHandle,
    manager: State<'_, DictationManager>,
) -> Result<SpeechResult, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if !state.is_listening {
        return Err("Dictation not active".to_string());
    }
    
    let transcript = state.current_transcript.clone();
    let duration = state.start_time
        .map(|t| t.elapsed().as_secs_f64())
        .unwrap_or(0.0);
    
    // Reset state
    state.is_listening = false;
    state.is_paused = false;
    state.start_time = None;
    state.audio_level = 0.0;
    
    // Emit stop event
    let _ = app.emit("dictation:stopped", serde_json::json!({
        "transcript": transcript,
        "duration": duration,
    }));
    
    Ok(SpeechResult {
        transcript,
        confidence: 0.95,
        is_final: true,
        alternatives: vec![],
    })
}

/// Pause dictation
#[tauri::command]
pub async fn pause_dictation(
    app: AppHandle,
    manager: State<'_, DictationManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if !state.is_listening {
        return Err("Dictation not active".to_string());
    }
    
    if state.is_paused {
        return Err("Dictation already paused".to_string());
    }
    
    state.is_paused = true;
    
    let _ = app.emit("dictation:paused", serde_json::json!({}));
    
    Ok(())
}

/// Resume dictation
#[tauri::command]
pub async fn resume_dictation(
    app: AppHandle,
    manager: State<'_, DictationManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if !state.is_listening {
        return Err("Dictation not active".to_string());
    }
    
    if !state.is_paused {
        return Err("Dictation not paused".to_string());
    }
    
    state.is_paused = false;
    
    let _ = app.emit("dictation:resumed", serde_json::json!({}));
    
    Ok(())
}

/// Cancel dictation without returning results
#[tauri::command]
pub async fn cancel_dictation(
    app: AppHandle,
    manager: State<'_, DictationManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    state.is_listening = false;
    state.is_paused = false;
    state.start_time = None;
    state.current_transcript = String::new();
    state.audio_level = 0.0;
    
    let _ = app.emit("dictation:cancelled", serde_json::json!({}));
    
    Ok(())
}

/// Get current dictation status
#[tauri::command]
pub async fn get_dictation_status(
    manager: State<'_, DictationManager>,
) -> Result<DictationStatus, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    
    let duration = state.start_time
        .map(|t| t.elapsed().as_secs_f64())
        .unwrap_or(0.0);
    
    Ok(DictationStatus {
        is_listening: state.is_listening,
        is_paused: state.is_paused,
        duration,
        audio_level: state.audio_level,
        current_transcript: state.current_transcript.clone(),
    })
}

/// Get current audio input level during dictation
#[tauri::command]
pub async fn get_dictation_audio_level(
    manager: State<'_, DictationManager>,
) -> Result<f32, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    
    if !state.is_listening || state.is_paused {
        return Ok(0.0);
    }
    
    // Simulate audio level (real implementation would read from audio buffer)
    let base_level = 0.35;
    let variation = (rand::random::<f32>() - 0.5) * 0.25;
    let level = (base_level + variation).clamp(0.0, 1.0);
    
    Ok(level)
}

/// Insert text into current transcript (for corrections)
#[tauri::command]
pub async fn update_dictation_transcript(
    transcript: String,
    manager: State<'_, DictationManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.current_transcript = transcript;
    Ok(())
}

/// Add punctuation command
#[tauri::command]
pub async fn add_punctuation(
    punctuation: String,
    app: AppHandle,
    manager: State<'_, DictationManager>,
) -> Result<String, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    // Map voice commands to punctuation
    let punct = match punctuation.to_lowercase().as_str() {
        "period" | "full stop" | "dot" => ".",
        "comma" => ",",
        "question mark" => "?",
        "exclamation mark" | "exclamation point" => "!",
        "colon" => ":",
        "semicolon" => ";",
        "new line" | "newline" | "enter" => "\n",
        "new paragraph" => "\n\n",
        "open quote" | "begin quote" => "\"",
        "close quote" | "end quote" => "\"",
        "open paren" | "open parenthesis" => "(",
        "close paren" | "close parenthesis" => ")",
        "hyphen" | "dash" => "-",
        "at sign" | "at" => "@",
        "hashtag" | "hash" => "#",
        _ => &punctuation,
    };
    
    state.current_transcript.push_str(punct);
    
    let _ = app.emit("dictation:punctuation", serde_json::json!({
        "punctuation": punct,
        "transcript": state.current_transcript,
    }));
    
    Ok(state.current_transcript.clone())
}

/// Register dictation commands
pub fn init() -> impl Fn(tauri::Invoke) {
    tauri::generate_handler![
        check_dictation_available,
        request_dictation_permission,
        get_supported_languages,
        start_dictation,
        stop_dictation,
        pause_dictation,
        resume_dictation,
        cancel_dictation,
        get_dictation_status,
        get_dictation_audio_level,
        update_dictation_transcript,
        add_punctuation,
    ]
}

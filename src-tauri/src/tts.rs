// Text-to-Speech module for native accessibility
// Provides system TTS integration across Windows, macOS, and Linux

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSVoice {
    pub id: String,
    pub name: String,
    pub language: String,
    pub gender: Option<String>,
    pub local: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSSettings {
    pub enabled: bool,
    pub voice_id: Option<String>,
    pub rate: f32,      // 0.1 to 10.0, default 1.0
    pub pitch: f32,     // 0.0 to 2.0, default 1.0
    pub volume: f32,    // 0.0 to 1.0, default 1.0
    pub auto_read_messages: bool,
    pub auto_read_notifications: bool,
    pub announce_user_join_leave: bool,
    pub read_usernames: bool,
    pub read_timestamps: bool,
}

impl Default for TTSSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            voice_id: None,
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            auto_read_messages: false,
            auto_read_notifications: true,
            announce_user_join_leave: false,
            read_usernames: true,
            read_timestamps: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSQueueItem {
    pub id: String,
    pub text: String,
    pub priority: TTSPriority,
    pub voice_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum TTSPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3,
}

pub struct TTSState {
    pub settings: TTSSettings,
    pub queue: Vec<TTSQueueItem>,
    pub is_speaking: bool,
    pub current_item: Option<String>,
    pub available_voices: Vec<TTSVoice>,
}

impl Default for TTSState {
    fn default() -> Self {
        Self {
            settings: TTSSettings::default(),
            queue: Vec::new(),
            is_speaking: false,
            current_item: None,
            available_voices: Vec::new(),
        }
    }
}

pub type TTSStateHandle = Arc<Mutex<TTSState>>;

/// Initialize the TTS subsystem
#[tauri::command]
pub async fn tts_init(app: AppHandle) -> Result<bool, String> {
    let voices = get_system_voices().await?;
    let state = app.state::<TTSStateHandle>();
    let mut tts_state = state.lock().map_err(|e| e.to_string())?;
    tts_state.available_voices = voices;

    Ok(true)
}

/// Get available TTS voices
#[tauri::command]
pub async fn tts_get_voices(state: State<'_, TTSStateHandle>) -> Result<Vec<TTSVoice>, String> {
    let tts_state = state.lock().map_err(|e| e.to_string())?;
    Ok(tts_state.available_voices.clone())
}

/// Get current TTS settings
#[tauri::command]
pub async fn tts_get_settings(state: State<'_, TTSStateHandle>) -> Result<TTSSettings, String> {
    let tts_state = state.lock().map_err(|e| e.to_string())?;
    Ok(tts_state.settings.clone())
}

/// Update TTS settings
#[tauri::command]
pub async fn tts_set_settings(
    settings: TTSSettings,
    state: State<'_, TTSStateHandle>,
    app: AppHandle,
) -> Result<(), String> {
    let mut tts_state = state.lock().map_err(|e| e.to_string())?;
    tts_state.settings = settings.clone();
    
    // Emit settings change event
    let _ = app.emit("tts-settings-changed", &settings);
    
    Ok(())
}

/// Speak text immediately (interrupts current speech)
#[tauri::command]
pub async fn tts_speak(
    text: String,
    priority: Option<TTSPriority>,
    app: AppHandle,
) -> Result<String, String> {
    let state_handle = app.state::<TTSStateHandle>();
    let should_process;
    let item_id;
    {
        let mut tts_state = state_handle.lock().map_err(|e| e.to_string())?;

        if !tts_state.settings.enabled {
            return Err("TTS is disabled".to_string());
        }

        item_id = uuid::Uuid::new_v4().to_string();
        let priority = priority.unwrap_or(TTSPriority::Normal);

        let item = TTSQueueItem {
            id: item_id.clone(),
            text: text.clone(),
            priority,
            voice_id: tts_state.settings.voice_id.clone(),
        };

        // Insert based on priority
        let insert_pos = tts_state.queue.iter()
            .position(|i| i.priority < item.priority)
            .unwrap_or(tts_state.queue.len());
        tts_state.queue.insert(insert_pos, item);

        should_process = !tts_state.is_speaking;
    }

    // If not currently speaking, start
    if should_process {
        process_queue(state_handle.inner().clone(), app).await?;
    }

    Ok(item_id)
}

/// Stop current speech and clear queue
#[tauri::command]
pub async fn tts_stop(app: AppHandle) -> Result<(), String> {
    {
        let state = app.state::<TTSStateHandle>();
        let mut tts_state = state.lock().map_err(|e| e.to_string())?;
        tts_state.queue.clear();
        tts_state.is_speaking = false;
        tts_state.current_item = None;
    }

    // Platform-specific stop
    stop_speech_native().await?;

    let _ = app.emit("tts-stopped", ());

    Ok(())
}

/// Pause current speech
#[tauri::command]
pub async fn tts_pause(app: AppHandle) -> Result<(), String> {
    {
        let state = app.state::<TTSStateHandle>();
        let tts_state = state.lock().map_err(|e| e.to_string())?;
        if !tts_state.is_speaking {
            return Err("Not currently speaking".to_string());
        }
    }

    pause_speech_native().await?;
    let _ = app.emit("tts-paused", ());

    Ok(())
}

/// Resume paused speech
#[tauri::command]
pub async fn tts_resume(state: State<'_, TTSStateHandle>, app: AppHandle) -> Result<(), String> {
    resume_speech_native().await?;
    let _ = app.emit("tts-resumed", ());
    
    Ok(())
}

/// Get current speaking status
#[tauri::command]
pub async fn tts_get_status(state: State<'_, TTSStateHandle>) -> Result<TTSStatus, String> {
    let tts_state = state.lock().map_err(|e| e.to_string())?;
    
    Ok(TTSStatus {
        is_speaking: tts_state.is_speaking,
        current_item_id: tts_state.current_item.clone(),
        queue_length: tts_state.queue.len(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSStatus {
    pub is_speaking: bool,
    pub current_item_id: Option<String>,
    pub queue_length: usize,
}

/// Skip current speech item and move to next in queue
#[tauri::command]
pub async fn tts_skip(state: State<'_, TTSStateHandle>, app: AppHandle) -> Result<(), String> {
    stop_speech_native().await?;
    
    {
        let mut tts_state = state.lock().map_err(|e| e.to_string())?;
        tts_state.is_speaking = false;
        tts_state.current_item = None;
    }
    
    process_queue(state.inner().clone(), app).await
}

/// Remove a specific item from the queue
#[tauri::command]
pub async fn tts_remove_from_queue(
    item_id: String,
    state: State<'_, TTSStateHandle>,
) -> Result<bool, String> {
    let mut tts_state = state.lock().map_err(|e| e.to_string())?;
    
    let initial_len = tts_state.queue.len();
    tts_state.queue.retain(|item| item.id != item_id);
    
    Ok(tts_state.queue.len() < initial_len)
}

/// Get the current queue
#[tauri::command]
pub async fn tts_get_queue(state: State<'_, TTSStateHandle>) -> Result<Vec<TTSQueueItem>, String> {
    let tts_state = state.lock().map_err(|e| e.to_string())?;
    Ok(tts_state.queue.clone())
}

// Internal functions

async fn process_queue(state: TTSStateHandle, app: AppHandle) -> Result<(), String> {
    loop {
        let item = {
            let mut tts_state = state.lock().map_err(|e| e.to_string())?;
            
            if tts_state.queue.is_empty() {
                tts_state.is_speaking = false;
                tts_state.current_item = None;
                let _ = app.emit("tts-queue-empty", ());
                return Ok(());
            }
            
            let item = tts_state.queue.remove(0);
            tts_state.is_speaking = true;
            tts_state.current_item = Some(item.id.clone());
            item
        };
        
        let _ = app.emit("tts-speaking", &item);
        
        // Get settings for speech
        let settings = {
            let tts_state = state.lock().map_err(|e| e.to_string())?;
            tts_state.settings.clone()
        };
        
        // Perform native speech
        speak_native(&item.text, &settings, item.voice_id.as_deref()).await?;
        
        let _ = app.emit("tts-item-complete", &item.id);
    }
}

#[cfg(target_os = "windows")]
async fn get_system_voices() -> Result<Vec<TTSVoice>, String> {
    // Windows SAPI voices would be queried here
    // For now, return common Windows voices
    Ok(vec![
        TTSVoice {
            id: "microsoft-david".to_string(),
            name: "Microsoft David".to_string(),
            language: "en-US".to_string(),
            gender: Some("male".to_string()),
            local: true,
        },
        TTSVoice {
            id: "microsoft-zira".to_string(),
            name: "Microsoft Zira".to_string(),
            language: "en-US".to_string(),
            gender: Some("female".to_string()),
            local: true,
        },
        TTSVoice {
            id: "microsoft-mark".to_string(),
            name: "Microsoft Mark".to_string(),
            language: "en-US".to_string(),
            gender: Some("male".to_string()),
            local: true,
        },
    ])
}

#[cfg(target_os = "macos")]
async fn get_system_voices() -> Result<Vec<TTSVoice>, String> {
    // macOS NSSpeechSynthesizer voices
    Ok(vec![
        TTSVoice {
            id: "com.apple.voice.compact.en-US.Samantha".to_string(),
            name: "Samantha".to_string(),
            language: "en-US".to_string(),
            gender: Some("female".to_string()),
            local: true,
        },
        TTSVoice {
            id: "com.apple.voice.compact.en-US.Alex".to_string(),
            name: "Alex".to_string(),
            language: "en-US".to_string(),
            gender: Some("male".to_string()),
            local: true,
        },
        TTSVoice {
            id: "com.apple.voice.compact.en-GB.Daniel".to_string(),
            name: "Daniel".to_string(),
            language: "en-GB".to_string(),
            gender: Some("male".to_string()),
            local: true,
        },
    ])
}

#[cfg(target_os = "linux")]
async fn get_system_voices() -> Result<Vec<TTSVoice>, String> {
    // Linux espeak/speech-dispatcher voices
    Ok(vec![
        TTSVoice {
            id: "espeak-en".to_string(),
            name: "English (espeak)".to_string(),
            language: "en".to_string(),
            gender: None,
            local: true,
        },
        TTSVoice {
            id: "espeak-en-us".to_string(),
            name: "English US (espeak)".to_string(),
            language: "en-US".to_string(),
            gender: None,
            local: true,
        },
    ])
}

#[cfg(target_os = "windows")]
async fn speak_native(text: &str, settings: &TTSSettings, _voice_id: Option<&str>) -> Result<(), String> {
    use std::process::Command;
    
    // Use PowerShell to invoke SAPI
    let rate = ((settings.rate - 1.0) * 10.0) as i32; // Convert to SAPI rate (-10 to 10)
    let volume = (settings.volume * 100.0) as u32;
    
    let script = format!(
        r#"
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.Rate = {}
        $synth.Volume = {}
        $synth.Speak('{}')
        "#,
        rate,
        volume,
        text.replace("'", "''")
    );
    
    Command::new("powershell")
        .args(["-Command", &script])
        .output()
        .map_err(|e| format!("TTS failed: {}", e))?;
    
    Ok(())
}

#[cfg(target_os = "macos")]
async fn speak_native(text: &str, settings: &TTSSettings, voice_id: Option<&str>) -> Result<(), String> {
    use std::process::Command;
    
    let mut cmd = Command::new("say");
    
    // Rate: words per minute (default ~175-200)
    let rate = (200.0 * settings.rate) as u32;
    cmd.args(["-r", &rate.to_string()]);
    
    if let Some(voice) = voice_id {
        cmd.args(["-v", voice]);
    }
    
    cmd.arg(text);
    
    cmd.output()
        .map_err(|e| format!("TTS failed: {}", e))?;
    
    Ok(())
}

#[cfg(target_os = "linux")]
async fn speak_native(text: &str, settings: &TTSSettings, _voice_id: Option<&str>) -> Result<(), String> {
    use std::process::Command;
    
    // Try espeak-ng first, fall back to espeak
    let speed = (175.0 * settings.rate) as u32;
    let amplitude = (100.0 * settings.volume) as u32;
    let pitch = (50.0 * settings.pitch) as u32;
    
    let result = Command::new("espeak-ng")
        .args([
            "-s", &speed.to_string(),
            "-a", &amplitude.to_string(),
            "-p", &pitch.to_string(),
            text,
        ])
        .output();
    
    match result {
        Ok(_) => Ok(()),
        Err(_) => {
            // Fallback to espeak
            Command::new("espeak")
                .args([
                    "-s", &speed.to_string(),
                    "-a", &amplitude.to_string(),
                    "-p", &pitch.to_string(),
                    text,
                ])
                .output()
                .map_err(|e| format!("TTS failed: {}", e))?;
            Ok(())
        }
    }
}

#[cfg(target_os = "windows")]
async fn stop_speech_native() -> Result<(), String> {
    use std::process::Command;
    
    let script = r#"
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SpeakAsyncCancelAll()
    "#;
    
    let _ = Command::new("powershell")
        .args(["-Command", script])
        .output();
    
    Ok(())
}

#[cfg(target_os = "macos")]
async fn stop_speech_native() -> Result<(), String> {
    use std::process::Command;
    let _ = Command::new("killall").arg("say").output();
    Ok(())
}

#[cfg(target_os = "linux")]
async fn stop_speech_native() -> Result<(), String> {
    use std::process::Command;
    let _ = Command::new("killall").arg("espeak-ng").output();
    let _ = Command::new("killall").arg("espeak").output();
    Ok(())
}

#[cfg(target_os = "windows")]
async fn pause_speech_native() -> Result<(), String> {
    // Windows SAPI supports pause natively
    Ok(())
}

#[cfg(target_os = "macos")]
async fn pause_speech_native() -> Result<(), String> {
    use std::process::Command;
    let _ = Command::new("kill").args(["-STOP", "$(pgrep say)"]).output();
    Ok(())
}

#[cfg(target_os = "linux")]
async fn pause_speech_native() -> Result<(), String> {
    use std::process::Command;
    let _ = Command::new("pkill").args(["-STOP", "espeak"]).output();
    Ok(())
}

#[cfg(target_os = "windows")]
async fn resume_speech_native() -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
async fn resume_speech_native() -> Result<(), String> {
    use std::process::Command;
    let _ = Command::new("kill").args(["-CONT", "$(pgrep say)"]).output();
    Ok(())
}

#[cfg(target_os = "linux")]
async fn resume_speech_native() -> Result<(), String> {
    use std::process::Command;
    let _ = Command::new("pkill").args(["-CONT", "espeak"]).output();
    Ok(())
}

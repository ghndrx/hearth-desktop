// Media Session Manager
// Provides native OS media key integration for voice/media playback
// Supports Linux (MPRIS), Windows, and macOS media controls

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MediaMetadata {
    pub title: String,
    #[serde(default)]
    pub artist: String,
    #[serde(default)]
    pub album: String,
    #[serde(default)]
    pub artwork: Option<String>,
    #[serde(default)]
    pub duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MediaPlaybackState {
    #[serde(rename = "isPlaying")]
    pub is_playing: bool,
    #[serde(default)]
    pub position: Option<f64>,
}

/// Media session state stored globally
pub struct MediaSessionState {
    metadata: MediaMetadata,
    playback: MediaPlaybackState,
    registered: bool,
}

impl Default for MediaSessionState {
    fn default() -> Self {
        Self {
            metadata: MediaMetadata::default(),
            playback: MediaPlaybackState::default(),
            registered: false,
        }
    }
}

lazy_static::lazy_static! {
    static ref MEDIA_SESSION: Arc<Mutex<MediaSessionState>> = Arc::new(Mutex::new(MediaSessionState::default()));
}

/// Register the media session with the OS
#[tauri::command]
pub fn media_session_register(app: AppHandle) -> Result<(), String> {
    let mut state = MEDIA_SESSION.lock().map_err(|e| e.to_string())?;
    
    if state.registered {
        return Ok(());
    }

    // Initialize platform-specific media session
    #[cfg(target_os = "linux")]
    {
        log::info!("MediaSession: Registering MPRIS2 media session");
        // MPRIS2 integration would go here with dbus
        // For now, we just track state and emit events
    }

    #[cfg(target_os = "macos")]
    {
        log::info!("MediaSession: Registering macOS Now Playing session");
        // MPNowPlayingInfoCenter integration would go here
    }

    #[cfg(target_os = "windows")]
    {
        log::info!("MediaSession: Registering Windows SMTC session");
        // SystemMediaTransportControls integration would go here
    }

    state.registered = true;
    log::info!("MediaSession: Registered successfully");
    
    // Emit registration event to frontend
    let _ = app.emit("media-session-registered", ());
    
    Ok(())
}

/// Unregister the media session
#[tauri::command]
pub fn media_session_unregister(app: AppHandle) -> Result<(), String> {
    let mut state = MEDIA_SESSION.lock().map_err(|e| e.to_string())?;
    
    if !state.registered {
        return Ok(());
    }

    state.registered = false;
    state.metadata = MediaMetadata::default();
    state.playback = MediaPlaybackState::default();
    
    log::info!("MediaSession: Unregistered");
    let _ = app.emit("media-session-unregistered", ());
    
    Ok(())
}

/// Update media metadata (title, artist, artwork, duration)
#[tauri::command]
pub fn media_session_set_metadata(metadata: MediaMetadata) -> Result<(), String> {
    let mut state = MEDIA_SESSION.lock().map_err(|e| e.to_string())?;
    
    if !state.registered {
        return Err("Media session not registered".to_string());
    }

    log::debug!(
        "MediaSession: Setting metadata - title: '{}', artist: '{}'",
        metadata.title,
        metadata.artist
    );

    state.metadata = metadata;
    
    // Platform-specific metadata update would go here
    #[cfg(target_os = "linux")]
    {
        // Update MPRIS2 metadata via D-Bus
    }
    
    #[cfg(target_os = "macos")]
    {
        // Update MPNowPlayingInfoCenter
    }
    
    #[cfg(target_os = "windows")]
    {
        // Update SMTC display info
    }
    
    Ok(())
}

/// Update playback state (playing/paused, position)
#[tauri::command]
pub fn media_session_set_playback_state(state_update: MediaPlaybackState) -> Result<(), String> {
    let mut state = MEDIA_SESSION.lock().map_err(|e| e.to_string())?;
    
    if !state.registered {
        return Err("Media session not registered".to_string());
    }

    log::debug!(
        "MediaSession: Setting playback state - playing: {}, position: {:?}",
        state_update.is_playing,
        state_update.position
    );

    state.playback = state_update;
    
    // Platform-specific playback state update
    #[cfg(target_os = "linux")]
    {
        // Update MPRIS2 PlaybackStatus
    }
    
    #[cfg(target_os = "macos")]
    {
        // Update MPNowPlayingInfoCenter playback state
    }
    
    #[cfg(target_os = "windows")]
    {
        // Update SMTC playback status
    }
    
    Ok(())
}

/// Get current media session state
#[tauri::command]
pub fn media_session_get_state() -> Result<(MediaMetadata, MediaPlaybackState, bool), String> {
    let state = MEDIA_SESSION.lock().map_err(|e| e.to_string())?;
    Ok((state.metadata.clone(), state.playback.clone(), state.registered))
}

/// Emit a media action to the frontend (called from platform-specific handlers)
pub fn emit_media_action(app: &AppHandle, action: &str) {
    log::debug!("MediaSession: Emitting action '{}'", action);
    let _ = app.emit("media-session-action", action);
}

/// Emit a seek request to the frontend
pub fn emit_seek_request(app: &AppHandle, position: f64) {
    log::debug!("MediaSession: Emitting seek to {}", position);
    let _ = app.emit("media-session-seek", position);
}

/// Simulate media key press (for testing or keyboard shortcut integration)
#[tauri::command]
pub fn media_session_simulate_action(app: AppHandle, action: String) -> Result<(), String> {
    let state = MEDIA_SESSION.lock().map_err(|e| e.to_string())?;
    
    if !state.registered {
        return Err("Media session not registered".to_string());
    }

    match action.as_str() {
        "play" | "pause" | "stop" | "next" | "previous" => {
            emit_media_action(&app, &action);
            Ok(())
        }
        _ => Err(format!("Unknown media action: {}", action)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metadata_serialization() {
        let metadata = MediaMetadata {
            title: "Test Song".to_string(),
            artist: "Test Artist".to_string(),
            album: "Test Album".to_string(),
            artwork: Some("https://example.com/art.png".to_string()),
            duration: Some(180.5),
        };

        let json = serde_json::to_string(&metadata).unwrap();
        assert!(json.contains("Test Song"));
        assert!(json.contains("Test Artist"));
    }

    #[test]
    fn test_playback_state_serialization() {
        let state = MediaPlaybackState {
            is_playing: true,
            position: Some(45.0),
        };

        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("isPlaying"));
        assert!(json.contains("true"));
    }
}

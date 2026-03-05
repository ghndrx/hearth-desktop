use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// A sound assignment for a specific notification event type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundAssignment {
    pub sound_id: String,   // e.g. "pop", "ping", "none", or a custom sound name
    pub volume: f32,        // 0.0 to 1.0
    pub enabled: bool,
}

impl Default for SoundAssignment {
    fn default() -> Self {
        Self {
            sound_id: "pop".into(),
            volume: 0.7,
            enabled: true,
        }
    }
}

/// A named sound profile containing sound assignments for each event type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundProfile {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub is_builtin: bool,
    pub message: SoundAssignment,
    pub mention: SoundAssignment,
    pub direct_message: SoundAssignment,
    pub voice_join: SoundAssignment,
    pub voice_leave: SoundAssignment,
    pub call_ring: SoundAssignment,
    pub notification: SoundAssignment,
}

/// The full state of the sound profile system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundProfileState {
    pub active_profile_id: String,
    pub profiles: Vec<SoundProfile>,
}

impl Default for SoundProfileState {
    fn default() -> Self {
        Self {
            active_profile_id: "default".into(),
            profiles: vec![
                SoundProfile {
                    id: "default".into(),
                    name: "Default".into(),
                    icon: "speaker".into(),
                    is_builtin: true,
                    message: SoundAssignment { sound_id: "pop".into(), volume: 0.7, enabled: true },
                    mention: SoundAssignment { sound_id: "ping".into(), volume: 0.85, enabled: true },
                    direct_message: SoundAssignment { sound_id: "chime".into(), volume: 0.8, enabled: true },
                    voice_join: SoundAssignment { sound_id: "join".into(), volume: 0.5, enabled: true },
                    voice_leave: SoundAssignment { sound_id: "leave".into(), volume: 0.5, enabled: true },
                    call_ring: SoundAssignment { sound_id: "ring".into(), volume: 0.9, enabled: true },
                    notification: SoundAssignment { sound_id: "bell".into(), volume: 0.7, enabled: true },
                },
                SoundProfile {
                    id: "quiet".into(),
                    name: "Quiet".into(),
                    icon: "volume-low".into(),
                    is_builtin: true,
                    message: SoundAssignment { sound_id: "pop".into(), volume: 0.3, enabled: true },
                    mention: SoundAssignment { sound_id: "ping".into(), volume: 0.4, enabled: true },
                    direct_message: SoundAssignment { sound_id: "chime".into(), volume: 0.35, enabled: true },
                    voice_join: SoundAssignment { sound_id: "none".into(), volume: 0.0, enabled: false },
                    voice_leave: SoundAssignment { sound_id: "none".into(), volume: 0.0, enabled: false },
                    call_ring: SoundAssignment { sound_id: "ring".into(), volume: 0.5, enabled: true },
                    notification: SoundAssignment { sound_id: "bell".into(), volume: 0.3, enabled: true },
                },
                SoundProfile {
                    id: "focus".into(),
                    name: "Focus".into(),
                    icon: "target".into(),
                    is_builtin: true,
                    message: SoundAssignment { sound_id: "none".into(), volume: 0.0, enabled: false },
                    mention: SoundAssignment { sound_id: "ping".into(), volume: 0.5, enabled: true },
                    direct_message: SoundAssignment { sound_id: "chime".into(), volume: 0.4, enabled: true },
                    voice_join: SoundAssignment { sound_id: "none".into(), volume: 0.0, enabled: false },
                    voice_leave: SoundAssignment { sound_id: "none".into(), volume: 0.0, enabled: false },
                    call_ring: SoundAssignment { sound_id: "ring".into(), volume: 0.7, enabled: true },
                    notification: SoundAssignment { sound_id: "none".into(), volume: 0.0, enabled: false },
                },
                SoundProfile {
                    id: "gaming".into(),
                    name: "Gaming".into(),
                    icon: "gamepad".into(),
                    is_builtin: true,
                    message: SoundAssignment { sound_id: "none".into(), volume: 0.0, enabled: false },
                    mention: SoundAssignment { sound_id: "ping".into(), volume: 0.6, enabled: true },
                    direct_message: SoundAssignment { sound_id: "ding".into(), volume: 0.5, enabled: true },
                    voice_join: SoundAssignment { sound_id: "swoosh".into(), volume: 0.4, enabled: true },
                    voice_leave: SoundAssignment { sound_id: "swoosh".into(), volume: 0.3, enabled: true },
                    call_ring: SoundAssignment { sound_id: "ring".into(), volume: 0.8, enabled: true },
                    notification: SoundAssignment { sound_id: "none".into(), volume: 0.0, enabled: false },
                },
            ],
        }
    }
}

static STATE: once_cell::sync::Lazy<Mutex<SoundProfileState>> =
    once_cell::sync::Lazy::new(|| Mutex::new(SoundProfileState::default()));

fn with_state<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&mut SoundProfileState) -> R,
{
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    Ok(f(&mut state))
}

#[tauri::command]
pub fn soundprofile_get_state() -> Result<SoundProfileState, String> {
    with_state(|s| s.clone())
}

#[tauri::command]
pub fn soundprofile_get_active() -> Result<SoundProfile, String> {
    with_state(|s| {
        s.profiles
            .iter()
            .find(|p| p.id == s.active_profile_id)
            .cloned()
            .unwrap_or_else(|| s.profiles[0].clone())
    })
}

#[tauri::command]
pub fn soundprofile_set_active(profile_id: String) -> Result<SoundProfileState, String> {
    with_state(|s| {
        if s.profiles.iter().any(|p| p.id == profile_id) {
            s.active_profile_id = profile_id;
        }
        s.clone()
    })
}

#[tauri::command]
pub fn soundprofile_create(name: String, icon: String, base_profile_id: Option<String>) -> Result<SoundProfileState, String> {
    with_state(|s| {
        let base = base_profile_id
            .and_then(|id| s.profiles.iter().find(|p| p.id == id).cloned())
            .unwrap_or_else(|| s.profiles[0].clone());

        let id = format!("custom-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));
        let profile = SoundProfile {
            id,
            name,
            icon,
            is_builtin: false,
            message: base.message,
            mention: base.mention,
            direct_message: base.direct_message,
            voice_join: base.voice_join,
            voice_leave: base.voice_leave,
            call_ring: base.call_ring,
            notification: base.notification,
        };
        s.profiles.push(profile);
        s.clone()
    })
}

#[tauri::command]
pub fn soundprofile_delete(profile_id: String) -> Result<SoundProfileState, String> {
    with_state(|s| {
        // Don't allow deleting built-in profiles
        if s.profiles.iter().any(|p| p.id == profile_id && p.is_builtin) {
            return s.clone();
        }
        s.profiles.retain(|p| p.id != profile_id);
        // If the active profile was deleted, fall back to default
        if s.active_profile_id == profile_id {
            s.active_profile_id = "default".into();
        }
        s.clone()
    })
}

#[tauri::command]
pub fn soundprofile_update(profile: SoundProfile) -> Result<SoundProfileState, String> {
    with_state(|s| {
        if let Some(existing) = s.profiles.iter_mut().find(|p| p.id == profile.id) {
            // Don't allow renaming built-in profiles
            if !existing.is_builtin {
                existing.name = profile.name;
                existing.icon = profile.icon;
            }
            existing.message = profile.message;
            existing.mention = profile.mention;
            existing.direct_message = profile.direct_message;
            existing.voice_join = profile.voice_join;
            existing.voice_leave = profile.voice_leave;
            existing.call_ring = profile.call_ring;
            existing.notification = profile.notification;
        }
        s.clone()
    })
}

#[tauri::command]
pub fn soundprofile_get_sound_for_event(event_type: String) -> Result<SoundAssignment, String> {
    with_state(|s| {
        let profile = s.profiles
            .iter()
            .find(|p| p.id == s.active_profile_id)
            .cloned()
            .unwrap_or_else(|| s.profiles[0].clone());

        match event_type.as_str() {
            "message" => profile.message,
            "mention" => profile.mention,
            "direct_message" => profile.direct_message,
            "voice_join" => profile.voice_join,
            "voice_leave" => profile.voice_leave,
            "call_ring" => profile.call_ring,
            "notification" => profile.notification,
            _ => SoundAssignment::default(),
        }
    })
}

#[tauri::command]
pub fn soundprofile_duplicate(profile_id: String, new_name: String) -> Result<SoundProfileState, String> {
    with_state(|s| {
        if let Some(source) = s.profiles.iter().find(|p| p.id == profile_id).cloned() {
            let id = format!("custom-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));
            let profile = SoundProfile {
                id,
                name: new_name,
                icon: source.icon,
                is_builtin: false,
                message: source.message,
                mention: source.mention,
                direct_message: source.direct_message,
                voice_join: source.voice_join,
                voice_leave: source.voice_leave,
                call_ring: source.call_ring,
                notification: source.notification,
            };
            s.profiles.push(profile);
        }
        s.clone()
    })
}

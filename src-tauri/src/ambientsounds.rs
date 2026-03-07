use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// A single ambient sound definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmbientSound {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub category: String,
}

/// State of a currently playing ambient sound
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSound {
    pub sound_id: String,
    pub volume: f32,
}

/// Saved preset with multiple sounds at different volumes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmbientPreset {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub sounds: Vec<ActiveSound>,
}

/// Full state of the ambient sound system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmbientSoundState {
    pub available_sounds: Vec<AmbientSound>,
    pub active_sounds: Vec<ActiveSound>,
    pub master_volume: f32,
    pub is_playing: bool,
    pub presets: Vec<AmbientPreset>,
    pub active_preset_id: Option<String>,
}

impl Default for AmbientSoundState {
    fn default() -> Self {
        Self {
            available_sounds: vec![
                AmbientSound { id: "rain".into(), name: "Rain".into(), icon: "rain".into(), category: "Nature".into() },
                AmbientSound { id: "thunder".into(), name: "Thunderstorm".into(), icon: "thunder".into(), category: "Nature".into() },
                AmbientSound { id: "wind".into(), name: "Wind".into(), icon: "wind".into(), category: "Nature".into() },
                AmbientSound { id: "forest".into(), name: "Forest".into(), icon: "forest".into(), category: "Nature".into() },
                AmbientSound { id: "ocean".into(), name: "Ocean Waves".into(), icon: "ocean".into(), category: "Nature".into() },
                AmbientSound { id: "fire".into(), name: "Fireplace".into(), icon: "fire".into(), category: "Nature".into() },
                AmbientSound { id: "birds".into(), name: "Birds".into(), icon: "birds".into(), category: "Nature".into() },
                AmbientSound { id: "creek".into(), name: "Creek".into(), icon: "creek".into(), category: "Nature".into() },
                AmbientSound { id: "white_noise".into(), name: "White Noise".into(), icon: "white_noise".into(), category: "Noise".into() },
                AmbientSound { id: "pink_noise".into(), name: "Pink Noise".into(), icon: "pink_noise".into(), category: "Noise".into() },
                AmbientSound { id: "brown_noise".into(), name: "Brown Noise".into(), icon: "brown_noise".into(), category: "Noise".into() },
                AmbientSound { id: "cafe".into(), name: "Coffee Shop".into(), icon: "cafe".into(), category: "Environment".into() },
                AmbientSound { id: "keyboard".into(), name: "Keyboard Typing".into(), icon: "keyboard".into(), category: "Environment".into() },
                AmbientSound { id: "train".into(), name: "Train".into(), icon: "train".into(), category: "Environment".into() },
            ],
            active_sounds: Vec::new(),
            master_volume: 0.7,
            is_playing: false,
            presets: vec![
                AmbientPreset {
                    id: "rainy_day".into(),
                    name: "Rainy Day".into(),
                    icon: "rain".into(),
                    sounds: vec![
                        ActiveSound { sound_id: "rain".into(), volume: 0.8 },
                        ActiveSound { sound_id: "thunder".into(), volume: 0.3 },
                    ],
                },
                AmbientPreset {
                    id: "deep_focus".into(),
                    name: "Deep Focus".into(),
                    icon: "brown_noise".into(),
                    sounds: vec![
                        ActiveSound { sound_id: "brown_noise".into(), volume: 0.6 },
                    ],
                },
                AmbientPreset {
                    id: "coffee_shop".into(),
                    name: "Coffee Shop".into(),
                    icon: "cafe".into(),
                    sounds: vec![
                        ActiveSound { sound_id: "cafe".into(), volume: 0.5 },
                        ActiveSound { sound_id: "keyboard".into(), volume: 0.2 },
                    ],
                },
                AmbientPreset {
                    id: "nature_retreat".into(),
                    name: "Nature Retreat".into(),
                    icon: "forest".into(),
                    sounds: vec![
                        ActiveSound { sound_id: "forest".into(), volume: 0.6 },
                        ActiveSound { sound_id: "birds".into(), volume: 0.4 },
                        ActiveSound { sound_id: "creek".into(), volume: 0.3 },
                    ],
                },
            ],
            active_preset_id: None,
        }
    }
}

static STATE: once_cell::sync::Lazy<Mutex<AmbientSoundState>> =
    once_cell::sync::Lazy::new(|| Mutex::new(AmbientSoundState::default()));

fn with_state<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&mut AmbientSoundState) -> R,
{
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    Ok(f(&mut state))
}

#[tauri::command]
pub fn ambient_get_state() -> Result<AmbientSoundState, String> {
    with_state(|s| s.clone())
}

#[tauri::command]
pub fn ambient_set_sound_volume(sound_id: String, volume: f32) -> Result<AmbientSoundState, String> {
    with_state(|s| {
        let volume = volume.clamp(0.0, 1.0);
        if volume > 0.0 {
            if let Some(active) = s.active_sounds.iter_mut().find(|a| a.sound_id == sound_id) {
                active.volume = volume;
            } else {
                s.active_sounds.push(ActiveSound { sound_id, volume });
            }
            s.is_playing = true;
        } else {
            s.active_sounds.retain(|a| a.sound_id != sound_id);
            if s.active_sounds.is_empty() {
                s.is_playing = false;
            }
        }
        s.active_preset_id = None;
        s.clone()
    })
}

#[tauri::command]
pub fn ambient_toggle_sound(sound_id: String) -> Result<AmbientSoundState, String> {
    with_state(|s| {
        if s.active_sounds.iter().any(|a| a.sound_id == sound_id) {
            s.active_sounds.retain(|a| a.sound_id != sound_id);
        } else {
            s.active_sounds.push(ActiveSound { sound_id, volume: 0.5 });
        }
        s.is_playing = !s.active_sounds.is_empty();
        s.active_preset_id = None;
        s.clone()
    })
}

#[tauri::command]
pub fn ambient_set_master_volume(volume: f32) -> Result<AmbientSoundState, String> {
    with_state(|s| {
        s.master_volume = volume.clamp(0.0, 1.0);
        s.clone()
    })
}

#[tauri::command]
pub fn ambient_stop_all() -> Result<AmbientSoundState, String> {
    with_state(|s| {
        s.active_sounds.clear();
        s.is_playing = false;
        s.active_preset_id = None;
        s.clone()
    })
}

#[tauri::command]
pub fn ambient_apply_preset(preset_id: String) -> Result<AmbientSoundState, String> {
    with_state(|s| {
        if let Some(preset) = s.presets.iter().find(|p| p.id == preset_id).cloned() {
            s.active_sounds = preset.sounds;
            s.is_playing = !s.active_sounds.is_empty();
            s.active_preset_id = Some(preset_id);
        }
        s.clone()
    })
}

#[tauri::command]
pub fn ambient_save_preset(name: String, icon: String) -> Result<AmbientSoundState, String> {
    with_state(|s| {
        let id = format!("custom-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));
        let preset = AmbientPreset {
            id: id.clone(),
            name,
            icon,
            sounds: s.active_sounds.clone(),
        };
        s.presets.push(preset);
        s.active_preset_id = Some(id);
        s.clone()
    })
}

#[tauri::command]
pub fn ambient_delete_preset(preset_id: String) -> Result<AmbientSoundState, String> {
    with_state(|s| {
        s.presets.retain(|p| p.id != preset_id);
        if s.active_preset_id.as_deref() == Some(&preset_id) {
            s.active_preset_id = None;
        }
        s.clone()
    })
}

#[tauri::command]
pub fn ambient_toggle_playback() -> Result<AmbientSoundState, String> {
    with_state(|s| {
        if s.is_playing {
            s.is_playing = false;
        } else if !s.active_sounds.is_empty() {
            s.is_playing = true;
        }
        s.clone()
    })
}

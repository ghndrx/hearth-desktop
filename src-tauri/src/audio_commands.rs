use cpal::traits::{DeviceTrait, HostTrait};
use std::sync::Mutex;
use tauri::State;

use crate::audio::{host_default_config, AudioPipeline};

/// Shared audio state managed by Tauri.
pub struct AudioState {
    pub pipeline: Mutex<Option<AudioPipeline>>,
}

impl Default for AudioState {
    fn default() -> Self {
        Self {
            pipeline: Mutex::new(None),
        }
    }
}

/// List available audio input device names.
#[tauri::command]
pub fn enumerate_audio_devices() -> Vec<String> {
    let host = cpal::default_host();
    host.input_devices()
        .map(|devices| {
            devices
                .filter_map(|d| d.name().ok())
                .collect()
        })
        .unwrap_or_default()
}

/// Start capturing audio from the specified device (or default).
#[tauri::command]
pub fn start_audio_capture(
    device: Option<String>,
    state: State<'_, AudioState>,
) -> Result<(), String> {
    let host = cpal::default_host();

    let input_device = match device {
        Some(name) => host
            .input_devices()
            .map_err(|e| e.to_string())?
            .find(|d| d.name().ok().as_deref() == Some(name.as_str()))
            .ok_or_else(|| format!("audio device not found: {name}"))?,
        None => host
            .default_input_device()
            .ok_or("no default input device available")?,
    };

    let config = host_default_config(&host);
    let pipeline = AudioPipeline::new(config, input_device);
    pipeline.run()?;

    let mut guard = state.pipeline.lock().map_err(|e| e.to_string())?;
    *guard = Some(pipeline);

    Ok(())
}

/// Stop the active audio capture.
#[tauri::command]
pub fn stop_audio_capture(state: State<'_, AudioState>) -> Result<(), String> {
    let mut guard = state.pipeline.lock().map_err(|e| e.to_string())?;
    if let Some(pipeline) = guard.take() {
        pipeline.stop()?;
    }
    Ok(())
}

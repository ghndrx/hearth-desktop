use nnnoiseless::DenoiseState;
use std::sync::Mutex;

const FRAME_SIZE: usize = DenoiseState::FRAME_SIZE;

struct NoiseSuppressionState {
    enabled: bool,
    attenuation_db: f32,
    denoiser: Box<DenoiseState<'static>>,
}

impl Default for NoiseSuppressionState {
    fn default() -> Self {
        Self {
            enabled: false,
            attenuation_db: 0.0,
            denoiser: DenoiseState::new(),
        }
    }
}

static STATE: once_cell::sync::Lazy<Mutex<NoiseSuppressionState>> =
    once_cell::sync::Lazy::new(|| Mutex::new(NoiseSuppressionState::default()));

/// Enable AI noise suppression for voice input.
#[tauri::command]
pub fn noise_suppression_enable() -> Result<NoiseSuppressionStatus, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    state.enabled = true;
    // Reset the denoiser to clear any prior state
    state.denoiser = DenoiseState::new();
    Ok(NoiseSuppressionStatus {
        enabled: state.enabled,
        attenuation_db: state.attenuation_db,
    })
}

/// Disable AI noise suppression.
#[tauri::command]
pub fn noise_suppression_disable() -> Result<NoiseSuppressionStatus, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    state.enabled = false;
    Ok(NoiseSuppressionStatus {
        enabled: state.enabled,
        attenuation_db: state.attenuation_db,
    })
}

/// Get current noise suppression status.
#[tauri::command]
pub fn noise_suppression_status() -> Result<NoiseSuppressionStatus, String> {
    let state = STATE.lock().map_err(|e| e.to_string())?;
    Ok(NoiseSuppressionStatus {
        enabled: state.enabled,
        attenuation_db: state.attenuation_db,
    })
}

/// Process a chunk of audio samples (f32, mono, 48 kHz) through the RNNoise denoiser.
///
/// Input samples should be in the range [-1.0, 1.0]. The denoiser operates on
/// fixed-size frames of `FRAME_SIZE` samples (480 at 48 kHz = 10 ms).
/// Any trailing samples that don't fill a complete frame are passed through unchanged.
///
/// Returns the denoised samples and the estimated voice-activity probability (VAD)
/// for the last processed frame.
#[tauri::command]
pub fn noise_suppression_process(samples: Vec<f32>) -> Result<ProcessedAudio, String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;

    if !state.enabled {
        return Ok(ProcessedAudio {
            samples,
            vad_probability: 0.0,
        });
    }

    let mut output = Vec::with_capacity(samples.len());
    let mut vad: f32 = 0.0;
    let mut input_frame = [0.0f32; FRAME_SIZE];
    let mut output_frame = [0.0f32; FRAME_SIZE];

    let chunks = samples.chunks(FRAME_SIZE);
    for chunk in chunks {
        if chunk.len() == FRAME_SIZE {
            // RNNoise expects samples scaled to i16 range
            for (i, &s) in chunk.iter().enumerate() {
                input_frame[i] = s * 32768.0;
            }
            vad = state.denoiser.process_frame(&mut output_frame, &input_frame);
            // Scale back to [-1.0, 1.0]
            for &s in &output_frame {
                output.push(s / 32768.0);
            }
        } else {
            // Incomplete frame — pass through
            output.extend_from_slice(chunk);
        }
    }

    // Track attenuation: rough estimate comparing input/output RMS of last frame
    if !samples.is_empty() {
        let n = samples.len().min(FRAME_SIZE);
        let start = if samples.len() >= FRAME_SIZE {
            samples.len() - FRAME_SIZE
        } else {
            0
        };
        let in_rms: f32 = (samples[start..start + n]
            .iter()
            .map(|s| s * s)
            .sum::<f32>()
            / n as f32)
            .sqrt();
        let out_rms: f32 = (output[start..start + n]
            .iter()
            .map(|s| s * s)
            .sum::<f32>()
            / n as f32)
            .sqrt();
        state.attenuation_db = if in_rms > 1e-10 && out_rms > 1e-10 {
            20.0 * (out_rms / in_rms).log10()
        } else {
            0.0
        };
    }

    Ok(ProcessedAudio {
        samples: output,
        vad_probability: vad,
    })
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct NoiseSuppressionStatus {
    pub enabled: bool,
    pub attenuation_db: f32,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct ProcessedAudio {
    pub samples: Vec<f32>,
    pub vad_probability: f32,
}

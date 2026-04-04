use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, Stream, StreamConfig};
use ringbuf::HeapRb;
use std::sync::Mutex;

/// Configuration for the audio pipeline.
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            channels: 1,
            buffer_size: 4096,
        }
    }
}

/// Returns the default host's default input config, falling back to AudioConfig defaults.
pub fn host_default_config(host: &Host) -> AudioConfig {
    let device = host.default_input_device();
    match device.and_then(|d| d.default_input_config().ok()) {
        Some(cfg) => AudioConfig {
            sample_rate: cfg.sample_rate().0,
            channels: cfg.channels(),
            buffer_size: 4096,
        },
        None => AudioConfig::default(),
    }
}

/// Real-time audio capture pipeline backed by CPAL and a lock-free ring buffer.
pub struct AudioPipeline {
    stream: Mutex<Option<Stream>>,
    config: AudioConfig,
    device: Device,
}

// SAFETY: cpal::Stream internally manages its own thread safety via OS audio APIs.
// We wrap it in a Mutex to ensure exclusive access.
unsafe impl Send for AudioPipeline {}
unsafe impl Sync for AudioPipeline {}

impl AudioPipeline {
    /// Build a new pipeline for the given device (or the default input device).
    pub fn new(config: AudioConfig, device: Device) -> Self {
        Self {
            stream: Mutex::new(None),
            config,
            device,
        }
    }

    /// Start capturing audio from the input device into the ring buffer.
    pub fn run(&self) -> Result<(), String> {
        let stream_config = StreamConfig {
            channels: self.config.channels,
            sample_rate: cpal::SampleRate(self.config.sample_rate),
            buffer_size: cpal::BufferSize::Default,
        };

        let rb = HeapRb::<f32>::new(self.config.buffer_size);
        let (mut producer, _consumer) = rb.split();

        let err_fn = |err: cpal::StreamError| {
            eprintln!("audio stream error: {err}");
        };

        let stream = self
            .device
            .build_input_stream(
                &stream_config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    producer.push_slice(data);
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("failed to build input stream: {e}"))?;

        stream.play().map_err(|e| format!("failed to play stream: {e}"))?;

        *self.stream.lock().map_err(|e| e.to_string())? = Some(stream);
        Ok(())
    }

    /// Stop the capture stream.
    pub fn stop(&self) -> Result<(), String> {
        let mut guard = self.stream.lock().map_err(|e| e.to_string())?;
        if let Some(stream) = guard.take() {
            stream.pause().map_err(|e| format!("failed to pause stream: {e}"))?;
        }
        Ok(())
    }
}

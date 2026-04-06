# PRD #03: Advanced Audio Processing System

**Status:** Draft  
**Priority:** P1 - High  
**Owner:** Desktop Team  
**Created:** 2026-04-06  

## Problem Statement

Hearth Desktop's current WebRTC voice infrastructure provides basic voice communication but lacks the advanced audio processing features that users expect from modern voice chat applications. Discord's audio system includes noise suppression, echo cancellation, automatic gain control, and spatial audio features that significantly improve voice call quality and user experience.

Poor audio quality is a major barrier to user adoption and retention in voice chat applications. Users frequently abandon platforms that don't provide clear, professional-grade audio processing.

## Success Criteria

- [ ] AI-powered noise suppression that filters background noise effectively
- [ ] Echo cancellation that eliminates audio feedback in all scenarios
- [ ] Automatic gain control that normalizes voice volume levels
- [ ] Voice activity detection with customizable sensitivity
- [ ] Multiple audio device management with seamless switching
- [ ] Audio quality settings with bitrate and sample rate options
- [ ] Spatial audio positioning for immersive voice channels
- [ ] Integration with existing WebRTC infrastructure

## User Stories

### As a remote worker, I want...
- Noise suppression so my dog barking doesn't disrupt meetings
- Echo cancellation so I can use speakers without feedback
- Automatic volume adjustment so I don't need to constantly adjust levels

### As a gamer, I want...
- Spatial audio so I can tell where teammates are positioned
- Audio ducking that lowers game volume when teammates speak
- Quick audio device switching for different gaming scenarios

### As a podcast host, I want...
- Professional-grade audio processing for high-quality recordings
- Fine-grained audio controls for optimal sound quality
- Support for high-end audio equipment and drivers

### As a casual user, I want...
- Audio that "just works" with smart defaults
- Clear voice quality without technical configuration
- Reliable audio that doesn't cut out or distort

## Technical Requirements

### Core Audio Processing Features

**1. Noise Suppression**
- AI-powered background noise filtering
- Real-time processing with <20ms latency
- Customizable suppression intensity (light, moderate, aggressive)
- Support for various noise types (keyboard, fans, traffic, etc.)
- Minimal CPU impact (<5% on mid-range hardware)

**2. Echo Cancellation**  
- Adaptive echo cancellation for various room acoustics
- Support for both headphones and speakers
- Real-time adjustment to audio feedback loops
- Integration with system audio routing

**3. Automatic Gain Control (AGC)**
- Dynamic volume normalization across users
- Target volume level maintenance (-16dB to -20dB)
- Protection against audio clipping and distortion
- Smooth volume transitions to avoid jarring changes

**4. Voice Activity Detection (VAD)**
- Machine learning-based voice detection
- Customizable sensitivity threshold
- Background noise adaptation
- Push-to-talk integration

**5. Spatial Audio**
- 3D positional audio in voice channels
- Head-related transfer function (HRTF) processing
- Customizable room acoustics simulation
- Integration with user positioning in channels

### Technical Implementation

**Backend (Rust/Tauri):**
```rust
use cpal::{Device, SampleRate, SampleFormat};
use rubato::{Resampler, SincFixedIn, InterpolationType, InterpolationParameters};

#[derive(Serialize, Deserialize, Clone)]
struct AudioSettings {
    noise_suppression: NoiseSuppressionLevel,
    echo_cancellation: bool,
    auto_gain_control: bool,
    voice_activity_threshold: f32,
    sample_rate: u32,
    bitrate: u32,
    audio_quality: AudioQuality,
}

#[derive(Serialize, Deserialize, Clone)]
enum NoiseSuppressionLevel {
    Off,
    Light,
    Moderate,
    Aggressive,
    Adaptive,
}

#[derive(Serialize, Deserialize, Clone)]
enum AudioQuality {
    Low,      // 64kbps, 16kHz
    Standard, // 128kbps, 44.1kHz
    High,     // 256kbps, 48kHz
    Studio,   // 512kbps, 96kHz
}

struct AudioProcessor {
    noise_suppressor: NoiseSuppressionEngine,
    echo_canceller: EchoCancellationEngine,
    gain_controller: AutomaticGainControl,
    vad: VoiceActivityDetector,
    spatial_processor: SpatialAudioEngine,
}

impl AudioProcessor {
    pub fn process_audio_frame(&mut self, input: &[f32], settings: &AudioSettings) -> Vec<f32> {
        let mut processed = input.to_vec();
        
        // 1. Noise suppression
        if settings.noise_suppression != NoiseSuppressionLevel::Off {
            processed = self.noise_suppressor.process(&processed, &settings.noise_suppression);
        }
        
        // 2. Echo cancellation
        if settings.echo_cancellation {
            processed = self.echo_canceller.process(&processed);
        }
        
        // 3. Automatic gain control
        if settings.auto_gain_control {
            processed = self.gain_controller.process(&processed);
        }
        
        // 4. Voice activity detection
        let voice_detected = self.vad.detect(&processed, settings.voice_activity_threshold);
        
        // 5. Spatial audio processing
        processed = self.spatial_processor.process(&processed, voice_detected);
        
        processed
    }
}

// Noise suppression using RNNoise or similar
struct NoiseSuppressionEngine {
    rnn_state: RnnState,
    frame_buffer: Vec<f32>,
}

impl NoiseSuppressionEngine {
    pub fn process(&mut self, audio: &[f32], level: &NoiseSuppressionLevel) -> Vec<f32> {
        let suppression_factor = match level {
            NoiseSuppressionLevel::Light => 0.3,
            NoiseSuppressionLevel::Moderate => 0.6,
            NoiseSuppressionLevel::Aggressive => 0.9,
            NoiseSuppressionLevel::Adaptive => self.adaptive_factor(),
            _ => 0.0,
        };
        
        // Process through RNN noise suppression model
        self.rnn_denoise(audio, suppression_factor)
    }
    
    fn adaptive_factor(&self) -> f32 {
        // Analyze background noise level and adjust suppression
        // Implementation would use spectral analysis
        0.6 // placeholder
    }
}
```

**Frontend (Svelte):**
```typescript
interface AudioDeviceManager {
  inputDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  currentInput: AudioDevice;
  currentOutput: AudioDevice;
}

interface AudioDevice {
  id: string;
  name: string;
  kind: 'audioinput' | 'audiooutput';
  sampleRates: number[];
  channels: number;
}

class AudioController {
  private audioContext: AudioContext;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode;
  private processor: ScriptProcessorNode;
  
  async initialize() {
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    await this.setupAudioProcessing();
    await this.enumerateDevices();
  }
  
  async startAudioCapture(settings: AudioSettings) {
    const constraints = {
      audio: {
        deviceId: settings.inputDevice,
        sampleRate: settings.sampleRate,
        echoCancellation: false, // We handle this ourselves
        noiseSuppression: false, // We handle this ourselves
        autoGainControl: false,  // We handle this ourselves
      }
    };
    
    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Connect to our custom audio processing pipeline
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }
  
  private setupAudioProcessing() {
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      const outputBuffer = event.outputBuffer.getChannelData(0);
      
      // Send to Rust backend for processing
      this.processAudioFrame(inputBuffer).then((processed) => {
        outputBuffer.set(processed);
      });
    };
  }
  
  private async processAudioFrame(audioData: Float32Array): Promise<Float32Array> {
    // Send audio to Rust backend for processing
    const processed = await invoke('process_audio_frame', { 
      audioData: Array.from(audioData),
      settings: this.currentSettings 
    });
    return new Float32Array(processed);
  }
}
```

### Audio Quality Options
```rust
#[derive(Serialize, Deserialize)]
struct QualityPreset {
    name: &'static str,
    sample_rate: u32,
    bitrate: u32,
    channels: u8,
    frame_size: usize,
    use_case: &'static str,
}

const QUALITY_PRESETS: &[QualityPreset] = &[
    QualityPreset {
        name: "Battery Saver",
        sample_rate: 16000,
        bitrate: 32000,
        channels: 1,
        frame_size: 320,
        use_case: "Mobile/low bandwidth",
    },
    QualityPreset {
        name: "Standard",
        sample_rate: 44100,
        bitrate: 128000,
        channels: 1,
        frame_size: 1024,
        use_case: "General voice chat",
    },
    QualityPreset {
        name: "High Quality",
        sample_rate: 48000,
        bitrate: 256000,
        channels: 2,
        frame_size: 1024,
        use_case: "Music/podcasting",
    },
    QualityPreset {
        name: "Studio",
        sample_rate: 96000,
        bitrate: 512000,
        channels: 2,
        frame_size: 2048,
        use_case: "Professional recording",
    },
];
```

### Dependencies
- **Audio Processing:** `cpal` for audio I/O, `rubato` for resampling
- **Noise Suppression:** RNNoise library or equivalent ML model
- **Echo Cancellation:** WebRTC's AEC implementation or custom solution
- **Spatial Audio:** Custom HRTF implementation or library
- **Audio Analysis:** `rustfft` for frequency domain processing

### Performance Requirements
- **Latency:** <20ms end-to-end audio processing
- **CPU Usage:** <10% on mid-range hardware (Intel i5-8400 or equivalent)
- **Memory:** <100MB additional RAM for audio buffers and models
- **Quality:** SNR improvement of >20dB for noise suppression

## Testing Strategy

### Automated Testing
```rust
#[cfg(test)]
mod audio_tests {
    use super::*;
    
    #[test]
    fn test_noise_suppression_effectiveness() {
        let processor = AudioProcessor::new();
        let noisy_audio = load_test_audio("keyboard_typing.wav");
        let clean_audio = load_test_audio("clean_voice.wav");
        
        let processed = processor.suppress_noise(&noisy_audio, NoiseSuppressionLevel::Moderate);
        let snr_improvement = calculate_snr_improvement(&clean_audio, &noisy_audio, &processed);
        
        assert!(snr_improvement > 15.0); // Minimum 15dB improvement
    }
    
    #[test]
    fn test_echo_cancellation() {
        let processor = AudioProcessor::new();
        let audio_with_echo = load_test_audio("echo_test.wav");
        
        let processed = processor.cancel_echo(&audio_with_echo);
        let echo_suppression = measure_echo_suppression(&processed);
        
        assert!(echo_suppression > 40.0); // Minimum 40dB echo suppression
    }
}
```

### Manual Testing
- Test with various microphone types (USB, XLR, built-in)
- Background noise scenarios (office, coffee shop, construction)
- Echo scenarios (speakers, poor headphones, room acoustics)
- Voice quality assessment with different accents and languages
- Performance testing on low-end hardware

### Quality Assurance
- A/B testing against Discord's audio quality
- Subjective audio quality ratings from test users
- Objective measurements (THD, SNR, frequency response)
- Latency measurements with high-precision tools

## Rollout Plan

### Phase 1 (Foundation)
- Basic noise suppression implementation
- Echo cancellation for headphones
- Automatic gain control
- Audio device management

### Phase 2 (Enhancement)
- Advanced noise suppression with ML models
- Spatial audio implementation
- Audio quality presets
- Performance optimizations

### Phase 3 (Professional)
- Studio-grade audio processing
- Advanced spatial features
- Custom audio plugin support
- Professional audio driver support

## Success Metrics

- **Audio Quality:** 95% of users rate voice quality as "good" or "excellent"
- **Background Noise:** 80% reduction in noise-related user complaints
- **Echo Issues:** 90% reduction in echo-related support tickets
- **Performance:** <5% average CPU usage during voice calls
- **Adoption:** 85% of users keep audio processing features enabled

## Dependencies & Risks

### Dependencies
- RNNoise or equivalent noise suppression library
- WebRTC echo cancellation algorithms
- Platform audio drivers and APIs
- Machine learning models for voice detection

### Risks
- **Performance Impact:** Advanced processing might impact low-end devices
- **Latency:** Real-time processing could introduce noticeable delay
- **Quality Trade-offs:** Aggressive processing might degrade voice quality
- **Platform Differences:** Audio APIs vary significantly across OS platforms

### Mitigation
- Adaptive quality settings based on device capabilities
- Extensive testing across hardware configurations
- Progressive enhancement with fallback options
- Platform-specific optimizations

## Open Questions

1. Should we support third-party audio plugin formats (VST, AU)?
2. How should we handle ultra-low latency requirements for musicians?
3. Should spatial audio be opt-in or opt-out by default?
4. How granular should audio quality controls be for end users?

## References

- [WebRTC Audio Processing](https://webrtc.googlesource.com/src/+/main/modules/audio_processing/)
- [RNNoise: Learning Noise Suppression](https://jmvalin.ca/demo/rnnoise/)
- [Discord's Audio Technology](https://blog.discord.com/how-discord-handles-two-and-half-million-concurrent-voice-users-using-webrtc-ce01c3187429)
- [CPAL Audio Library](https://docs.rs/cpal/latest/cpal/)
- [Spatial Audio Guidelines](https://developer.apple.com/documentation/avfaudio/spatial_audio)
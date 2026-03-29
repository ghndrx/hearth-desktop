# PRD: Advanced Voice Controls System

## Overview

**Priority**: P1
**Timeline**: 3-4 weeks
**Owner**: Frontend / Audio Engineering

Implement advanced voice processing controls — per-user voice activity detection sensitivity, push-to-talk modes, voice isolation, and audio input level monitoring — giving Hearth Desktop professional-grade voice quality that surpasses Discord's default settings.

## Problem Statement

Hearth Desktop's WebRTC voice pipeline (PR #17) supports basic voice transmission but lacks the audio controls that power users expect: configurable VAD (voice activity detection), push-to-talk toggle, input level visualization, and echo/background noise handling. This makes Hearth voice channels feel amateur compared to Discord's refined voice UX, particularly for podcasters, streamers, and remote workers who need reliable audio quality.

## Goals

### Primary Goals
- **Voice Activity Detection (VAD) Sensitivity** — slider (0–100) controlling how aggressively the VAD gates audio transmission; "Always transmit" override option
- **Push-to-Talk (PTT)** — toggle mode where microphone is only active while a hotkey is held (separate from global hotkeys in PRD #06); configurable PTT hotkey
- **Input Level Meter** — real-time microphone input visualization (green/yellow/red bar) in voice controls panel
- **Microphone Selector** — dropdown to choose input device with live preview

### Secondary Goals
- **Voice Isolation / Noise Suppression** — toggle to suppress background noise (WASM DSP using `@pixi/sound` or a dedicated denoiser like RNNoise compiled to WASM)
- **Echo Cancellation** — toggle (usually enabled by default; some users with studio gear need to disable)
- **Automatic Gain Control (AGC)** — toggle to normalize voice levels automatically
- **Audio input/output device memory** — persist last-used device IDs per server

## Technical Approach

### WebRTC Audio Pipeline
The existing WebRTC pipeline (PR #17, PR #23) uses `RTCPeerConnection` with `getUserMedia()`. We extend the `MediaStreamTrack` processing chain:

```
Microphone → MediaStreamTrack
  → AudioContext (分析/处理)
  → Noise Suppression (WASM/RNNoise)
  → VAD gate (WebRTC VAD or speech-detection library)
  → Echo Canceller (optional)
  → AGC (optional)
  → RTCPeerConnection outbound track
```

### Data Model
```typescript
interface VoiceSettings {
  userId: string;
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  vadSensitivity: number;       // 0.0–1.0
  vadEnabled: boolean;           // false = always transmit
  pttEnabled: boolean;
  pttKey: string | null;         // e.g. "V", "Left Shift"
  noiseSuppressionEnabled: boolean;
  echoCancellationEnabled: boolean;
  agcEnabled: boolean;
  inputVolume: number;           // 0.0–2.0 (multiplier)
}
```

### Tauri Commands
- `get_voice_settings(): VoiceSettings`
- `update_voice_settings(settings: Partial<VoiceSettings>)`
- `enumerate_audio_devices(): AudioDevice[]` — wraps `enumerateDevices()` from browser API
- `set_input_device(deviceId: string)` — switches microphone in live MediaStream

### UI Components
- **VoiceSettingsPanel**: Accessible from user avatar → Voice Settings; contains all toggles + sliders
- **InputLevelMeter**: Canvas-based real-time level bar, green→yellow→red
- **VADSensitivitySlider**: Labeled slider with presets ("Aggressive", "Normal", "Permissive")
- **PTTHotkeyPicker**: Key capture input for PTT binding
- **DeviceSelector**: Dropdown with device labels + preview button
- **VoiceControlsBar**: Compact bar in voice channel header with mute/deafen + settings gear

### Dependencies
- WebRTC voice pipeline (PR #17, PR #23)
- RNNoise WASM or similar noise suppression (add `rusty_dog` or `denoising_wasm` crate)
- Web Audio API for level metering (`AudioContext.createAnalyser()`)
- `speakable` or `webrtc-vad` npm package for software VAD

## Out of Scope
- Server-side voice processing (SFU transcoding for noise suppression — requires backend)
- Voice equalizer / effects
- Spatial audio / surround sound

## Key Risks
- WASM noise suppression adds significant CPU load — profile on low-end hardware
- Switching audio devices mid-call requires MediaStream re-creation; handle gracefully
- VAD libraries have platform-specific behavior; test on Windows, macOS, Linux

## Success Metrics
- VAD correctly gates audio transmission in 95%+ of normal speech scenarios
- Device switch completes within 1 second without dropping call
- Noise suppression achieves ≥ 20dB background noise reduction (subjective test)
- Level meter updates at ≥ 30fps without causing audio glitches

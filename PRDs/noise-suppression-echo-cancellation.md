# PRD: Noise Suppression & Echo Cancellation

**Document Status:** Active
**Priority:** P0 (Critical)
**Target Release:** Q2 2026
**Owner:** Audio Team

## Problem Statement

Hearth Desktop's WebRTC P2P voice system (just completed) lacks professional-grade noise suppression and echo cancellation. Users in noisy environments (gaming setups, open offices, shared spaces) experience degraded voice quality. Echo and background noise are the top two complaints in voice communication apps.

## Feature Gap vs Discord

| Feature | Discord | Hearth Desktop |
|---------|---------|----------------|
| AI Noise Suppression | ✅ RNNoise-based | ❌ None |
| Echo Cancellation | ✅ WebRTC AEC3 | ❌ None |
| Noise Gate | ✅ Configurable | ❌ None |
| Audio Compression | ✅ Dynamic range | ❌ None |

## Technical Requirements

### Noise Suppression (RNNoise)
- Integrate RNNoise library for real-time AI-powered noise suppression
- Configurable suppression strength (Low/Medium/High/Aggressive)
- Preserve voice clarity while filtering keyboard, mechanical switches, HVAC
- CPU overhead target: <8% on modern hardware

### Echo Cancellation (AEC3)
- WebRTC AEC3 algorithm for acoustic echo cancellation
- Handle speaker-to-microphone bleed in gaming headsets
- Support for USB headsets, Bluetooth, and built-in laptop mics
- Tail length: 500ms for large rooms

### Audio Processing Pipeline
```rust
// Target: src-tauri/src/audio/
pub mod noise_suppression;  // RNNoise integration
pub mod echo_cancellation;  // WebRTC AEC3
pub mod audio_gate;          // Configurable noise gate
```

## Acceptance Criteria
- [ ] RNNoise suppresses keyboard/mouse noise without degrading voice
- [ ] Echo cancellation eliminates speaker bleed in headsets
- [ ] User-configurable noise suppression strength
- [ ] <8% CPU overhead in typical gaming scenario
- [ ] Fallback to traditional filtering if RNNoise unavailable

# PRD: Soundboard System

## Overview

**Priority**: P1
**Timeline**: 3-4 weeks
**Owner**: Frontend / Audio Engineering

Implement a Soundboard — a pad-grid of clickable sound effect buttons that play audio into a voice channel. Users can trigger sound effects in real-time during calls, replacing clunky manual audio file sharing with instant, community-controlled sound boards.

## Problem Statement

Discord's Soundboard feature is one of its most-used engagement hooks in voice channels — particularly in gaming communities and friend groups. Hearth Desktop has voice channels (WebRTC pipeline, PR #17) but no soundboard, making voice interactions feel sterile compared to Discord. Users currently resort to sharing audio files in text channels and manually playing them, which is disruptive and out of sync.

## Goals

### Primary Goals
- Display a grid of sound "pads" (e.g., 4×3, 6×4 configurable)
- Play audio into the active voice channel when a pad is clicked
- Support simultaneous playback of multiple sounds (polyphonic)
- Per-pad volume control
- Visual feedback when a sound is playing (highlight, waveform animation)
- Stop-all button to kill all playing sounds immediately

### Secondary Goals
- Sound library management: add sounds from file picker (MP3, WAV, OGG, FLAC)
- Sound naming and custom icons per pad
- Save/load multiple soundboard presets (per-server configs)
- Keyboard shortcuts mapped to specific pads (e.g., F1-F12)
- Admin can lock soundboard to prevent user-added sounds

### Not a Goal
- Soundboard audio is NOT transmitted as a media stream to other users in high fidelity — it plays as a "sound effect" mixed into the voice channel audio for all to hear, similar to Discord.

## Technical Approach

### Audio Architecture
- Use Web Audio API (`AudioContext`, `AudioBufferSourceNode`) for low-latency local playback
- Capture audio output via `AudioDestinationNode` and route into WebRTC voice MediaStream (outgoing audio track)
- Fallback: route through Tauri backend via `tauri-plugin-notification` is NOT suitable — must be real-time audio mixing
- Latency target: < 50ms from click to audible in voice channel

### Data Model
```typescript
interface SoundboardPreset {
  id: string;
  serverId: string;
  name: string;
  pads: SoundPad[];
  isDefault: boolean;
}

interface SoundPad {
  id: string;
  presetId: string;
  index: number;        // grid position
  label: string;
  audioFilePath: string; // local file path or URL
  volume: number;       // 0.0–1.0
  shortcut: string | null; // e.g. "F1"
}
```

### Tauri Commands
- `load_soundboard_preset(presetId): SoundboardPreset`
- `save_soundboard_pad(presetId, pad: SoundPad)`
- `delete_soundboard_pad(padId)`
- `play_sound_pad(padId)` — triggers local audio + injects into voice stream
- `stop_all_sounds()`
- `set_sound_volume(padId, volume)`

### UI Components
- **SoundboardGrid**: CSS grid of SoundPadButton components, mapped to keyboard shortcuts
- **SoundPadButton**: Rounded button with icon/label, volume ring indicator, playing state glow
- **SoundboardDrawer**: Slide-up panel (toggles from voice channel toolbar) showing the full soundboard
- **AddSoundModal**: File picker + name + icon selector + shortcut assignment
- **PresetSwitcher**: Dropdown to switch between multiple soundboard presets

### Dependencies
- WebRTC voice pipeline (PR #17, PR #23) — soundboard audio must inject into the same MediaStream
- Tauri file dialog (`tauri-plugin-dialog`) for loading local audio files
- `serde` serialization for preset persistence (`tauri-plugin-store`)

## Out of Scope
- Soundboard in text channels (audio files shared as messages use different system)
- Soundboard streaming to non-voice participants
- Cloud sync of soundboard presets across devices (v1: local + per-server)

## Key Risks
- Audio routing into WebRTC voice track is technically complex — may need a separate audio mixing worker
- Latency above 100ms makes soundboard feel broken; performance testing on all 3 platforms is critical
- Concurrent playback of 8+ sounds requires CPU-efficient mixing

## Success Metrics
- Soundboard opens within 500ms of toolbar click
- Audio audible within 80ms of pad click on target hardware
- Zero audio glitches during simultaneous 4-sound playback

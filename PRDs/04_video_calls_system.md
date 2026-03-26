# PRD: Video Calls in Voice Channels

## Overview

**Priority**: P1 (High)
**Timeline**: 5-7 weeks
**Owner**: Desktop Team

Implement webcam video calls within voice channels, enabling face-to-face communication alongside voice — directly competing with Discord's video call feature.

## Problem Statement

Discord's video calls are heavily used for small group calls, remote meetings, and social hangouts. Hearth Desktop has WebRTC voice infrastructure (#17) but no video support. Users who need video must use Discord or a separate video conferencing tool.

**Current Gap**: Discord supports per-user webcam video in voice channels with quality controls, mute indicators, and a gallery view. Hearth Desktop has zero video implementation.

## User Stories

- As a user, I want to enable my webcam in a voice channel so others can see me
- As a user, I want to see up to 25 video tiles simultaneously so I can see my whole group
- As a user, I want to blur my background so my surroundings aren't visible
- As a user, I want to control video quality so I can preserve bandwidth

## Technical Approach

### WebRTC Video Pipeline

Leverage the existing WebRTC voice infrastructure from PR #17 and extend it with video tracks.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  Svelte Frontend                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ VideoToggle │  │ VideoGrid   │  │ VCRSettings │  │
│  │ + camera    │  │ (tiles)     │  │ (quality,   │  │
│  │  picker     │  │             │  │  effects)   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │          │
│  ┌──────▼────────────────▼────────────────▼──────┐  │
│  │  VideoCallStore (Svelte)                     │  │
│  └──────────────────┬───────────────────────────┘  │
└─────────────────────┼────────────────────────────────┘
                      │ Tauri invoke
┌─────────────────────▼────────────────────────────────┐
│  Rust Backend                                        │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │ camera_capture │  │ WebRTC Pipeline         │   │
│  │ (nokhwa)       │──│ (from #17)              │   │
│  │                │  │  + VideoTracks         │   │
│  └─────────────────┘  └─────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Key Components

1. **Camera Picker** — Select from available cameras via `navigator.mediaDevices`
2. **Video Grid UI** — Dynamic grid layout (1-4 tiles: 2×2; 5-9: 3×3; 10+: scrollable 4-col)
3. **Video Toggle** — Prominent toggle with camera preview before enabling
4. **Per-User Video Quality** — Adaptive bitrate based on participant count (1 user: 1080p@30fps; 5+: 720p@15fps; 10+: 480p@15fps)
5. **Background Blur** (stretch goal) — ML-powered background segmentation using WebAssembly (MediaPipe or TensorFlow.js WASM)

### API / Commands

```typescript
interface VideoCallAPI {
  enumerateCameras(): Promise<MediaDeviceInfo[]>;
  startVideo(cameraId?: string): Promise<void>;
  stopVideo(): Promise<void>;
  setVideoQuality(quality: VideoQuality): void;
  enableBackgroundBlur(enabled: boolean): Promise<void>;
}

interface VideoQuality {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
}
```

### Data Model

```typescript
interface VideoParticipant {
  odId: string;
  displayName: string;
  avatarUrl?: string;
  isVideoEnabled: boolean;
  isBackgroundBlurred?: boolean;
  videoQuality?: VideoQuality;
}
```

## Feature Scope

### In Scope
- Camera selection dropdown
- Toggle video on/off with preview
- Grid video layout (1-25 participants)
- Adaptive video quality
- Mute/unmute indicators on video tiles
- Speaking indicator overlay on video tiles

### Out of Scope (v1)
- Background blur (P2, requires ML model)
- Screen share (separate PRD #3)
- Picture-in-picture mode
- Video recording

## Dependencies

- PR #17 (WebRTC voice infrastructure)
- `nokhwa` crate or browser `getUserMedia` for camera capture
- Existing signaling server from voice infrastructure

## Open Questions

- Should we use a separate WebRTC peer connection per video participant, or a centralized Selective Forwarding Unit (SFU)? For v1, mesh (P2P) is simpler but won't scale past ~6 users.
- Do we have an existing signaling server, or does that need to be built?
- Privacy: should video streams bypass the server entirely (E2E encrypted)?

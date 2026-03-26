# PRD: Screen & Application Sharing

## Overview

**Priority**: P1 (High)
**Timeline**: 4-6 weeks
**Owner**: Desktop Team

Implement screen and application window sharing for voice channels, enabling Hearth Desktop to compete with Discord's Go Live screen share feature.

## Problem Statement

Discord's screen sharing is one of its most-used features for gaming, remote work, and live demos. Hearth Desktop has WebRTC voice infrastructure (#17) but no screen share capability. Without this, users must fall back to Discord for any screen sharing workflow.

**Current Gap**: Discord supports full desktop screen share, individual window share, and tab share with quality selection. Hearth Desktop has zero screen share implementation.

## User Stories

- As a user, I want to share my screen in a voice channel so colleagues can see my work
- As a user, I want to share a specific application window so I don't expose my entire desktop
- As a user, I want to control screen share quality so I can conserve bandwidth
- As a user, I want to see who's currently sharing their screen so I know who to follow

## Technical Approach

### Tauri Screen Capture APIs

Use Tauri's `tauri-plugin-capacitor` or native Rust screen capture:

```rust
// src-tauri/src/commands/screen_share.rs
use tauri::command;
use nokhwa::CaptureSession;  // cross-platform screen capture

#[command]
async fn start_screen_share(channel_id: String) -> Result<String, String> {
    // Initialize screen capture via nokhwa (Linux/macOS/Windows)
    // Use WebRTC to broadcast the screen stream to voice channel peers
    // Stream via the existing WebRTC infrastructure from #17
}
```

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  Svelte Frontend                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ SharePicker │  │ QualityCtrl │  │ ShareTile   │  │
│  │ (window     │  │ (bitrate,   │  │ (active     │  │
│  │  selector)  │  │  resolution)│  │  sharer)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │          │
│  ┌──────▼────────────────▼────────────────▼──────┐  │
│  │  ScreenShareStore (Svelte)                     │  │
│  └──────────────────┬───────────────────────────┘  │
└─────────────────────┼────────────────────────────────┘
                      │ Tauri invoke
┌─────────────────────▼────────────────────────────────┐
│  Rust Backend                                        │
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ screen_capture  │  │ WebRTC Pipeline         │  │
│  │ (nokhwa)        │──│ (from #17)              │  │
│  │                 │  │                         │  │
│  └─────────────────┘  └─────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Key Components

1. **Source Picker UI** — Modal listing available screens/windows (using `tauri-plugin-window-state` + native dialogs)
2. **Screen Capture Engine** — nokhwa for cross-platform capture; xdg-desktop-portal on Linux for Wayland
3. **WebRTC Integration** — Hook into existing WebRTC voice pipeline from PR #17 to relay screen frames
4. **Quality Controls** — Bitrate slider (500kbps–8mbps), resolution selector (720p/1080p/4K), FPS cap (15/30/60)
5. **Share Tile UI** — Floating overlay showing who's sharing; click to focus

### API / Commands

```typescript
// Frontend API (src/lib/api/screenShare.ts)
interface ScreenShareAPI {
  enumerateSources(): Promise<DesktopSource[]>;   // screens + windows
  startShare(sourceId: string, quality: ShareQuality): Promise<void>;
  stopShare(): Promise<void>;
  setQuality(quality: ShareQuality): void;        // dynamic adjustment
}
```

### Data Model

```typescript
interface DesktopSource {
  id: string;
  name: string;
  type: 'screen' | 'window';
  thumbnail?: string;  // base64 preview
}

interface ShareQuality {
  width: number;      // e.g. 1920
  height: number;     // e.g. 1080
  fps: number;        // e.g. 30
  bitrate: number;    // e.g. 4_000_000
}
```

## Feature Scope

### In Scope
- Enumerate screens and windows as shareable sources
- Full screen share
- Individual window share
- Quality controls (bitrate, resolution, FPS)
- Visual indicator of active sharer in voice channel
- Stop sharing controls

### Out of Scope (v1)
- Application audio sharing (sound from shared window)
- Multi-user simultaneous sharing (one at a time)
- Share preview before going live
- Screenshot capture standalone feature

## Dependencies

- PR #17 (WebRTC voice infrastructure) — reuse WebRTC pipeline
- Tauri 2.x with `nokhwa` crate for screen capture
- `tauri-plugin-dialog` for native source picker (or custom Svelte picker)

## Testing Plan

- Unit: capture pipeline encodes frames at target bitrate
- Integration: screen share connects and streams to 2+ peers
- Manual: Wayland + X11 + macOS + Windows tested by QA

## Open Questions

- Wayland screen capture requires xdg-desktop-portal on Linux — does Tauri support this gracefully?
- Should we use WebRTC DataChannel or a separate MediaStream track for screen frames?
- Do we need a "raise hand" equivalent for screen share requests?

# PRD #12: In-Game Overlay System

**Status**: Not Started
**Priority**: P0 (Critical - Discord's killer feature)
**Owner**: Engineering Team
**Created**: 2026-03-28
**Updated**: 2026-03-28

---

## Problem Statement

Gaming communities rely heavily on Discord's in-game overlay for voice controls, chat, and social interaction during gameplay. Without an overlay system, Hearth Desktop cannot compete effectively in the gaming market, which represents a significant portion of Discord's user base.

**Current Gap**: Users must alt-tab out of games to interact with Hearth Desktop, breaking immersion and causing performance issues in full-screen games.

## Goals & Success Metrics

### Primary Goals
- Enable voice controls (mute, deafen, PTT) without leaving full-screen applications
- Display chat notifications and messages during gameplay
- Show voice channel participants and speaking indicators
- Provide screenshot capture and instant sharing capabilities

### Success Metrics
- 90%+ of gaming users enable and actively use overlay
- <5ms latency impact on game performance
- Works with 95% of popular gaming titles (Steam Top 100)
- Zero crashes or conflicts with anti-cheat systems

## User Stories

### Core Stories
1. **As a gamer**, I want to mute/unmute my microphone during gameplay without alt-tabbing
2. **As a team player**, I want to see who's speaking in voice chat with visual indicators
3. **As a community member**, I want to receive and respond to important messages without leaving my game
4. **As a content creator**, I want to capture and share screenshots instantly to my community

### Advanced Stories
1. **As a competitive player**, I want minimal performance impact with configurable overlay elements
2. **As a streamer**, I want overlay elements positioned to avoid blocking stream content
3. **As a casual gamer**, I want simple on/off toggle for the entire overlay system

## Functional Requirements

### Core Overlay Features
- **Voice Controls HUD**: Mute, deafen, PTT status, volume controls
- **Voice Participants**: List of channel members with speaking indicators
- **Chat Notifications**: Popup notifications for @mentions and DMs
- **Screenshot Capture**: Global hotkey for capture + instant sharing
- **Settings Panel**: In-overlay settings for position, opacity, size

### Technical Requirements
- **Cross-Platform**: Windows (DX9/11/12), macOS (Metal), Linux (Vulkan/OpenGL)
- **Performance**: <1% CPU/GPU overhead, <10MB RAM usage
- **Injection Method**: Window layering (not process injection for anti-cheat compatibility)
- **Detection**: Automatic full-screen application detection
- **Positioning**: Drag-and-drop positioning with snap-to-corners

### Integration Requirements
- **Hotkey System**: Integrate with global hotkey manager
- **WebRTC Pipeline**: Connect to existing voice infrastructure
- **Chat System**: Real-time message notifications from text channels
- **Screen Capture**: Leverage existing screen sharing infrastructure

## Technical Design

### Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Game Process  │    │  Overlay Window │
│                 │    │                 │
│  [Full Screen]  │    │  [Always On Top │
│                 │    │   Transparent]  │
└─────────────────┘    └─────────────────┘
         │                       │
         └──────── Z-Order ──────┘
```

### Implementation Strategy
1. **Window Manager**: Tauri transparent window with `set_always_on_top(true)`
2. **Game Detection**: Process monitoring for full-screen applications
3. **Render Pipeline**: Hardware-accelerated WebGL for smooth animations
4. **Event Handling**: Global input capture with game passthrough

### Tauri-Specific Advantages
- **Native Performance**: Rust backend vs Electron's Node.js overhead
- **Security**: No process injection required (better anti-cheat compatibility)
- **Memory Efficiency**: Lower memory footprint than Discord's overlay
- **Hardware Access**: Direct GPU access for better performance

## UI/UX Design

### Layout Options
1. **Compact Mode**: Minimal voice status in corner
2. **Extended Mode**: Voice participants + chat panel
3. **Custom Mode**: User-configurable widget placement

### Visual Design
- **Theme Support**: Match Hearth Desktop's dark/light themes
- **Opacity Control**: 30-90% opacity range for visibility balance
- **Animations**: Smooth fade in/out, speaking indicators
- **Accessibility**: High contrast mode, scalable fonts

## Implementation Plan

### Phase 1: Foundation (Sprint 1-2)
- **T-OVERLAY-01**: Implement Tauri transparent overlay window system
- **T-OVERLAY-02**: Build full-screen application detection
- **T-OVERLAY-03**: Create basic voice controls widget (mute/deafen/PTT status)
- **T-OVERLAY-04**: Integrate with existing global hotkey system

### Phase 2: Core Features (Sprint 3-4)
- **T-OVERLAY-05**: Add voice participants list with speaking indicators
- **T-OVERLAY-06**: Implement chat notifications system
- **T-OVERLAY-07**: Build overlay settings panel with positioning controls
- **T-OVERLAY-08**: Add screenshot capture integration

### Phase 3: Polish & Performance (Sprint 5-6)
- **T-OVERLAY-09**: Performance optimization and GPU acceleration
- **T-OVERLAY-10**: Comprehensive game compatibility testing
- **T-OVERLAY-11**: Anti-cheat system compatibility verification
- **T-OVERLAY-12**: Cross-platform testing (Windows, macOS, Linux)

### Phase 4: Advanced Features (Future)
- **T-OVERLAY-13**: Custom widget system for third-party integrations
- **T-OVERLAY-14**: Multi-monitor overlay support
- **T-OVERLAY-15**: Game-specific overlay profiles and automation

## Risk Assessment

### Technical Risks
- **Anti-cheat Compatibility**: Some games may block overlay windows
  - *Mitigation*: Use window layering instead of process injection
- **Performance Impact**: Overlay could affect game FPS
  - *Mitigation*: GPU acceleration and strict performance budgets
- **Platform Differences**: Different behavior across Windows/macOS/Linux
  - *Mitigation*: Platform-specific testing and fallbacks

### Market Risks
- **User Adoption**: Users may prefer Discord's mature overlay
  - *Mitigation*: Focus on performance advantages and unique features
- **Game Developer Relations**: Potential conflicts with game developers
  - *Mitigation*: Open communication and non-intrusive implementation

## Dependencies

### Technical Dependencies
- Global hotkey system (already implemented)
- WebRTC voice pipeline (already implemented)
- Screen capture system (in progress - PRD #3)
- Chat message system (implemented)

### Platform Dependencies
- **Windows**: DWM (Desktop Window Manager) API
- **macOS**: Core Graphics and Window Server
- **Linux**: X11/Wayland compositor support

## Success Definition

### MVP Criteria
- Voice controls accessible during full-screen gameplay
- Works with top 20 Steam games without conflicts
- <2% performance impact on modern gaming hardware
- User-friendly positioning and configuration system

### Long-term Success
- Becomes preferred overlay for Hearth Desktop gaming communities
- Differentiation point against Discord for performance-conscious users
- Foundation for future gaming-focused features (game integration, streaming tools)

---

**Next Steps**: Begin Phase 1 implementation with T-OVERLAY-01 through T-OVERLAY-04
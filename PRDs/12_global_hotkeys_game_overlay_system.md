# PRD: Global Hotkeys & Game Overlay System

## Overview

**Priority**: P0 (Critical)
**Timeline**: 8-10 weeks
**Owner**: Native/Frontend Team

Implement global hotkey support and in-game overlay system to compete with Discord's gaming-focused features, enabling Hearth Desktop to capture the critical gaming communication market.

## Problem Statement

Hearth Desktop currently lacks system-wide hotkey support and gaming overlay functionality. This prevents users from:
- Using push-to-talk while gaming or in other applications
- Accessing voice controls during fullscreen games
- Managing voice settings without alt-tabbing out of games
- Competing effectively with Discord for gaming communities

**Current Gap**: Discord has mature global hotkey system with push-to-talk, mute/unmute, and deafen controls that work regardless of application focus, plus an in-game overlay with voice controls and chat.

## Success Metrics

- **Gaming Adoption**: 80% of gaming users configure push-to-talk hotkeys
- **Overlay Usage**: 60% of users enable game overlay when available
- **Hotkey Reliability**: 99.9% hotkey recognition accuracy
- **Performance Impact**: <2% CPU overhead during gaming
- **Latency**: <50ms hotkey response time

## User Stories

### Global Hotkeys
- As a gamer, I want push-to-talk hotkeys that work in any game so I can communicate without alt-tabbing
- As a user, I want customizable mute/unmute hotkeys so I can quickly control audio during calls
- As a user, I want configurable hotkey combinations so I can avoid conflicts with games/apps
- As a power user, I want multiple PTT keys for different channels so I can manage complex conversations

### Game Overlay
- As a gamer, I want an in-game overlay showing voice activity so I can see who's talking
- As a gamer, I want overlay voice controls so I can adjust settings without leaving the game
- As a streamer, I want overlay text chat so I can communicate while streaming
- As a competitive gamer, I want minimal overlay impact on performance so my gameplay isn't affected

## Technical Requirements

### Global Hotkey System (Rust/Tauri)

- **Hotkey Registration**
  - System-wide hotkey capture using OS APIs
  - Support for complex key combinations (Ctrl+Shift+T, etc.)
  - Conflict detection with existing system hotkeys
  - Dynamic hotkey registration/unregistration

- **Push-to-Talk Implementation**
  - Low-latency PTT activation (<50ms)
  - Multiple PTT key support (primary, secondary)
  - PTT mode switching (toggle vs. hold-to-talk)
  - Visual/audio PTT feedback

- **Audio Control Hotkeys**
  - Global mute/unmute toggle
  - Deafen/undeafen toggle
  - Volume adjustment hotkeys
  - Audio device switching hotkeys

### Game Overlay System

- **Overlay Rendering**
  - DirectX/OpenGL hook injection for fullscreen games
  - Hardware-accelerated overlay rendering
  - Configurable overlay positioning
  - FPS-optimized overlay updates (60+ FPS)

- **Overlay UI Components**
  - Voice activity indicators with user avatars
  - Mute/unmute controls
  - Volume sliders
  - Minimal text chat interface
  - Settings access

- **Game Detection**
  - Automatic fullscreen game detection
  - Game process whitelist/blacklist
  - Performance monitoring during overlay use
  - Anti-cheat compatibility checks

## Technical Specifications

### Global Hotkey Implementation

```rust
// Global hotkey manager using platform-specific APIs
use global_hotkey::{GlobalHotKeyManager, HotKey, Code, Modifier};

#[derive(Debug, Clone)]
pub struct HotkeyConfig {
    pub id: String,
    pub modifiers: Vec<Modifier>,
    pub key: Code,
    pub action: HotkeyAction,
}

#[derive(Debug, Clone)]
pub enum HotkeyAction {
    PushToTalk,
    ToggleMute,
    ToggleDeafen,
    VolumeUp,
    VolumeDown,
}

// Platform-specific implementations
#[cfg(target_os = "windows")]
mod windows_hotkeys {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        RegisterHotKey, UnregisterHotKey, MOD_CONTROL, MOD_SHIFT
    };
}

#[cfg(target_os = "macos")]
mod macos_hotkeys {
    use cocoa::appkit::{NSEvent, NSEventMask};
}

#[cfg(target_os = "linux")]
mod linux_hotkeys {
    use x11::xlib::{XGrabKey, XUngrabKey, XKeysymToKeycode};
}
```

### Game Overlay Architecture

```rust
// Overlay injection system
pub struct GameOverlay {
    pub enabled: bool,
    pub position: OverlayPosition,
    pub components: Vec<OverlayComponent>,
    pub game_process: Option<GameProcess>,
}

#[derive(Debug, Clone)]
pub struct OverlayPosition {
    pub x: f32,
    pub y: f32,
    pub anchor: OverlayAnchor, // TopLeft, TopRight, BottomLeft, BottomRight
}

#[cfg(target_os = "windows")]
mod windows_overlay {
    use windows::Win32::Graphics::Direct3D11::*;
    use windows::Win32::Graphics::Dxgi::*;
}

// Cross-platform overlay rendering
trait OverlayRenderer {
    fn initialize(&mut self, target_window: WindowHandle) -> Result<()>;
    fn render_frame(&mut self, components: &[OverlayComponent]) -> Result<()>;
    fn cleanup(&mut self) -> Result<()>;
}
```

### Performance Requirements

- **Hotkey Latency**: <50ms from key press to action
- **Overlay FPS**: Maintain 60+ FPS with minimal game impact
- **CPU Overhead**: <2% CPU usage during normal operation
- **Memory Usage**: <50MB RAM for overlay system
- **Game Compatibility**: 90% compatibility with popular games

## Implementation Phases

### Phase 1: Global Hotkey Foundation (4 weeks)
- Cross-platform hotkey registration system
- Basic push-to-talk implementation
- Hotkey conflict detection and resolution
- Settings UI for hotkey configuration
- Audio device control integration

### Phase 2: Advanced Hotkey Features (2 weeks)
- Multiple PTT keys support
- Toggle vs. hold-to-talk modes
- Audio feedback for hotkey actions
- Hotkey profiles for different games/apps
- Emergency mute/unmute functionality

### Phase 3: Game Overlay Core (4 weeks)
- Game detection and process monitoring
- Basic overlay injection for DirectX/OpenGL
- Voice activity indicator overlay
- Overlay positioning and configuration
- Performance optimization and testing

### Phase 4: Overlay Enhancement (2 weeks)
- Advanced overlay UI components
- Text chat overlay interface
- Settings panel within overlay
- Anti-cheat compatibility testing
- Game-specific overlay optimizations

## Platform-Specific Considerations

### Windows
- **API**: Win32 RegisterHotKey, DirectX overlay injection
- **Privileges**: May require elevated permissions for some games
- **Anti-cheat**: BattlEye, EasyAntiCheat compatibility testing
- **Performance**: Windows Game Mode integration

### macOS
- **API**: Cocoa NSEvent global monitoring, Metal overlay
- **Permissions**: Accessibility permissions required
- **Security**: System Integrity Protection considerations
- **Performance**: Metal Performance Shaders for overlay

### Linux
- **API**: X11/Wayland hotkey capture, OpenGL overlay
- **Display Server**: X11 and Wayland compatibility
- **Permissions**: May require root for global hotkeys
- **Performance**: Mesa driver optimization

## Security Considerations

- **Privilege Escalation**: Minimize required permissions
- **Anti-cheat Compatibility**: Whitelist overlay process
- **Input Security**: Secure hotkey registration to prevent hijacking
- **Process Injection**: Safe overlay injection without triggering security software

## Dependencies

- **Audio System**: Integration with existing WebRTC pipeline
- **Settings System**: Persistent hotkey configuration storage
- **UI Framework**: Overlay rendering system
- **Game Database**: Game detection and compatibility database

## Risks and Mitigations

### Technical Risks
- **Anti-cheat False Positives**
  - *Mitigation*: Work with anti-cheat vendors for whitelisting
- **Platform API Changes**
  - *Mitigation*: Abstract platform-specific code, maintain compatibility layers
- **Performance Impact on Games**
  - *Mitigation*: Extensive performance testing, configurable overlay quality

### Product Risks
- **User Configuration Complexity**
  - *Mitigation*: Smart defaults, preset configurations for popular games
- **Game Compatibility Issues**
  - *Mitigation*: Comprehensive game testing, user-reported compatibility database

## Success Criteria

### MVP Definition
- Global push-to-talk hotkey working across all platforms
- Basic mute/unmute hotkey functionality
- Simple voice activity overlay for fullscreen games
- Hotkey configuration interface
- Game detection for overlay activation

### Full Feature Success
- 99.9% hotkey reliability across all supported platforms
- Overlay compatibility with top 100 Steam games
- <2% performance impact during gaming
- Advanced overlay UI with text chat support
- Anti-cheat compatibility with major gaming services

## Competitive Analysis

### vs Discord Gaming Features
- **Matching**: Global hotkeys, game overlay, voice activity indicators
- **Exceeding**: Performance (native Rust vs. Electron), lower resource usage
- **Missing**: Rich presence integration, game store integration

### Differentiation Opportunities
- **Performance**: Significantly lower CPU/RAM usage than Discord
- **Customization**: More granular hotkey and overlay configuration
- **Gaming Focus**: Purpose-built for gaming performance optimization
- **Privacy**: Local-first configuration without data collection

## Future Enhancements

- **Rich Presence Integration**: Game status broadcasting
- **Streaming Integration**: OBS/XSplit overlay controls
- **Voice Processing**: Real-time noise suppression overlay controls
- **Multi-game Support**: Game-specific overlay configurations
- **Mobile Companion**: Remote overlay control via mobile app
- **AI Integration**: Context-aware hotkey suggestions
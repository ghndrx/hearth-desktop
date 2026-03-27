# PRD: Global Hotkeys and Keyboard Shortcuts System

## Overview

**Priority**: P0 (Critical)
**Timeline**: 4-6 weeks
**Owner**: Desktop/Backend Team

Implement comprehensive global hotkey support and application-level keyboard shortcuts to match Discord's accessibility and gaming-focused user experience. This is critical for voice chat usability and competitive gaming scenarios.

## Problem Statement

Hearth Desktop currently lacks global hotkey support, making it unusable for:
- Push-to-talk during fullscreen games
- Quick mute/deafen without app focus
- Rapid navigation and channel switching
- Accessibility for users who rely on keyboard navigation

Discord users expect these shortcuts to work system-wide, making this a P0 feature gap.

## Goals

### Primary Goals
- **Global push-to-talk** with configurable activation keys
- **System-wide mute/deafen shortcuts** that work in fullscreen apps
- **Application-level navigation shortcuts** (Ctrl+K quick switcher, etc.)
- **Customizable keybinding management** with conflict detection
- **Cross-platform compatibility** (Windows, macOS, Linux)

### Success Metrics
- 95% global hotkey reliability across all platforms
- <50ms latency from hotkey press to action
- Zero conflicts with popular games (LoL, Valorant, CS2, Fortnite)
- 90% user adoption of push-to-talk within 30 days

## Technical Requirements

### Global Hotkey System
```rust
// Tauri command structure
#[tauri::command]
async fn register_global_hotkey(
    hotkey: String,           // "ctrl+shift+m"
    action: HotkeyAction,     // Mute, Deafen, PushToTalk, etc.
    app_handle: AppHandle
) -> Result<(), String>

#[tauri::command]
async fn unregister_global_hotkey(hotkey: String) -> Result<(), String>
```

### Required Hotkey Actions
- **Voice Controls**: Push-to-talk, toggle mute, toggle deafen, toggle voice activation
- **Navigation**: Quick switcher (Ctrl+K), guild navigation (Ctrl+Shift+Arrow)
- **Utility**: Toggle overlay, screenshot capture, start/stop recording

### Platform-Specific Implementation

**Windows**:
- Use `RegisterHotKey` Win32 API via Tauri
- Support for modifier keys: Ctrl, Alt, Shift, Win
- Handle exclusive fullscreen applications

**macOS**:
- Use `CGEventTapCreate` for global event monitoring
- Request accessibility permissions
- Support Cmd key combinations

**Linux**:
- X11: Use `XGrabKey`
- Wayland: Use `wlr-foreign-toplevel-management` protocol
- Handle different desktop environments (GNOME, KDE, etc.)

### Keybinding Management System
```typescript
interface Keybinding {
  id: string;
  action: HotkeyAction;
  keys: string[];          // ["ctrl", "shift", "m"]
  global: boolean;         // true = system-wide, false = app-only
  enabled: boolean;
  conflicts?: string[];    // conflicting applications
}
```

## User Experience

### Settings UI
- **Keybinding configuration page** with search and categorization
- **Conflict detection** with warnings for overlapping shortcuts
- **Recording interface** for easy key combination capture
- **Test mode** to validate hotkeys work correctly
- **Import/export** keybinding profiles

### Default Keybindings
```
Global:
- Ctrl+Shift+M: Toggle Mute
- Ctrl+Shift+D: Toggle Deafen
- F13-F24: Push-to-Talk options (gaming keyboards)

Application:
- Ctrl+K: Quick Switcher
- Ctrl+Shift+A: Toggle overlay
- Ctrl+/: Keyboard shortcuts help
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)
- Set up Tauri hotkey registration system
- Implement basic global hotkey detection
- Create keybinding data models and storage

### Phase 2: Voice Integration (Week 3-4)
- Integrate with existing WebRTC voice system
- Implement push-to-talk, mute, deafen actions
- Add voice activation sensitivity controls

### Phase 3: Navigation & UI (Week 5-6)
- Build keybinding settings interface
- Implement application-level shortcuts
- Add conflict detection and resolution

## Dependencies

- **WebRTC Voice System** (PR #17) - required for voice control actions
- **Tauri Plugins**: `tauri-plugin-global-shortcut` or custom implementation
- **Permission System**: Accessibility permissions on macOS/Linux

## Risk Mitigation

### Technical Risks
- **Anti-cheat compatibility**: Test with BattlEye, EasyAntiCheat, Vanguard
- **Permission requirements**: Graceful degradation when permissions denied
- **Platform differences**: Unified API across Windows/macOS/Linux

### Security Considerations
- **Keylogger detection**: Ensure hotkey system doesn't trigger security software
- **Privilege escalation**: No elevated permissions required for basic functionality
- **Input isolation**: Don't capture sensitive input like passwords

## Post-Launch Optimization

- **Machine learning**: Adaptive hotkey suggestions based on usage patterns
- **Game profiles**: Automatic keybinding switching per detected game
- **Gesture support**: Mouse gestures for additional shortcuts
- **Voice commands**: "Alexa, mute Discord" style integration

## Competitive Analysis

**Discord Advantages**:
- Mature global hotkey system with 8+ years of refinement
- Extensive game compatibility testing
- Rich customization options

**Hearth Advantages**:
- Tauri's performance benefits for low-latency input handling
- Modern architecture allows for innovative features like gesture support
- Cross-platform consistency from day one
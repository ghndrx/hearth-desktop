# PRD #12: Global Hotkeys System

**Status**: Draft
**Priority**: P0 — Critical
**Assignee**: TBD
**Estimated effort**: 2-3 sprints
**Depends on**: Core desktop infrastructure

## Problem Statement

Hearth Desktop lacks global hotkey support, making it inferior to Discord for gaming and professional use. Users need push-to-talk, mute toggles, and other shortcuts that work even when the app isn't focused. This is essential for seamless communication during gaming, screen sharing, or when working in other applications.

## Success Criteria

- [ ] Push-to-talk (PTT) functionality works globally, even in full-screen games
- [ ] Mute/unmute toggle works from any application
- [ ] Deafen toggle for complete audio isolation
- [ ] Custom hotkey binding UI with conflict detection
- [ ] Works across Windows, macOS, and Linux
- [ ] Low latency (< 50ms) hotkey response
- [ ] Proper permission handling for global input capture

## Requirements

### Functional Requirements

**Global Hotkey Registration**
- Register system-wide hotkey combinations (Ctrl+Shift+M, F13, etc.)
- Support modifier keys: Ctrl, Shift, Alt/Option, Win/Cmd
- Support function keys (F1-F24) and special keys
- Handle hotkey conflicts with graceful fallbacks
- Persistent hotkey settings across app restarts

**Core Hotkey Functions**
- **Push-to-Talk (PTT)**: Hold key to transmit, release to stop
- **Mute Toggle**: Toggle microphone on/off with single press
- **Deafen Toggle**: Toggle audio output (hear others) on/off
- **Quick Join Voice**: Join last/favorite voice channel
- **Show/Hide Window**: Bring app to foreground or minimize to tray

**Hotkey Configuration UI**
- Visual hotkey binding interface with key combination detection
- Conflict detection with system/other app hotkeys
- Test functionality to verify hotkeys work
- Import/export hotkey profiles
- Reset to defaults option

### Non-Functional Requirements

**Performance**
- Hotkey response latency < 50ms for critical functions (PTT, mute)
- Minimal CPU/battery impact from global input monitoring
- Efficient event handling without blocking UI thread

**Compatibility**
- Windows: RegisterHotKey API + low-level keyboard hooks
- macOS: CGEventTap with accessibility permissions
- Linux: X11/Wayland global shortcuts support
- Graceful degradation if permissions denied

**Security**
- Proper permission requesting flow for input monitoring
- Secure handling of global input events
- No keylogging or sensitive data capture

## Technical Specification

### Architecture Overview

```
Tauri Frontend (Svelte) ←→ Tauri Commands ←→ Global Hotkey Manager
                                                        ↓
                                             OS-Specific Handlers
                                        (Windows/macOS/Linux)
                                                        ↓
                                             Voice/UI Controllers
```

### Tauri Commands

```rust
// Register a global hotkey
#[tauri::command]
async fn register_global_hotkey(
    id: String,
    key_combo: KeyCombination,
    action: HotkeyAction
) -> Result<(), String>

// Unregister hotkey
#[tauri::command]
async fn unregister_global_hotkey(id: String) -> Result<(), String>

// Get available hotkeys and their status
#[tauri::command]
async fn get_hotkey_status() -> Result<Vec<HotkeyInfo>, String>

// Test if hotkey combination is available
#[tauri::command]
async fn test_hotkey_available(key_combo: KeyCombination) -> Result<bool, String>
```

### Data Models

```typescript
interface KeyCombination {
  key: string;           // Primary key (A-Z, F1-F24, Space, etc.)
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;         // Windows/Cmd key
}

interface HotkeyAction {
  type: 'push_to_talk' | 'toggle_mute' | 'toggle_deafen' | 'show_window' | 'join_voice';
  parameters?: any;      // Action-specific parameters
}

interface HotkeyInfo {
  id: string;
  combination: KeyCombination;
  action: HotkeyAction;
  active: boolean;
  last_triggered?: Date;
}
```

### Platform Implementation

**Windows Implementation**
- Use `tauri-plugin-global-shortcut` for basic functionality
- Fall back to low-level keyboard hooks via `windows-rs` for PTT
- Handle modifier key detection and combination parsing
- Proper cleanup on app exit

**macOS Implementation**
- Request accessibility permissions for global input monitoring
- Use CGEventTap for low-level keyboard events
- Implement modifier key state tracking
- Handle permission denied gracefully

**Linux Implementation**
- X11: Use XGrabKey for global shortcut registration
- Wayland: Use desktop portals for global shortcuts
- Handle both environments with runtime detection
- Fallback UI for unsupported configurations

### Dependencies

**New Rust Crates**
```toml
tauri-plugin-global-shortcut = "2"
rdev = "0.25"                     # Cross-platform input monitoring
winapi = { version = "0.3", features = ["winuser"], target_os = "windows" }
core-graphics = { version = "0.23", target_os = "macos" }
x11 = { version = "2.21", target_os = "linux" }
```

**Frontend Dependencies**
```json
{
  "@tauri-apps/plugin-global-shortcut": "^2.0.0"
}
```

## Implementation Plan

### Phase 1: Core Infrastructure (Sprint 1)
- Set up global hotkey manager with OS detection
- Implement basic hotkey registration for Windows
- Add Tauri command interface
- Build simple test UI for hotkey capture

### Phase 2: Cross-Platform Support (Sprint 1-2)
- Implement macOS hotkey handling with permission flow
- Add Linux support (X11 + Wayland)
- Handle permission requests and error states
- Cross-platform testing

### Phase 3: Voice Integration (Sprint 2)
- Integrate PTT with existing voice infrastructure
- Implement mute/deafen toggle functionality
- Add audio feedback for hotkey actions
- Test with real voice channels

### Phase 4: Advanced Features (Sprint 2-3)
- Build hotkey configuration UI
- Add conflict detection and resolution
- Implement hotkey profiles and persistence
- Add import/export functionality

### Phase 5: Polish & Testing (Sprint 3)
- Performance optimization and latency testing
- Comprehensive platform testing
- Security review for input handling
- Documentation and user onboarding

## Testing Strategy

**Functional Testing**
- Test each hotkey function across all platforms
- Verify hotkeys work in various applications (games, browsers, etc.)
- Test conflict detection with system shortcuts
- Validate permission handling flows

**Performance Testing**
- Measure hotkey response latency (target < 50ms)
- Monitor CPU usage during global input monitoring
- Test battery impact on mobile devices
- Stress test with multiple simultaneous hotkeys

**Security Testing**
- Verify no sensitive keystrokes are logged
- Test permission boundary enforcement
- Validate secure cleanup of event handlers
- Review for potential privilege escalation

## Success Metrics

- **Adoption**: 80%+ of voice users configure at least one global hotkey
- **Performance**: < 50ms average latency for PTT activation
- **Reliability**: < 1% hotkey failure rate across platforms
- **User Satisfaction**: 4.5+ rating for hotkey functionality

## Risks & Mitigations

**Technical Risks**
- *Permission Denial*: Graceful fallback to in-app shortcuts only
- *Platform Compatibility*: Comprehensive testing matrix, fallback implementations
- *Performance Impact*: Optimize event handling, configurable monitoring levels

**User Experience Risks**
- *Complex Configuration*: Simple defaults, guided setup wizard
- *Hotkey Conflicts*: Smart conflict detection, suggested alternatives

## Related Work

- Discord: Global PTT, mute toggles, customizable shortcuts
- TeamSpeak: Advanced PTT with voice activation detection
- Slack: Basic global shortcuts for show/hide

## Future Considerations

- Voice activation detection (hands-free PTT alternative)
- Advanced hotkey sequences (chord combinations)
- Integration with game detection for automatic PTT
- Hotkey analytics and usage optimization
# PRD #12: Global Hotkeys & Push-to-Talk System

**Status**: Competitive Gap Analysis
**Priority**: P0 (Critical for voice chat parity with Discord)
**Complexity**: High
**Dependencies**: Advanced Voice Controls System (#11)

## Problem Statement

Discord's competitive advantage lies in its system-wide hotkeys that work even when the app is not focused. Users can control voice without breaking their workflow during gaming, work presentations, or other focused tasks. Hearth Desktop currently lacks global hotkey support, making it unsuitable for gaming and professional voice chat scenarios where instant voice control is critical.

## Success Metrics

- [ ] Global hotkeys work system-wide (even when Hearth is not focused)
- [ ] Sub-100ms latency from hotkey press to voice state change
- [ ] Support for complex key combinations (Ctrl+Shift+T, F13, etc.)
- [ ] Zero conflicts with other applications' hotkeys
- [ ] Graceful permission handling across all platforms

## User Stories

### Gaming Scenario
**As a** gamer using Hearth for team voice chat
**I want** to quickly mute/unmute and push-to-talk without Alt-Tabbing
**So that** I can communicate without breaking immersion or losing competitive advantage

### Work Scenario
**As a** remote worker in a Hearth voice channel during screen sharing
**I want** to instantly mute when someone enters my office
**So that** I can maintain professionalism without scrambling for the app

### Power User Scenario
**As a** frequent voice chat user
**I want** to customize hotkey combinations per function
**So that** they don't conflict with my other productivity software

## Technical Architecture

### Platform Integration
- **Windows**: RegisterHotKey API with low-level keyboard hooks
- **macOS**: Carbon HotKey API with accessibility permissions
- **Linux**: X11 XGrabKey + Wayland global shortcuts portal

### Tauri Implementation
```rust
// src-tauri/src/hotkeys.rs
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub async fn register_push_to_talk(
    app: &AppHandle,
    shortcut: &str,
    voice_manager: Arc<VoiceManager>
) -> Result<(), HotkeyError>
```

### Voice Integration Points
- **Push-to-Talk (PTT)**: Hold key to transmit, release to mute
- **Toggle Mute**: Press once to mute/unmute
- **Toggle Deafen**: Press once to deafen/undeafen
- **Leave Voice**: Emergency disconnect hotkey

## Implementation Details

### Phase 1: Core Hotkey Engine
- **T-HOTKEY-01**: Add `tauri-plugin-global-shortcut` dependency
- **T-HOTKEY-02**: Implement hotkey registration/unregistration system
- **T-HOTKEY-03**: Build hotkey conflict detection and resolution
- **T-HOTKEY-04**: Add permission request flow for system access

### Phase 2: Voice Control Integration
- **T-HOTKEY-05**: Integrate with WebRTC voice pipeline (PR #17)
- **T-HOTKEY-06**: Implement push-to-talk state machine (hold/release)
- **T-HOTKEY-07**: Add mute/unmute toggle with visual feedback
- **T-HOTKEY-08**: Implement deafen/undeafen with audio ducking

### Phase 3: User Experience
- **T-HOTKEY-09**: Build hotkey customization UI settings panel
- **T-HOTKEY-10**: Add hotkey status indicators in voice channel UI
- **T-HOTKEY-11**: Implement conflict resolution dialog
- **T-HOTKEY-12**: Add accessibility support for non-keyboard input

## User Interface Design

### Settings Panel
```
┌─ Voice & Audio Settings ──────────────────┐
│                                           │
│ Global Hotkeys                            │
│ ┌─────────────────────────────────────────┤
│ │ Push to Talk:     [Ctrl+Shift+T] [Edit] │
│ │ Toggle Mute:      [Ctrl+M]       [Edit] │
│ │ Toggle Deafen:    [Ctrl+Shift+D] [Edit] │
│ │ Leave Voice:      [Ctrl+Shift+L] [Edit] │
│ └─────────────────────────────────────────┤
│                                           │
│ ☑ Enable global hotkeys                   │
│ ☑ Show hotkey status in tray              │
│ ☐ PTT releases on app focus loss          │
└───────────────────────────────────────────┘
```

### Voice Channel Status
- **Visual Indicator**: Microphone icon changes when PTT is active
- **Tray Integration**: Show PTT status in system tray tooltip
- **Audio Feedback**: Subtle beep on mute/unmute (optional)

## Technical Challenges

### Platform Permissions
- **Windows**: No special permissions required
- **macOS**: Accessibility permission required (Input Monitoring)
- **Linux**: X11 works directly, Wayland requires user grant

### Conflict Resolution
- **Detection**: Scan for existing hotkey registrations
- **Resolution**: Suggest alternative combinations
- **Fallback**: App-focused hotkeys if global registration fails

### Performance Requirements
- **Latency**: <100ms from keypress to voice state change
- **CPU Impact**: <1% additional CPU usage for hotkey monitoring
- **Memory**: <5MB additional memory for hotkey management

## Testing Strategy

### Functional Testing
- [ ] PTT works during fullscreen games
- [ ] Hotkeys persist across app restarts
- [ ] No conflicts with system shortcuts (Ctrl+Alt+Del, etc.)
- [ ] Graceful degradation when permissions denied

### Platform Testing
- [ ] Windows 10/11 with different keyboard layouts
- [ ] macOS Monterey+ with accessibility restrictions
- [ ] Ubuntu/Fedora with X11 and Wayland sessions

### Integration Testing
- [ ] Works alongside Discord/Teams/Slack hotkeys
- [ ] Compatible with gaming keyboards (G-keys, macro keys)
- [ ] Functions during screen sharing sessions

## Security Considerations

### Privacy Protection
- **Key Logging**: No logging of non-Hearth hotkeys
- **Sandboxing**: Hotkey monitoring isolated from main app
- **Permissions**: Clear user consent for global keyboard access

### Attack Surface
- **Input Injection**: Validate all hotkey combinations
- **Privilege Escalation**: No elevated permissions required
- **System Stability**: Graceful failure if hotkey system corrupted

## Migration & Rollback

### Feature Flag
- **Gradual Rollout**: Enable for 10% of users initially
- **A/B Testing**: Compare user engagement with/without hotkeys
- **Monitoring**: Track latency, conflicts, and error rates

### Fallback Strategy
- **Graceful Degradation**: App-focused hotkeys if global fails
- **User Choice**: Allow disabling global hotkeys entirely
- **Legacy Support**: Maintain compatibility with existing voice controls

## Success Metrics & KPIs

### User Engagement
- **Adoption Rate**: % of users who enable global hotkeys
- **Usage Frequency**: Average hotkey activations per voice session
- **Retention**: Improved user retention in voice channels

### Technical Performance
- **Latency**: P95 latency <100ms for voice state changes
- **Reliability**: <1% hotkey registration failure rate
- **Compatibility**: Support for 95% of common keyboard layouts

### Competitive Positioning
- **Feature Parity**: Match Discord's hotkey functionality
- **Performance Advantage**: Lower latency than Discord (Electron overhead)
- **Platform Coverage**: Better Linux support than Discord

---

**Estimated Development Time**: 6-8 weeks
**Required Team**: 2 engineers (Tauri + Voice systems)
**Risk Level**: High (platform-specific system access)
**User Impact**: Critical for power users and gamers
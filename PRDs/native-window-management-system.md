# PRD: Native Window Management & OS Integration System

**Document Status:** Draft
**Priority:** P0 (Critical)
**Target Release:** Q2 2026
**Owner:** Engineering Team
**Stakeholders:** Product, Engineering, UX, Desktop Team

## Problem Statement

Hearth Desktop currently has **15% parity** with Discord's advanced window management and native OS integration features. Users expect modern desktop apps to provide sophisticated window behaviors, overlay capabilities, and seamless OS integration that enhances their workflow rather than disrupting it.

**Current Limitations:**
- No picture-in-picture or overlay mode for voice channels
- Basic single-window design limits multitasking
- Missing always-on-top and pinning capabilities
- No window snapping or docking integration
- Limited workspace/virtual desktop integration
- No transparency or blur effects for modern OS aesthetics

## Success Metrics

**Primary KPIs:**
- 80% of users enable advanced window features within 2 weeks
- 60% increase in app usage during work hours (9AM-5PM)
- 70% reduction in window-related user complaints
- 50% increase in concurrent app usage while gaming

**Technical Metrics:**
- <16ms window composition updates for smooth animations
- Support for all major window managers (Windows, macOS, Linux)
- Zero memory leaks from window state management
- <50ms latency for window state changes

## User Stories

### Core Window Management

**As a multitasker, I want to:**
- Pin chat windows always-on-top while working in other apps
- Use picture-in-picture mode for voice channels during gaming
- Snap Hearth windows to screen edges with native OS snapping
- Have multiple chat windows open simultaneously
- Switch between floating and docked window modes

**As a gamer, I want to:**
- Use overlay mode that appears over full-screen games
- Have voice controls accessible without leaving my game
- See notifications without disrupting game performance
- Quick access to mute/unmute via game overlay

### Advanced OS Integration

**As a power user, I want to:**
- Integrate with virtual desktop/workspace switching
- Use OS-native window transparency and blur effects
- Have Hearth respect focus-assist/do-not-disturb modes
- Custom window behaviors per chat room/server
- Gesture support for window manipulation

**As an accessibility user, I want to:**
- High contrast window borders for visual clarity
- Window state announcements for screen readers
- Keyboard-only window management options
- Customizable window opacity for readability

## Technical Requirements

### Core Window System

**1. Multi-Window Architecture**
```rust
// Tauri backend: src-tauri/src/window_manager.rs
pub struct WindowManager {
    main_window: WebviewWindow,
    floating_windows: HashMap<String, WebviewWindow>,
    overlay_window: Option<WebviewWindow>,
    pip_windows: HashMap<String, WebviewWindow>,
}

pub enum WindowType {
    MainChat,           // Primary application window
    FloatingChannel,    // Detached chat channel
    VoicePiP,          // Picture-in-picture voice
    GameOverlay,       // In-game overlay
    QuickActions,      // Quick action panel
}
```

**2. Window State Management**
```rust
// Tauri backend: src-tauri/src/window_state.rs
pub struct WindowState {
    position: (i32, i32),
    size: (u32, u32),
    opacity: f32,
    always_on_top: bool,
    minimized: bool,
    maximized: bool,
    focused: bool,
    workspace: Option<u32>,
}
```

**3. Overlay System**
```rust
// Tauri backend: src-tauri/src/overlay.rs
- Game detection and overlay injection
- Framerate-aware overlay updates
- Input passthrough management
- Graphics API integration (D3D, OpenGL, Vulkan)
- Anti-cheat compatibility layer
```

**4. Window Composition Effects**
```svelte
<!-- Frontend: src/lib/components/WindowEffectsPanel.svelte -->
- Transparency and blur controls
- Drop shadow configuration
- Window border customization
- Animation preferences
- Theme-aware window styling
```

### Native OS Integration Points

**Windows Platform:**
- Win32 API for advanced window management
- Windows 11 Snap Layouts integration
- Focus Assist API integration
- Windows Hello authentication support
- Taskbar progress and overlay icons

**macOS Platform:**
- Cocoa window management APIs
- Mission Control integration
- Stage Manager compatibility
- Touch Bar support for MacBook Pro
- macOS notification center integration

**Linux Platform:**
- X11 and Wayland window managers
- Compositor effects integration
- Desktop environment specific features
- Global menu bar support
- Virtual desktop switching

## User Experience Design

### Picture-in-Picture Voice Channel
```
┌─────────────────────┐
│ 🔊 General Voice    │
│ ┌─────┐ ┌─────┐     │
│ │ 🟢  │ │ 🔇  │     │
│ │Alice│ │ Bob │     │
│ └─────┘ └─────┘     │
│ [🎤] [🔊] [📞] [⚙️] │
│ Mic  Audio Call Exit│
└─────────────────────┘
    ↳ Floating over game
```

### Game Overlay Interface
```
┌─────────────────────────────────────┐
│                              [⚙️ 📌] │
│                                     │
│        Game Running Here            │
│                                     │
│                      ┌─────────────┐│
│                      │🔊 Squad Chat││
│                      │Alice: Ready?││
│                      │Bob: Go go!  ││
│                      │[Say hello...││
│                      └─────────────┘│
└─────────────────────────────────────┘
```

### Window Snapping Integration
```
Windows Snap Layouts:
┌──────────┬──────────┐
│  Hearth  │  VS Code │
│  Chat    │  Editor  │
├──────────┼──────────┤
│  Browser │  Discord │
│  Research│  Voice   │
└──────────┴──────────┘
```

## Implementation Plan

### Phase 1: Core Multi-Window (Weeks 1-4)
- [ ] Tauri multi-window architecture setup
- [ ] Basic window state persistence
- [ ] Floating channel windows
- [ ] Always-on-top implementation

### Phase 2: Picture-in-Picture (Weeks 5-8)
- [ ] PiP mode for voice channels
- [ ] Minimal UI design for PiP windows
- [ ] Window resize and positioning
- [ ] Cross-platform PiP testing

### Phase 3: Game Overlay (Weeks 9-12)
- [ ] Game detection integration
- [ ] Overlay window creation
- [ ] Input passthrough system
- [ ] Performance optimization for gaming

### Phase 4: Advanced Integration (Weeks 13-16)
- [ ] Native snap layouts support
- [ ] Workspace/virtual desktop integration
- [ ] Window effects and transparency
- [ ] Accessibility compliance testing

## Technical Challenges

### Game Overlay Compatibility
**Challenge:** Overlay injection without triggering anti-cheat
**Solution:**
- Use Tauri's built-in overlay capabilities
- Implement read-only overlay mode for sensitive games
- Whitelist approach with major game publishers
- Fallback to desktop notifications for unsupported games

### Cross-Platform Window Management
**Challenge:** Different window managers across Linux distributions
**Solution:**
- Abstraction layer for window manager APIs
- Runtime detection of window manager capabilities
- Graceful degradation for unsupported features
- Community-driven compatibility testing

### Performance Optimization
**Challenge:** Window composition overhead affecting game performance
**Solution:**
- Leverage hardware-accelerated composition
- Dynamic quality adjustment based on GPU load
- Smart update scheduling outside of frame renders
- Memory-mapped buffers for efficient data transfer

## Success Criteria

### MVP Acceptance Criteria
- [ ] Picture-in-picture voice works across Windows/macOS/Linux
- [ ] Always-on-top pinning functional
- [ ] Basic floating windows implemented
- [ ] Window state persistence working
- [ ] No performance impact on game FPS

### Full Feature Acceptance Criteria
- [ ] Game overlay working with top 50 games
- [ ] Native snap layouts integration
- [ ] Workspace switching compatibility
- [ ] Window transparency and effects
- [ ] Accessibility features complete

## Risk Assessment

**High Risk:**
- Anti-cheat software blocking overlay functionality
- Platform API changes breaking window management
- Performance impact on resource-constrained systems

**Medium Risk:**
- User confusion with complex window management options
- Memory usage increases with multiple windows
- Cross-platform behavioral inconsistencies

**Mitigation Strategies:**
- Extensive compatibility testing with popular games
- Progressive feature rollout with kill switches
- User education and onboarding flows
- Performance monitoring and optimization

## Dependencies

**External:**
- Tauri framework window management APIs
- Platform-specific window manager access
- Graphics driver compatibility
- Game engine cooperation for overlay support

**Internal:**
- Voice chat system for PiP integration
- Theme system for window styling
- Settings system for window preferences
- Performance monitoring infrastructure

## Future Enhancements

**Post-MVP Features:**
- Multi-monitor window placement intelligence
- Window grouping and tabbing
- Gesture-based window manipulation
- AR/VR window placement (future platforms)
- AI-powered window layout suggestions
- Window automation and scripting support

---
**Last Updated:** March 24, 2026
**Next Review:** Weekly Engineering Standup
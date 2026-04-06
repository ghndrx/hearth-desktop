# PRD #05: Advanced Window Management & Gaming Overlay System

**Status:** Draft  
**Priority:** P1 - High  
**Owner:** Desktop Team  
**Created:** 2026-04-06  

## Problem Statement

Hearth Desktop currently operates as a single-window application without advanced window management or gaming overlay capabilities that are essential for modern desktop chat applications. Discord's overlay system and window management features allow users to stay connected while gaming or working in other applications, significantly improving user engagement and stickiness.

Missing capabilities include:
- No always-on-top or picture-in-picture modes for monitoring chat
- No in-game overlay for voice controls and chat access
- Single window constraint limits multi-tasking workflows  
- No floating mini-players for voice channels
- No desktop widget or compact modes
- No cross-application hotkeys for voice controls

## Success Criteria

- [ ] Always-on-top mode keeps Hearth visible over other applications
- [ ] In-game overlay provides voice controls without Alt-Tab switching
- [ ] Picture-in-picture mode for voice channels with minimal UI
- [ ] Floating mini-chat windows for specific channels/DMs
- [ ] Compact mode reduces window size while maintaining functionality
- [ ] Global hotkeys work from any application (push-to-talk, mute/unmute)
- [ ] Multi-monitor support with window positioning memory
- [ ] Seamless transitions between window modes without losing state

## User Stories

### As a gamer, I want...
- Voice controls accessible while playing fullscreen games
- Chat notifications visible without leaving my game
- Push-to-talk that works in any application
- Minimal overlay UI that doesn't obstruct gameplay

### As a multitasking professional, I want...
- Always-on-top mode to monitor team chat while working
- Picture-in-picture voice channel for long meetings
- Compact window mode to save desktop space
- Multiple chat windows for different teams/projects

### As a content creator, I want...
- Overlay controls for managing stream chat while broadcasting
- Voice channel widgets that fit in streaming software layouts
- Global hotkeys that work during recording/streaming

## Technical Requirements

### Window Management Core (Tauri Rust)
- **Window Controller** for creating/managing multiple windows
- **Always-on-Top Handler** using platform-specific APIs
- **Window State Manager** for saving/restoring positions and sizes
- **Multi-Monitor Detection** with positioning logic
- **Focus Management** for proper window layering

### Gaming Overlay System
- **Overlay Renderer** using transparent window techniques
- **Game Detection** for automatic overlay activation
- **Input Intercept** for global hotkeys without stealing focus
- **Performance Optimization** to minimize FPS impact (<5%)
- **Compatibility Layer** for different graphics APIs (DirectX, OpenGL, Vulkan)

### Frontend Components (Svelte)
- **OverlayUI** - Minimal voice controls for gaming
- **PiPPlayer** - Picture-in-picture voice channel interface
- **CompactMode** - Reduced UI for small window sizes
- **FloatingChat** - Draggable mini-chat windows
- **WindowControls** - UI for switching between window modes

### Global Hotkey System
- **HotkeyManager** for registering system-wide shortcuts
- **Action Dispatcher** for executing commands from any app
- **Conflict Detection** to avoid clashing with other applications
- **Customization Engine** for user-defined key combinations

## Acceptance Criteria

### Always-on-Top Mode
- [ ] Window stays visible above all other applications
- [ ] Easy toggle button in main interface
- [ ] Maintains transparency options (50%, 75%, 90%, opaque)
- [ ] Works correctly across Windows, macOS, and Linux

### Gaming Overlay
- [ ] Activates automatically when fullscreen games are detected
- [ ] Shows voice channel participants with speaking indicators
- [ ] Provides mute/unmute and push-to-talk controls
- [ ] Displays incoming chat notifications with 3-second auto-dismiss
- [ ] Overlay can be repositioned via drag-and-drop
- [ ] Performance impact stays below 5% CPU and 2% GPU usage

### Picture-in-Picture Mode
- [ ] Reduces window to 300x200px with essential voice controls
- [ ] Shows speaking participants with avatars
- [ ] Includes volume controls and leave button
- [ ] Maintains connection state when switching to full app
- [ ] Can be pinned to screen corners with snap zones

### Global Hotkeys
- [ ] Push-to-talk works in any application (default: Ctrl+Space)
- [ ] Mute/unmute toggle works globally (default: Ctrl+Shift+M)
- [ ] Show/hide overlay hotkey (default: Ctrl+Shift+O)
- [ ] Quick channel switch (default: Ctrl+Shift+C)
- [ ] All hotkeys are user-customizable with conflict detection

### Multi-Monitor Support
- [ ] Remembers window positions across monitor configurations
- [ ] Supports drag between monitors with position persistence
- [ ] PiP mode snaps to monitor corners intelligently
- [ ] Overlay appears on correct monitor for active game

## Implementation Plan

### Phase 1: Core Window Management (Week 1-2)
- Implement multi-window support in Tauri
- Build always-on-top functionality with transparency controls
- Create window state persistence system
- Add basic picture-in-picture mode

### Phase 2: Global Hotkey System (Week 3-4)  
- Implement system-wide hotkey registration
- Build hotkey customization UI
- Add conflict detection and resolution
- Create action dispatcher for global commands

### Phase 3: Gaming Overlay Foundation (Week 5-7)
- Build overlay window with transparent background
- Implement game detection system
- Create minimal overlay UI components
- Add performance monitoring and optimization

### Phase 4: Advanced Overlay Features (Week 8-10)
- Add automatic overlay activation/deactivation
- Implement overlay positioning and resizing
- Build chat notification system for overlay
- Add graphics API compatibility layers

### Phase 5: Polish & Multi-Monitor (Week 11-12)
- Implement multi-monitor positioning logic
- Add window snap zones and smart positioning
- Build comprehensive window management preferences
- Performance testing and optimization

## Dependencies

- `tauri-plugin-window-state` for window management
- `tauri-plugin-global-shortcut` for hotkey system
- Platform-specific overlay libraries (Windows: DirectX, macOS: Metal, Linux: X11/Wayland)
- Game detection library or process monitoring system
- Graphics API hooks for overlay rendering

## Risks & Mitigations

**Risk:** Antivirus software flagging overlay system as malicious  
**Mitigation:** Code signing, whitelist submissions, transparent communication about overlay purpose

**Risk:** Game performance impact from overlay rendering  
**Mitigation:** Extensive performance testing, optimization, and per-game compatibility profiles

**Risk:** Global hotkeys conflicting with games or other applications  
**Mitigation:** Robust conflict detection, user customization, and fallback options

**Risk:** Cross-platform overlay complexity  
**Mitigation:** Platform-specific implementations with shared UI layer, extensive testing

## Success Metrics

- 80% of gaming users enable overlay within first week
- Always-on-top mode increases session duration by 25%
- Global hotkeys reduce Alt-Tab usage by 60% during voice calls
- Overlay performance impact stays below 5% CPU/GPU usage
- Multi-monitor users report 90% satisfaction with window positioning

## Discord Feature Parity Analysis

Discord's window management includes:
- ✅ Always-on-top mode with transparency
- ✅ Gaming overlay with voice controls
- ✅ Global hotkeys for voice actions  
- ✅ Multi-monitor support
- ❌ Picture-in-picture mode for voice channels
- ❌ Floating mini-chat windows
- ❌ Advanced window snapping and zones
- ❌ Per-application overlay customization

This PRD achieves parity with Discord's core features while adding advanced capabilities like PiP mode and floating chat windows that could provide competitive advantages for power users and content creators.

## Gaming Ecosystem Integration

The overlay system positions Hearth Desktop as a serious gaming communication platform by:
- Supporting all major gaming platforms (Steam, Epic, Battle.net, etc.)
- Minimizing performance impact during competitive gaming
- Providing professional-grade voice controls for esports teams
- Enabling seamless content creation workflows for streamers
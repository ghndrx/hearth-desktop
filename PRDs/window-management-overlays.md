# PRD: Window Management & Overlay System

**Document Status:** Draft
**Priority:** P0 (Critical)
**Target Release:** Q2 2026
**Owner:** Engineering Team
**Stakeholders:** Product, Engineering, UX, Platform Integration

## Problem Statement

Hearth Desktop currently provides only basic window management functionality, representing **25% parity** with Discord's advanced window overlay and management features. Users expect modern desktop communication apps to offer flexible window modes including overlays, always-on-top modes, mini players, and advanced multi-window capabilities. This limitation significantly impacts gaming communities and users who need persistent voice/video access while multitasking.

**Current Limitations:**
- No in-game or application overlay system
- Missing always-on-top window modes
- Basic single-window application design
- No mini player or compact voice channel views
- Limited window customization and transparency options
- No pop-out channels or floating windows

## Success Metrics

**Primary KPIs:**
- 70% of gamers enable overlay mode within 30 days of launch
- 45% increase in voice channel usage during gaming sessions
- 60% of users utilize always-on-top modes for multitasking
- 85% user satisfaction score for overlay performance and usability

**Technical Metrics:**
- <16ms overlay rendering latency (60fps smooth)
- <5% CPU overhead when overlay is active
- Support for 4K resolution overlays with hardware acceleration
- 99.9% overlay stability across gaming applications

## User Stories

### Core Overlay Features

**As a gamer, I want to:**
- Access voice controls through an in-game overlay without alt-tabbing
- See who's speaking in voice channels while playing full-screen games
- Control my microphone and audio settings from within any application
- Have a minimal, non-intrusive overlay that doesn't impact game performance
- Customize overlay position and transparency to suit different games

**As a content creator, I want to:**
- Display voice channel participants during live streams
- Control stream settings from overlay while gaming
- Show chat messages in a floating overlay window
- Record overlay interactions for highlight reels

### Advanced Window Management

**As a multitasker, I want to:**
- Keep voice channels always-on-top while working in other applications
- Use a compact mini player mode that takes minimal screen space
- Pop out individual channels into separate floating windows
- Snap Hearth windows to screen edges with custom sizing presets
- Set different window modes for different use cases (work, gaming, casual)

**As a power user, I want to:**
- Create custom window layouts for multi-monitor setups
- Save and restore window configurations per activity
- Use keyboard shortcuts to switch between window modes
- Configure per-application overlay behavior and appearance

## Technical Requirements

### Core Overlay Engine

**1. Overlay Rendering System**
```rust
// Tauri backend: src-tauri/src/overlay/mod.rs
pub mod overlay {
    pub mod renderer;          // GPU-accelerated overlay rendering
    pub mod injection;         // Process injection and hooking
    pub mod hotkeys;          // Overlay activation shortcuts
    pub mod positioning;      // Smart overlay positioning
    pub mod transparency;     // Window transparency and effects
    pub mod game_detection;   // Full-screen game detection
}
```

**2. Window Management Framework**
```rust
// Tauri backend: src-tauri/src/window_management/mod.rs
pub mod window_management {
    pub mod always_on_top;    // Always-on-top window control
    pub mod mini_player;      // Compact voice channel mode
    pub mod multi_window;     // Pop-out window management
    pub mod snap_assist;      // Window snapping and positioning
    pub mod profiles;         // Window configuration profiles
}
```

**3. Overlay Interface Components**
```svelte
<!-- Frontend: src/lib/components/overlay/ -->
- OverlayVoiceControl.svelte    // Voice channel controls
- OverlayParticipantList.svelte // Who's speaking indicators
- OverlayChatView.svelte        // Floating chat messages
- OverlaySettings.svelte        // Overlay configuration
- OverlayHotkeys.svelte         // Keyboard shortcut handling
```

**4. Window Mode Controller**
```svelte
<!-- Frontend: src/lib/components/window/ -->
- WindowModeSelector.svelte     // Mode switching interface
- MiniPlayerMode.svelte         // Compact voice interface
- AlwaysOnTopController.svelte  // Always-on-top management
- MultiWindowManager.svelte     // Pop-out window controls
- WindowProfileManager.svelte   // Save/restore configurations
```

### Overlay Technology Stack

**Rendering Pipeline:**
- **Tauri Custom Protocol** for secure overlay communication
- **GPU Acceleration** via WebGL/Direct3D for smooth rendering
- **Process Injection** (Windows DLL, macOS framework injection)
- **Shared Memory** for low-latency data sharing with games
- **Hook Libraries** for input capture and display integration

**Platform Implementation:**
- **Windows:** DirectX overlay injection, Windows API hooks
- **macOS:** Core Graphics overlay, Accessibility API integration
- **Linux:** X11/Wayland overlay system, compositor integration

### Window Management Architecture

**Window Types:**
1. **Main Window** - Primary Hearth Desktop application
2. **Overlay Window** - Transparent, always-on-top game overlay
3. **Mini Player** - Compact voice channel controller (200x100px)
4. **Pop-out Windows** - Individual channel/DM floating windows
5. **Settings Overlay** - Configuration interface accessible from anywhere

**Window Modes:**
- **Standard Mode** - Normal windowed application
- **Always-On-Top Mode** - Stays above all other windows
- **Mini Mode** - Compact interface showing only essential controls
- **Overlay Mode** - Transparent overlay for full-screen applications
- **Multi-Window Mode** - Multiple pop-out windows for different channels

## User Experience Design

### Overlay Interface (In-Game)
```
┌─────────────────────────────────────┐
│ 🔊 General Voice            [⚙️]    │
├─────────────────────────────────────┤
│ 🟢 Alice    🎤     Speaking...      │
│ 🟢 Bob      🔇     Muted            │
│ 🟡 Charlie  🎤     Idle             │
├─────────────────────────────────────┤
│ [🎤] [🔊] [📞] [👁️]   Opacity: 80%  │
│  Mic  Audio Leave Hide              │
└─────────────────────────────────────┘
```

### Mini Player Mode
```
┌─────────────────────────┐
│ 🔊 3 in General Voice   │
│ [🎤] [🔊] [📞]    [⚙️]   │
│  Mic  Audio Leave  Menu │
└─────────────────────────┘
```

### Window Mode Selector
```
┌──────────────────────────────────────┐
│ Window Mode                     [×]  │
├──────────────────────────────────────┤
│ ○ Standard       Full application    │
│ ● Always-On-Top  Stay above others   │
│ ○ Mini Player    Compact controls    │
│ ○ Overlay        In-game overlay     │
│                                      │
│ ☐ Auto-switch for games              │
│ ☐ Remember per application           │
│                                      │
│ [Apply] [Save Profile]               │
└──────────────────────────────────────┘
```

### Overlay Settings Dashboard
```
┌──────────────────────────────────────┐
│ Overlay Configuration                │
├──────────────────────────────────────┤
│ Position: Top-Right           [▼]    │
│ Size: Medium (300x200)        [▼]    │
│ Opacity: ████████░░ 80%              │
│                                      │
│ Hotkeys:                             │
│ Toggle Overlay: Ctrl+Shift+O         │
│ Push-to-Talk:  F4                    │
│ Mute/Unmute:   Ctrl+M                │
│                                      │
│ ☑ Show when game detected            │
│ ☑ Hide overlay in menus              │
│ ☐ Show chat messages                 │
│ ☑ Voice activity animations          │
│                                      │
│ Games: [Manage Game Settings]        │
└──────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Basic Always-On-Top (Weeks 1-3)
- [ ] Always-on-top window mode implementation
- [ ] Mini player compact interface
- [ ] Window mode switching controls
- [ ] Basic transparency and positioning

### Phase 2: Multi-Window System (Weeks 4-6)
- [ ] Pop-out channel windows
- [ ] Window snap assistance
- [ ] Multi-monitor window management
- [ ] Window profile save/restore

### Phase 3: Overlay Foundation (Weeks 7-10)
- [ ] Basic overlay window rendering
- [ ] Game detection and full-screen awareness
- [ ] Overlay positioning and sizing
- [ ] Simple voice control overlay interface

### Phase 4: Advanced Overlay (Weeks 11-14)
- [ ] Process injection for true overlay (Windows)
- [ ] Hardware-accelerated overlay rendering
- [ ] Advanced hotkey system
- [ ] Per-game overlay configurations

### Phase 5: Polish & Optimization (Weeks 15-16)
- [ ] Performance optimization for gaming
- [ ] Cross-platform testing and fixes
- [ ] Accessibility features
- [ ] User experience refinement

## Technical Challenges

### Overlay Performance
**Challenge:** Maintaining 60fps overlay rendering without impacting game performance
**Solution:**
- Use GPU-accelerated rendering with minimal CPU overhead
- Implement frame rate limiting when game FPS drops
- Smart culling of non-visible overlay elements
- Memory-mapped shared buffers for low-latency data

### Game Compatibility
**Challenge:** Supporting overlays across different game engines and graphics APIs
**Solution:**
- DirectX, OpenGL, and Vulkan injection support
- Per-game compatibility database with specific configurations
- Fallback to window-based overlay for incompatible games
- Community-contributed game compatibility profiles

### Security & Anti-Cheat
**Challenge:** Working with anti-cheat systems without triggering false positives
**Solution:**
- Digital code signing for all overlay components
- Whitelisting coordination with major anti-cheat providers
- Optional overlay-free mode for competitive games
- Transparent communication about overlay functionality

## Success Criteria

### MVP Acceptance Criteria
- [x] Always-on-top window mode functional across platforms
- [x] Mini player mode with essential voice controls
- [x] Basic overlay working in windowed games
- [x] Window positioning and transparency controls
- [x] Hotkeys for overlay toggle and basic functions

### Full Feature Acceptance Criteria
- [x] True overlay support in full-screen DirectX/OpenGL games
- [x] Per-game overlay configuration and profiles
- [x] Multi-monitor overlay positioning
- [x] Anti-cheat compatibility for major competitive games
- [x] <16ms overlay rendering latency

## Risk Assessment

**High Risk:**
- Anti-cheat systems blocking overlay injection
- Game engine incompatibilities causing crashes
- Performance impact on competitive gaming

**Medium Risk:**
- Platform API changes affecting window management
- User adoption of overlay features
- Cross-platform rendering consistency

**Mitigation Strategies:**
- Extensive game compatibility testing
- Multiple overlay implementation approaches
- Close coordination with game developers and anti-cheat vendors
- Performance monitoring and automatic fallbacks

## Dependencies

**External:**
- DirectX SDK for Windows overlay injection
- Game engine compatibility databases
- Anti-cheat vendor whitelisting processes

**Internal:**
- Multi-monitor system integration
- Global shortcut system enhancements
- Voice/audio system integration
- User preference and profile management

## Future Enhancements

**Post-MVP Features:**
- Screen annotation tools in overlay mode
- Overlay integration with streaming software
- Custom overlay themes and branding
- Overlay marketplace for community extensions
- Mobile companion overlay control
- VR headset overlay support

---
**Last Updated:** March 25, 2026
**Next Review:** Engineering Weekly + Platform Integration Team
# PRD: Native OS Integration & System Management

## Overview

**Priority**: P0 (Critical)
**Timeline**: 6-8 weeks
**Owner**: Desktop Platform Team

Implement comprehensive native OS integration including system tray, proper window management, native notifications, and platform-specific features. This is critical for Hearth Desktop to feel like a native desktop application rather than a web app in a wrapper.

## Problem Statement

Hearth Desktop currently lacks essential native OS integration features that Discord users expect:
- No system tray presence for background operation
- Poor window management (no always-on-top, improper minimize behavior)
- Missing native OS notifications with action buttons
- No auto-startup integration
- Lacks platform-specific features (Windows Game Bar, macOS menu bar, Linux .desktop files)

This makes Hearth feel like a second-class citizen compared to Discord's mature desktop experience.

## Goals

### Primary Goals
- **System tray integration** with status indicators and quick actions
- **Advanced window management** (always-on-top, minimize to tray, multi-window)
- **Native OS notifications** with action buttons and proper persistence
- **Auto-startup configuration** with system boot integration
- **Platform-specific integrations** (Windows overlay, macOS dock badge, Linux desktop)

### Success Metrics
- 80% of users enable minimize-to-tray within 7 days
- 95% notification delivery rate across all platforms
- Zero crashes during window state transitions
- 90% user satisfaction with "native app feel" (post-launch survey)

## Technical Requirements

### System Tray Implementation
```rust
// Tauri system tray structure
use tauri::SystemTray;

#[tauri::command]
async fn update_tray_status(status: UserStatus, unread_count: u32) -> Result<(), String>

#[tauri::command]
async fn toggle_window_visibility() -> Result<(), String>
```

**Tray Menu Items**:
- Show/Hide Hearth
- Status indicator (Online, Away, DND, Invisible)
- Unread message badge
- Quick mute/deafen toggles
- Settings shortcut
- Quit application

### Window Management System
```typescript
interface WindowConfig {
  alwaysOnTop: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
  closeToTray: boolean;
  multiWindow: boolean;
}
```

**Features**:
- Always-on-top toggle for voice channels
- Minimize to tray vs taskbar preference
- Multi-window support (detachable voice controls)
- Picture-in-picture mode for video calls
- Window state persistence across restarts

### Native Notifications
```rust
#[derive(Serialize)]
struct HearthNotification {
    id: String,
    title: String,
    body: String,
    actions: Vec<NotificationAction>,
    channel_id: String,
    silent: boolean,
}
```

**Notification Types**:
- Direct message notifications
- @mention alerts in channels
- Voice channel activity (user joined/left)
- Friend requests and server invites
- System notifications (updates, maintenance)

**Action Buttons**:
- Reply directly from notification
- Mark as read
- Join voice channel
- Mute conversation

### Auto-Startup Integration

**Windows**:
- Registry entries for startup programs
- Windows Task Scheduler integration
- Startup delay configuration

**macOS**:
- LaunchAgents configuration
- Login Items management via System Preferences
- Dock integration with badge counts

**Linux**:
- .desktop file installation
- XDG autostart specification
- systemd user service integration

### Platform-Specific Features

**Windows**:
- Windows Game Bar overlay integration
- Windows 11 notification center persistence
- Taskbar progress indicators for file uploads
- Windows Hello authentication integration

**macOS**:
- Menu bar icon with dropdown
- Dock badge for unread counts
- macOS notification center integration
- Touch Bar controls for voice functions

**Linux**:
- Desktop environment integration (GNOME, KDE, XFCE)
- System notification daemon compatibility
- Global menu support where available
- Wayland/X11 protocol handling

## User Experience

### Settings UI
- **Startup & Background** section in preferences
- **Notifications** configuration with granular controls
- **Window Behavior** settings panel
- **Platform Integration** toggles for OS-specific features

### Default Behavior
```
Startup: Launch minimized to tray
Notifications: Enabled for DMs and @mentions
Window: Minimize to tray on close
Tray: Show status and unread count
```

## Implementation Plan

### Phase 1: Core Tray & Window (Week 1-3)
- Implement basic system tray with show/hide
- Add window management controls
- Create settings UI for behavior configuration

### Phase 2: Notifications & Startup (Week 4-5)
- Build native notification system with actions
- Implement auto-startup registration
- Add notification preference controls

### Phase 3: Platform Features (Week 6-8)
- Windows Game Bar integration
- macOS menu bar and dock features
- Linux desktop environment integration
- Polish and cross-platform testing

## Dependencies

- **Tauri Plugins**: `tauri-plugin-notification`, `tauri-plugin-window-state`
- **Platform Libraries**: Windows Registry, macOS Foundation, Linux D-Bus
- **Settings System**: Centralized preferences storage

## Risk Mitigation

### Technical Risks
- **Permission requirements**: Graceful degradation when OS permissions denied
- **Anti-virus compatibility**: Ensure tray/startup features don't trigger security warnings
- **Platform fragmentation**: Unified API across different Linux desktop environments

### Security Considerations
- **Startup privileges**: No elevated permissions required
- **Notification content**: Sanitize message content in notifications
- **Auto-update safety**: Secure update mechanism for startup programs

## Competitive Analysis

**Discord Advantages**:
- Mature system tray with 8+ years of polish
- Deep OS integration across all platforms
- Extensive user customization options

**Hearth Advantages**:
- Modern Tauri architecture for better performance
- Clean settings UI without legacy cruft
- Cross-platform consistency from day one

## Success Criteria
- Users can run Hearth in background via system tray
- Native notifications work reliably across all platforms
- Window behavior matches user expectations from Discord
- Auto-startup integrates cleanly with OS preferences
- Platform-specific features enhance rather than complicate UX
# PRD #13: Advanced Tray & Window Management System

**Status**: Competitive Gap Analysis
**Priority**: P1 (Essential desktop behavior for user retention)
**Complexity**: Medium
**Dependencies**: Global Hotkeys System (#12), Rich Notifications System (#14)

## Problem Statement

Hearth Desktop's current tray implementation is basic—only left-click to show window. Discord provides a rich tray experience with context menus, status indicators, and advanced window behaviors (minimize to tray, always on top). Users expect desktop chat applications to integrate seamlessly with their OS workflow, not behave like web applications.

## Success Metrics

- [ ] Right-click tray menu with 8+ useful actions
- [ ] Minimize to tray instead of closing application
- [ ] Window state persistence across app restarts
- [ ] Always-on-top mode for voice control scenarios
- [ ] Visual unread message indicators in tray icon

## User Stories

### Productivity Scenario
**As a** remote worker with limited screen space
**I want** to minimize Hearth to tray and see unread counts
**So that** I can stay connected without cluttering my taskbar

### Gaming Scenario
**As a** gamer using Hearth for voice chat
**I want** to set Hearth window to always-on-top with voice controls
**So that** I can manage voice without losing my game window

### Multi-tasking Scenario
**As a** user with multiple chat applications
**I want** quick access to Hearth functions from the tray
**So that** I don't need to hunt for the window among many open apps

## Technical Architecture

### Tray Menu Structure
```
Hearth Desktop
├── Show/Hide Window
├── ────────────────
├── 🟢 Online
├── 🟡 Away
├── 🔴 Do Not Disturb
├── ────────────────
├── Quick Join Voice
├── Toggle Mute
├── ────────────────
├── Settings...
├── About Hearth...
└── Quit Hearth
```

### Window Management Features
- **Minimize to Tray**: Close button minimizes instead of quitting
- **Always on Top**: Pin window above all other applications
- **Smart Positioning**: Remember position per monitor setup
- **Multi-Monitor**: Proper handling of monitor changes

## Implementation Details

### Phase 1: Enhanced Tray Menu
- **T-TRAY-01**: Extend existing tray.rs with context menu builder
- **T-TRAY-02**: Add status setting (Online/Away/DND) with persistence
- **T-TRAY-03**: Implement quick voice channel actions
- **T-TRAY-04**: Add unread message badge overlay on tray icon

### Phase 2: Advanced Window Behavior
- **T-TRAY-05**: Implement minimize-to-tray preference setting
- **T-TRAY-06**: Add always-on-top toggle with hotkey
- **T-TRAY-07**: Build window state persistence system
- **T-TRAY-08**: Add multi-monitor position restoration

### Phase 3: Platform Integration
- **T-TRAY-09**: Windows taskbar integration (progress indicator)
- **T-TRAY-10**: macOS dock badge counts and menu extras
- **T-TRAY-11**: Linux desktop notifications integration
- **T-TRAY-12**: Native look-and-feel for each platform

## User Interface Design

### Tray Context Menu (Platform Native)
```
Windows:                   macOS:                    Linux:
┌─────────────────┐       ┌─────────────────┐      ┌─────────────────┐
│ 🏠 Show Hearth  │       │ 🏠 Show Hearth  │      │ 🏠 Show Hearth  │
├─────────────────┤       ├─────────────────┤      ├─────────────────┤
│ 🟢 Online       │       │ 🟢 Online       │      │ 🟢 Online       │
│ 🟡 Away         │       │ 🟡 Away         │      │ 🟡 Away         │
│ 🔴 Do Not Disturb│      │ 🔴 Do Not Disturb│     │ 🔴 Do Not Disturb│
├─────────────────┤       ├─────────────────┤      ├─────────────────┤
│ 🔊 Join Voice   │       │ 🔊 Join Voice   │      │ 🔊 Join Voice   │
│ 🎤 Toggle Mute  │       │ 🎤 Toggle Mute  │      │ 🎤 Toggle Mute  │
├─────────────────┤       ├─────────────────┤      ├─────────────────┤
│ ⚙️ Settings...   │       │ ⚙️ Settings...   │      │ ⚙️ Settings...   │
│ ❌ Quit          │       │ ❌ Quit Hearth   │      │ ❌ Quit          │
└─────────────────┘       └─────────────────┘      └─────────────────┘
```

### Settings Panel
```
┌─ Window & Tray Settings ──────────────────┐
│                                           │
│ Window Behavior                           │
│ ☑ Minimize to tray instead of closing     │
│ ☑ Remember window position                │
│ ☐ Always start minimized                 │
│ ☐ Always on top                          │
│                                           │
│ Tray Settings                             │
│ ☑ Show tray icon                         │
│ ☑ Show unread message count              │
│ ☑ Animate icon for new messages          │
│                                           │
│ Status Settings                           │
│ Auto-away after: [10 minutes] ▼          │
│ ☑ Set status to away when idle           │
│ ☐ Show current playing game in status    │
└───────────────────────────────────────────┘
```

## Technical Challenges

### Platform-Specific Behaviors
- **Windows**: WM_SYSCOMMAND interception for minimize-to-tray
- **macOS**: NSApplication dock tile management
- **Linux**: Desktop environment variations (GNOME/KDE/XFCE)

### Tray Icon Management
- **Badge Rendering**: Dynamic badge count overlay generation
- **Animation**: Subtle notification animations without being annoying
- **High DPI**: Proper scaling for 4K displays and retina screens

### Window State Persistence
- **Multi-Monitor**: Handle monitor disconnection gracefully
- **Virtual Desktops**: Remember desktop/workspace assignment
- **Window Managers**: Compatibility with tiling window managers

## Extended Implementation

### Tauri Configuration Updates
```rust
// src-tauri/tauri.conf.json additions
"app": {
  "windows": [{
    "closable": false,  // Intercept close to minimize to tray
    "skipTaskbar": false
  }],
  "trayIcon": {
    "iconPath": "icons/icon.png",
    "menuOnLeftClick": false,
    "tooltip": "Hearth Desktop"
  }
}
```

### Enhanced Tray Implementation
```rust
// src-tauri/src/tray.rs extensions
use tauri::tray::{TrayIconBuilder, ClickType};
use tauri::menu::{Menu, MenuItem, CheckMenuItem};

pub fn setup_advanced_tray<R: Runtime>(
    app: &tauri::App<R>
) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::new(app, "show", "Show Hearth", true, None)?;
    let status_menu = build_status_submenu(app)?;
    let voice_menu = build_voice_submenu(app)?;
    let quit_item = MenuItem::new(app, "quit", "Quit Hearth", true, None)?;

    let menu = Menu::with_items(app, &[
        &show_item,
        &PredefinedMenuItem::separator(app)?,
        &status_menu,
        &PredefinedMenuItem::separator(app)?,
        &voice_menu,
        &PredefinedMenuItem::separator(app)?,
        &quit_item,
    ])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(handle_menu_event)
        .build(app)?;

    Ok(())
}
```

## Testing Strategy

### Cross-Platform Testing
- [ ] Tray menu renders correctly on Windows 10/11
- [ ] macOS dock integration works on Monterey+
- [ ] Linux compatibility across major desktop environments

### Window Management Testing
- [ ] Minimize to tray works with custom close behavior
- [ ] Always-on-top persists across focus changes
- [ ] Window position restored correctly after monitor changes

### User Experience Testing
- [ ] Tray icon clearly indicates app status
- [ ] Context menu actions respond instantly
- [ ] Badge count updates reflect actual unread state

## Performance Considerations

### Resource Usage
- **Memory**: Additional 2-3MB for menu state management
- **CPU**: <0.5% for tray status updates
- **Battery**: Minimal impact from status polling

### Update Frequency
- **Badge Count**: Update immediately on new message
- **Status**: Sync every 30 seconds with server
- **Menu State**: Lazy load voice channel list

## Security Considerations

### Information Exposure
- **Tray Tooltip**: Avoid showing sensitive message content
- **Menu Items**: Sanitize server/channel names for display
- **Badge Count**: Show count only, not message previews

### System Integration
- **Process Visibility**: Tray icon doesn't reveal internal state
- **Auto-start**: Clear user consent for boot-time startup
- **Persistence**: Encrypt stored window state preferences

## Migration Strategy

### Backward Compatibility
- **Existing Users**: Preserve current tray behavior as default
- **Settings Migration**: Convert old preferences to new schema
- **Feature Discovery**: Tutorial highlighting new tray features

### Rollout Plan
- **Beta Testing**: Enable for opted-in beta users first
- **Gradual Release**: 25% → 50% → 100% over 2 weeks
- **Monitoring**: Track tray usage patterns and error rates

## Success Metrics & KPIs

### User Engagement
- **Tray Adoption**: % of users who enable minimize-to-tray
- **Menu Usage**: Average tray menu interactions per day
- **Window Management**: % using always-on-top or position saving

### Technical Performance
- **Responsiveness**: Tray menu opens in <200ms
- **Reliability**: <0.1% tray icon failure rate
- **Memory Efficiency**: No memory leaks from menu operations

### User Satisfaction
- **Support Requests**: Reduction in window management complaints
- **Feature Requests**: Decrease in tray-related enhancement requests
- **User Reviews**: Improved ratings mentioning desktop integration

---

**Estimated Development Time**: 4-5 weeks
**Required Team**: 1-2 engineers (UI + Platform integration)
**Risk Level**: Medium (platform-specific behavior variations)
**User Impact**: High for desktop workflow integration
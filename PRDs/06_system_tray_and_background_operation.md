# PRD: System Tray & Background Operation

## Overview

**Priority**: P1
**Timeline**: 2-3 weeks
**Owner**: Frontend / Tauri Backend

Implement full system tray integration with minimize-to-tray, tray context menu, unread badge indicators, and quick voice controls — making Hearth Desktop feel like a proper native desktop citizen that stays out of the user's way.

## Problem Statement

Discord's system tray integration is a key desktop UX differentiator. Users expect to minimize Discord to the system tray, control voice (mute/deafen) from the tray icon, and receive visual badge counts without the app being visible. Hearth Desktop has a skeleton tray icon (`tray.rs`) but no context menu, no badge counts, no minimize-to-tray behavior, and no quick voice controls. Users must keep the window open or fully quit — a poor experience compared to Discord.

## Success Metrics

- **Tray Retention**: App stays resident in system tray when window is closed (not quit)
- **Tray Menu Coverage**: 90% of Discord tray menu actions available
- **Badge Update Latency**: Unread badge updates within 2s of new message
- **Voice Quick Controls**: Mute/deafen accessible from tray without opening window

## User Stories

### Core Tray Behavior
- As a user, I want to close the Hearth window and have it minimize to the system tray so the app stays running in the background
- As a user, I want to click the tray icon to show/focus the main window so I can return to Hearth quickly
- As a user, I want to right-click the tray icon to see a context menu so I can access common actions without opening the window

### Tray Context Menu
- As a user, I want to see my current server + voice channel in the tray menu so I know where I am at a glance
- As a user, I want to mute/deafen from the tray menu so I can control audio without opening Hearth
- As a user, I want to disconnect from voice from the tray menu
- As a user, I want to see unread message counts as a badge on the tray icon
- As a user, I want a "Quit Hearth" option to fully exit

### Background Notifications
- As a user, I want to receive native OS desktop notifications for mentions and DMs when the window is closed
- As a user, I want to click a notification to bring up the relevant channel/message

## Technical Requirements

### Tauri Backend (Rust)
- Extend `src-tauri/src/tray.rs` with full tray menu builder
- Register global event listeners for window close → minimize-to-tray
- Use `tauri-plugin-notification` for desktop notifications
- Tray badge count via platform-specific APIs (Windows: `ITaskbarList3`, macOS: `dockbadge`, Linux: `unity-launcher`)

### Tray Menu Structure
```
Hearth
├── Greg (you)                          ← header (disabled)
├── ─────────────────
├── #general · ServerName               ← current channel + server
├── 🎤 Mute    [x]                       ← toggle, checkmark when active
├── 🔇 Deafen  [ ]                      ← toggle
├── ─────────────────
├── Unread: 3 messages in #design       ← if unread exists
├── ─────────────────
├── Open Hearth                         ← show/focus window
├── Quit Hearth                         ← full quit
```

### Svelte Frontend
- Emit `unread-count-changed` events to Rust backend when channel unread count changes
- Open window on tray click (already implemented in tray.rs)
- Handle `tauri://tray` events for menu item clicks → call appropriate actions

### Data Flow
1. WebSocket receives new message → check if `channelId !== activeChannelId` or window hidden
2. If unread: increment unread count for channel, emit event to Rust
3. Rust backend updates tray tooltip/badge
4. Tauri notification fires if user has notifications enabled

### Platform Considerations
- **Windows**: Use `windows` crate for taskbar overlay icons; `tauri-plugin-autostart` for startup registration
- **macOS**: Use `tauri-plugin-autostart`; dock badge via `NSApp.dockBadge`
- **Linux**: Unity launcher count via `libunity`; fallback to tray tooltip text with unread count

## Out of Scope
- Full notification settings panel (part of Settings UI PRD)
- Custom tray icon per-status (P2)
- Tray animation effects

## Key Risks
- Window close event intercept must prevent app exit — coordinate with app quit flow
- Badge API varies significantly across platforms; use Tauri's `tray-icon` plugin abstraction where possible
- Notifications must respect OS Do Not Disturb settings

## Success Criteria
- Closing window does NOT quit the app; tray icon remains
- Tray left-click always shows/focuses window
- Tray right-click shows full context menu
- Badge count updates correctly when messages arrive in background channels
- Quit from tray menu fully exits the process

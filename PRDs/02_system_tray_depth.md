# PRD: System Tray Depth & Quick Actions

## Overview

Implement a full-featured system tray for Hearth Desktop, enabling users to manage the app without switching to its window — mirroring Discord's tray UX.

## Problem Statement

Discord's system tray is a primary interaction surface: right-click gives instant access to unread channels, mute/deafen toggles, server list, and quit. Hearth currently has a stub tray (click to show window only). For a chat platform competing with Discord, this is a **table-stakes omission**. Power users and gamers expect background operation and quick actions from the tray.

## Goals

- Unread channel/server badges on the tray icon
- Right-click context menu with quickmute, quick-deafen, unread channels, show/hide, quit
- Tray tooltip updates dynamically with current status
- Minimize-to-tray instead of taskbar on close (configurable)
- Badge count updates via `set_badge_count` Tauri command

## User Stories

| As a user | I want to | so that |
|-----------|-----------|---------|
| Active user | See unread message count on tray icon | I know if I have pending messages at a glance |
| Gamer | Right-click tray to mute without opening Hearth | I can manage audio without alt-tabbing |
| Power user | Minimize to tray on close | Hearth stays running in background |
| Returning user | Click tray to restore window | One click returns me to my chat context |

## Technical Approach

### Tray Menu Structure (right-click)
```
┌─────────────────────────────┐
│ 🎤 Mute   |  🔇 Deafen      │
│ ─────────────────────────── │
│ 📁 #general (3 unread)     │
│ 📁 #random (1 unread)      │
│ ─────────────────────────── │
│ 👁 Show Hearth             │
│ ─────────────────────────── │
│ ❌ Quit Hearth             │
└─────────────────────────────┘
```

### Implementation Details
- **Tauri tray API**: Use `TrayIconBuilder` with `menu` (via `tauri-plugin-shell` or raw `menu` API)
- **Unread state**: Subscribe to app store; update `icon` and `tooltip` on unread changes
- **Minimize-to-tray**: Hook `window.onCloseRequest`; if setting enabled, `event.prevent_close()` + `window.hide()`
- **Badge count**: `set_badge_count(n)` updates overlay icon (macOS) or tooltip (Windows/Linux)
- **Menu rebuild**: Re-render tray menu on unread state change

### Dependencies
- `tauri-plugin-notification` (already present)
- `tauri-plugin-store` (already present)
- No new Tauri plugins required; use built-in `tray` API

## Milestones

| Milestone | Deliverable |
|-----------|-------------|
| M1 | Right-click menu with mute/deafen/show/quit |
| M2 | Unread badge on tray icon (macOS overlay / tooltip fallback) |
| M3 | Minimize-to-tray on window close (setting-gated) |
| M4 | Dynamic tooltip with current status |

## Priority: P0
**Estimated Effort**: 2 sprints (4 weeks)
**Owner**: Desktop Team

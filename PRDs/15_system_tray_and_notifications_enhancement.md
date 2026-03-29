# PRD: System Tray & Notifications Enhancement

## Overview

**Priority**: P1 (High)
**Timeline**: 2-3 weeks
**Owner**: Desktop Team

Enhance the system tray and native notification system beyond the current basic implementation — adding a tray context menu, minimize-to-tray behavior, rich notification actions, and unread badge support.

## Problem Statement

Hearth Desktop has a `tray.rs` with only a left-click handler that shows the window. Discord's tray supports:
- Right-click context menu (Show/Hide, Mute, Disconnect, Quit)
- Minimize to tray instead of taskbar (configurable)
- Tray icon badge showing unread count
- Native notifications with Reply/Mark-Read action buttons

The current tray is a stub that doesn't provide any of this functionality.

**Current Gap**: Discord's tray gives users full offline-while-running control. Hearth Desktop's tray is cosmetic only.

## Goals

### Primary Goals
- **Tray Context Menu** — Right-click menu with: Show/Hide Window, Mute Audio, Disconnect Voice, separator, Quit
- **Minimize to Tray** — When minimized (or close button), app hides to tray instead of quitting; tray icon remains
- **Tray Unread Badge** — Overlay badge on tray icon showing unread message count (using `set_badge_count`)
- **Rich Notifications** — Notification shows sender avatar, channel name, message preview; clicking navigates to message

### Secondary Goals
- **Notification Sound** — Play a configurable sound for new messages (respecting system Do Not Disturb)
- **Tray Tooltip** — Show current voice channel + participant count in tooltip
- **DND / Focus Mode Sync** — Respect system Do Not Disturb for notifications

## Technical Approach

### Tray Menu (Rust)

```rust
// src-tauri/src/tray.rs — replace current stub
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "Show Hearth", true, None::<&str>)?;
    let mute_i = MenuItem::with_id(app, "mute", "Mute Audio", true, None::<&str>)?;
    let disconnect_i = MenuItem::with_id(app, "disconnect", "Disconnect Voice", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    
    let menu = Menu::with_items(app, &[&show_i, &mute_i, &disconnect_i, &sep, &quit_i])?;
    
    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Hearth")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => { /* show window */ }
            "mute" => { /* emit mute event to frontend */ }
            "disconnect" => { /* disconnect voice */ }
            "quit" => { app.exit(0); }
            _ => {}
        })
        .build(app)?;
    Ok(())
}
```

### Minimize to Tray

In the frontend (Svelte `App.svelte` or a window state store):
- On window `minimize` event → hide window instead (use `app.get_webview_window("main").hide()`)
- Add a setting "Minimize to tray" (default: on) stored via `tauri-plugin-store`

### Notification Actions

Use `tauri-plugin-notification` with action buttons:
- Reply → opens app to the channel with reply composer open
- Mark Read → marks message as read server-side

### macOS Badge

Already implemented (`set_badge_count`) but needs to be wired to the WebSocket message received event → update count.

# PRD: Auto-Start & Window State Persistence

## Overview

**Priority**: P1
**Timeline**: 1-2 weeks
**Owner**: Tauri Backend / Frontend

Implement OS-native auto-start registration and window state persistence so Hearth Desktop launches on system boot like Discord and remembers its window size/position across sessions — the two simplest "polish" features with outsized UX impact.

## Problem Statement

Discord launches automatically when you boot your computer and remembers exactly where its window was positioned. Hearth Desktop currently has neither of these behaviors. Users who want Hearth always available must manually add it to startup; and every launch resets the window to a default position/size. These are table-stakes desktop app expectations that Tauri makes straightforward to implement.

## Success Metrics

- **Auto-start Registration**: App appears in OS startup list (Task Manager → Startup on Windows; System Preferences → Login Items on macOS; autostart directory on Linux)
- **Window State Restored**: Window reopens at exact position, size, and maximized state from previous session within 500ms of app launch
- **Zero Regressions**: Existing minimize-to-tray and window focus behavior unaffected

## User Stories

### Auto-Start
- As a user, I want an "Open on Startup" toggle in settings so Hearth can run in the background when I log in
- As a user with multiple monitors, I want Hearth to open on the same monitor I last used it on
- As a user, I want the app to start minimized to tray (if tray is enabled) so it doesn't interrupt my workflow

### Window State
- As a user, I want Hearth to remember its window position and size so I don't have to reposition it every launch
- As a user, I want Hearth to remember if it was maximized so I can continue working in full-screen mode
- As a user, I want these preferences saved locally so they persist across app updates

## Technical Approach

### Auto-Start (Tauri Plugin)
- Use `tauri-plugin-autostart` (`npm install @tauri-apps/plugin-autostart`) — cross-platform autostart abstraction
- Rust integration via `tauri-plugin-autostart` with `enable()` / `disable()` / `is_enabled()` APIs
- Frontend toggle in Settings UI (see PRD #08) calls Tauri command `set_autostart(enabled: bool)`

### Window State Persistence
- Track window state via `tauri-plugin-window-state` — saves window geometry on close, restores on launch
- Configure in `tauri.conf.json`:
  ```json
  "plugins": {
    "window-state": {
      "denylist": []
    }
  }
  ```
- State stored in app data directory (platform-specific): `%APPDATA%\com.hearth.desktop\window-state.json` on Windows

### Svelte Frontend
- Read `autostart` status from `is_autostart_enabled()` on app init and toggle UI accordingly
- If autostart is enabled, minimize to tray on first launch (don't show window immediately)

## Out of Scope
- Per-server/workspace profiles for window state (v2)
- Multi-window state management

## Dependencies
- `tauri-plugin-autostart` (add to `src-tauri/Cargo.toml`)
- `tauri-plugin-window-state` (add to `src-tauri/Cargo.toml`)
- Settings UI (PRD #08) for the autostart toggle

## Key Risks
- Auto-start on Linux can behave differently across distros; test on Ubuntu, Fedora, Arch
- Window state plugin may conflict with manual window positioning during startup animation

## Success Criteria
- Toggle "Open on Startup" adds/removes Hearth from OS startup list
- Window opens at previous session's exact position and size after restart
- First launch (no saved state) uses platform-appropriate default centering

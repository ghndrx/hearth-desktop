# PRD: App Settings & Preferences UI

## Overview

**Priority**: P1
**Timeline**: 2-3 weeks
**Owner**: Frontend / UI Engineering

Build a full-featured Settings panel in Svelte giving users control over app behavior, voice/video defaults, notifications, appearance, and OS integration — replacing the current no-op settings infrastructure with a proper, organized preferences UI comparable to Discord's settings.

## Problem Statement

Hearth Desktop has a `settings` store in `app.ts` and a settings gear icon in the sidebar, but no actual Settings UI panel. Users cannot configure notifications, appearance, voice defaults, or OS integration options. The settings store exists as data structures but has no UI. This is a critical gap for user retention — power users expect to customize their experience.

## Success Metrics

- **Settings Coverage**: All settings in the data model (`Settings` interface) have a functional UI control
- **Settings Persistence**: All changes persist across app restarts via `localStorage` (v1) and Tauri store plugin (v2)
- **Settings Open Latency**: Settings panel opens within 200ms

## User Stories

### Appearance Settings
- As a user, I want to switch between dark/light/midnight themes so Hearth matches my OS preference
- As a user, I want to adjust font size (small/medium/large) so text is readable
- As a user, I want to toggle compact mode so more content fits on screen

### Voice & Video Defaults
- As a user, I want to select my default microphone so I don't have to choose every call
- As a user, I want to select my default camera so video calls work immediately
- As a user, I want to set my default output device so audio plays through the right speaker

### Notification Settings
- As a user, I want to enable/disable desktop notifications so I can control interruptions
- As a user, I want to toggle notification sounds so I can work silently
- As a user, I want to set notification sensitivity so I control what triggers alerts

### OS Integration
- As a user, I want an "Open on Startup" toggle so Hearth launches when I boot
- As a user, I want to minimize to tray when closed so the app stays running
- As a user, I want to control whether the app shows unread badges on taskbar/dock

### Account
- As a user, I want to see my account info (username, email, avatar)
- As a user, I want to sign out from within settings

## Technical Approach

### Settings Panel UI
Build a modal/page settings panel with sidebar navigation:

```
Settings
├── My Account
│   ├── Profile (avatar, display name, bio)
│   └── Sign Out
├── Appearance
│   ├── Theme (Dark / Light / Midnight)
│   ├── Font Size (Small / Medium / Large)
│   └── Compact Mode toggle
├── Voice & Video
│   ├── Input Device dropdown
│   ├── Output Device dropdown
│   ├── Video Device dropdown
│   ├── Open Advanced Voice Settings → (links to Advanced Voice PRD)
│   └── Test voice / preview
├── Notifications
│   ├── Enable Desktop Notifications toggle
│   ├── Notification Sounds toggle
│   └── @mention only / all messages
├── App Settings
│   ├── Open on Startup toggle         ← (PRD #07)
│   ├── Minimize to Tray toggle        ← (PRD #06)
│   └── Show Tray Icon toggle
└── About
    ├── Version info
    └── Check for Updates
```

### State Management
- `src/lib/stores/app.ts` `settings` store already exists — wire it to the UI
- Add new setting fields: `autostart`, `minimizeToTray`, `showTrayIcon`, `notificationSensitivity`
- Use `tauri-plugin-store` for persistent settings that survive localStorage clears

### Tauri Commands
- `get_settings(): Settings` — reads from store, returns merged defaults
- `update_settings(partial: Partial<Settings>)` — saves partial update
- `set_autostart(enabled: bool)` — delegates to `tauri-plugin-autostart`
- `open_settings_panel()` — focuses/floats the settings window or navigates to settings route

### Components
- `SettingsModal.svelte` — main settings container with sidebar
- `SettingsSection.svelte` — reusable settings section wrapper
- `DeviceSelector.svelte` — dropdown for audio/video device selection
- `ThemePicker.svelte` — visual theme switcher
- `Toggle.svelte` — consistent on/off toggle component
- `Slider.svelte` — labeled slider for volume/sensitivity

## Out of Scope
- Advanced voice settings (VAD, PTT, noise suppression) — PRD #11 covers those
- Notification per-channel settings — v2
- Sync settings to cloud account — v2

## Dependencies
- `tauri-plugin-store` for persistent settings
- `tauri-plugin-autostart` (PRD #07)
- `tauri-plugin-notification` (PRD #06)
- Device enumeration via WebRTC / `enumerateDevices()`

## Key Risks
- Adding many new settings fields may require store migration
- Device enumeration requires user media permissions — handle gracefully if denied

## Success Criteria
- Settings panel opens from sidebar gear icon
- All 4 settings categories are accessible and functional
- Theme changes apply immediately (no restart required)
- Auto-start toggle correctly registers/unregisters with OS
- Settings persist correctly after app restart

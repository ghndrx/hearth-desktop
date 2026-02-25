# Task Queue

This file tracks pending tasks and improvements for the Hearth Desktop application.

## High Priority

- [x] **Implement system tray functionality** - Add minimize-to-tray and tray context menu
- [x] **Add global keyboard shortcuts** - Quick toggle window visibility (e.g., Cmd/Ctrl+Shift+H)
- [x] **Implement native OS notifications** - Show notifications for new messages
- [x] **Create connection status indicator** - Show online/offline status in UI

## Medium Priority

- [x] **Add window state persistence** - Remember window size and position between sessions
- [x] **Implement auto-update checking** - Check for updates on startup
- [x] **Add settings/preferences page** - Allow users to configure app behavior
- [x] **Create error boundary component** - Handle and display errors gracefully

## Low Priority

- [ ] **Add keyboard navigation** - Full keyboard accessibility support
- [ ] **Implement dark/light theme toggle** - Theme switching in settings
- [x] **Add sound notifications** - Optional audio alerts for new messages
- [ ] **Create onboarding flow** - First-time user experience

## Completed

- [x] Initial project setup
- [x] System tray with context menu (show/hide, mute, focus mode, updates, quit)
- [x] Global keyboard shortcuts (Cmd/Ctrl+Shift+H/S/M/F)
- [x] Native OS notifications via tauri-plugin-notification
- [x] Connection status indicator
- [x] Window state persistence via tauri-plugin-window-state
- [x] Auto-update checking on startup
- [x] Settings/preferences UI (UserSettings.svelte)
- [x] Error boundary component
- [x] Sound notification manager (Feb 25, 2026)

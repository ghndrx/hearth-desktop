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

- [x] **Add keyboard navigation** - Full keyboard accessibility support (KeyboardNavigationManager.svelte)
- [x] **Implement dark/light theme toggle** - Theme switching in settings (ThemeSettings.svelte)
- [x] **Add sound notifications** - Optional audio alerts for new messages
- [x] **Create onboarding flow** - First-time user experience

## Completed

- [x] Quick Actions Panel - command palette with Ctrl+K, categorized actions, search, keyboard nav (Feb 26, 2026)
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
- [x] Onboarding flow - multi-step wizard for first-time users (Feb 25, 2026)
- [x] Keyboard navigation manager - F6 region cycling, skip links, shortcuts help modal (Feb 25, 2026)
- [x] Mini Mode / Picture-in-Picture - compact floating window with corner positioning (Feb 25, 2026)
- [x] Session Manager - view, filter, search, and switch between chat sessions (Feb 25, 2026)
- [x] Badge Manager - dock/taskbar badge for unread counts, cross-platform support (Feb 26, 2026)
- [x] Quick Notes - floating notes panel with persistent storage, color coding, search, and pinning (Feb 26, 2026)
- [x] Screen Record Manager - native screen recording with region selection, quality settings, and countdown (Feb 26, 2026)
- [x] Bookmarks Manager - save, organize, tag, and search bookmarked messages with folders (Feb 26, 2026)
- [x] Media Session Backend - Rust backend for MediaSessionManager with media key shortcuts (Feb 26, 2026)
- [x] Focus Timer - Pomodoro-style productivity timer with native notifications, tray integration, DND mode, and session statistics (Feb 26, 2026)
- [x] Workspace Profiles Manager - Save, switch, and manage multiple workspace configurations with auto-save, import/export, and profile icons (Feb 27, 2026)
- [x] Reading List Manager - Save, organize, and track reading progress on URLs/articles with tags, priorities, metadata extraction, and persistent storage (Feb 27, 2026)
- [x] Crash Reporter - Global error handling, crash capture with breadcrumbs, memory info, anonymization, and report management panel (Feb 27, 2026)

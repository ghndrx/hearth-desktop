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
- [x] Network Quality Indicator - Real-time network health monitoring with latency, jitter, packet loss, connection type, bandwidth display, and latency history graph (Feb 27, 2026)
- [x] Ambient Sound Manager - Productivity soundscapes with 19 ambient sounds (nature, urban, white noise, music), preset system, master/per-sound volume, fade effects, auto-stop timer, and call integration (Feb 27, 2026)
- [x] Gesture Manager - Trackpad/mouse gesture support with 10 configurable gestures (swipe, pinch, tap, hold), multi-finger detection, sensitivity settings, visual feedback, gesture statistics, and persistent storage (Feb 27, 2026)
- [x] Notification Center - Consolidated notification panel with search, filtering (all/unread/pinned), grouping by type, Do Not Disturb mode, auto-mark-read, pin/remove actions, persistent storage, and native notification integration (Feb 27, 2026)
- [x] Quick Capture Widget - System-wide floating mini-window for rapid message composition with Cmd/Ctrl+Shift+C, fuzzy contact search, recent recipients, attachment paste support, auto-dismiss, and Rust backend with dedicated floating window (Feb 28, 2026)
- [x] Smart Status Manager - Automatic status detection based on system state (meetings, screen sharing, idle, music, gaming, focus mode), configurable rules with priorities, scheduled statuses, status history, and native detection via Rust backend (Feb 28, 2026)
- [x] Quick Reply Templates Manager - Save, organize, and insert frequently used message templates with categories, variables support ({name}, {topic}), favorites, usage statistics, search/filter, import/export, keyboard navigation, and Cmd/Ctrl+Shift+R shortcut (Feb 28, 2026)
- [x] QR Code Manager - Generate and scan QR codes with support for text/URLs, WiFi networks, contacts (vCard), server invites, and voice channel links. Features customizable colors/sizes, clipboard copy, download PNG, drag-drop image scanning, and history tracking with persistent storage (Feb 28, 2026)
- [x] Voice Dictation Manager - Native speech-to-text input with multi-language support (18 languages), continuous/interim modes, audio level visualization, voice commands for punctuation, configurable settings, and floating panel UI with Ctrl+Shift+D hotkey (Mar 1, 2026)
- [x] App Log Viewer - Real-time application log viewer with level filtering (trace/debug/info/warn/error), module filtering, text search, auto-scroll, statistics panel, log export (TXT/JSON), persistent log history (1000 entries), and Ctrl+Alt+L hotkey. Includes Rust backend for log capture and event emission (Mar 1, 2026)
- [x] Contextual Help Panel - Smart, context-aware help system with searchable topic database, category filtering, topic pinning, feedback collection, difficulty badges, keyboard shortcuts display, related features links, and multiple position modes (right/bottom/floating). Includes 10 built-in help topics covering core features (Mar 1, 2026)
- [x] Message Scheduler - Schedule messages to send later with date/time picker, recurring options (daily/weekly/monthly), status tracking (pending/sent/failed/cancelled), search/filter, stats bar, countdown timer, and persistent storage. Keyboard shortcut: Ctrl+Shift+S (Mar 1, 2026)
- [x] Message Reminder Manager - Set reminders for specific messages with quick time presets (20m/1h/3h/tomorrow), custom date/time picker, recurring options (daily/weekly/monthly), personal notes, snooze functionality with multiple options, native notification integration, search/filter active reminders, reminder history with clear option, and persistent localStorage storage (Mar 1, 2026)
- [x] App Widgets Bar - Collapsible sidebar with desktop widgets including clock, system stats (CPU/RAM/disk), weather, quick notes, and Pomodoro timer. Features left/right positioning, widget enable/disable, persistent preferences, and Rust backend for real-time system metrics (Mar 1, 2026)
- [x] Desktop Integration Diagnostics - Comprehensive system health panel that tests all native integrations (OS, memory, disk, CPU, directories, notifications, shortcuts, tray, clipboard, filesystem, network, audio, GPU). Features categorized results with status indicators (pass/warn/fail/skip), expandable details with fix suggestions, single-check re-run, category filtering, JSON export, clipboard copy, latency tracking, and overall health scoring. Includes full Rust backend with platform-specific checks for Linux (desktop env, D-Bus, libnotify), macOS, and Windows (Mar 1, 2026)
- [x] Timezone Widget - World clocks widget for AppWidgetsBar with searchable timezone database (30+ cities), add/remove/reorder clocks, day/night indicator (sun/moon icons), primary timezone selection with visual highlight, persistent localStorage storage, compact mode for sidebar integration, and comprehensive test coverage (Mar 1, 2026)
- [x] Calculator Widget Integration - Integrated CalculatorWidget into AppWidgetsBar with compact mode, updated to Svelte 5 reactivity ($state, $props, $derived), Discord-style theming, basic arithmetic, percentage, sign toggle, keyboard support, and calculation history (Mar 2, 2026)
- [x] Unit Converter Widget - Quick unit conversion widget with 6 categories (Length, Weight, Temperature, Time, Data, Volume), compact dropdown category picker, swap button for reverse conversions, proper temperature formula handling (C/F/K), scientific notation for large numbers, AppWidgetsBar integration, and full test coverage (Mar 2, 2026)

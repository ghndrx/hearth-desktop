# Task Queue — Hearth Desktop

Last updated: 2026-03-28
Pipeline: Hearth Desktop Competitive Analysis vs Discord Desktop

## P0 — Critical (Ship Now)

### Thread: In-Game Overlay System (#12_overlay_system.md) — Discord's Killer Feature

- [ ] **T-OVERLAY-01**: Implement Tauri transparent overlay window system
- [ ] **T-OVERLAY-02**: Build full-screen application detection
- [ ] **T-OVERLAY-03**: Create basic voice controls widget (mute/deafen/PTT status)
- [ ] **T-OVERLAY-04**: Integrate with existing global hotkey system

### Thread: Rich Presence & Activity Detection (#13_rich_presence_activity_detection.md) — Core Social Feature

- [ ] **T-PRESENCE-01**: Implement system process monitoring and enumeration
- [ ] **T-PRESENCE-02**: Build application detection database with game/app metadata
- [ ] **T-PRESENCE-03**: Create activity state management system
- [ ] **T-PRESENCE-04**: Implement basic presence display in user profile

---

## P1 — High (Next Sprint)

### Thread: Screen Sharing (#03_screen_share_system.md)

- [ ] **T-SCREEN-01**: Add `nokhwa` crate to `src-tauri/Cargo.toml` for cross-platform screen capture
- [ ] **T-SCREEN-02**: Implement `enumerate_sources()` Tauri command — list screens + windows
- [ ] **T-SCREEN-03**: Build Source Picker modal UI (Svelte) with thumbnail previews
- [ ] **T-SCREEN-04**: Implement `start_screen_share(sourceId, quality)` Tauri command
- [ ] **T-SCREEN-05**: Hook screen capture into existing WebRTC pipeline (PR #17 MediaStream track)
- [ ] **T-SCREEN-06**: Build ShareTile UI component (floating overlay showing active sharer)
- [ ] **T-SCREEN-07**: Implement quality controls (bitrate, resolution, FPS sliders)
- [ ] **T-SCREEN-08**: Implement `stop_screen_share()` command
- [ ] **T-SCREEN-09**: Test on Linux (X11 + Wayland via xdg-desktop-portal), macOS, Windows

### Thread: Video Calls (#04_video_calls_system.md)

- [ ] **T-VIDEO-01**: Add camera capture to existing WebRTC pipeline (extend PR #17)
- [ ] **T-VIDEO-02**: Implement `enumerate_cameras()` via browser `navigator.mediaDevices`
- [ ] **T-VIDEO-03**: Build camera picker dropdown UI with preview
- [ ] **T-VIDEO-04**: Implement `start_video(cameraId)` / `stop_video()` commands
- [ ] **T-VIDEO-05**: Build VideoGrid UI (1-tile, 2×2, 3×3, 4-col scrollable)
- [ ] **T-VIDEO-06**: Add speaking indicator overlay to video tiles
- [ ] **T-VIDEO-07**: Implement adaptive video quality (scale resolution/FPS by participant count)
- [ ] **T-VIDEO-08**: Integrate video toggle button into voice channel UI
- [ ] **T-VIDEO-09**: Test WebRTC video with 4+ simultaneous participants

### Thread: Message Threads (#05_message_threads_system.md)

- [ ] **T-THREAD-01**: Define Thread + ThreadMember data models in TypeScript
- [ ] **T-THREAD-02**: Add thread API client methods (`createThread`, `listThreads`, `getThreadMessages`)
- [ ] **T-THREAD-03**: Build Thread Pillar sidebar component
- [ ] **T-THREAD-04**: Build "Start thread" button (appears on message hover)
- [ ] **T-THREAD-05**: Build Thread view (separate message list + input)
- [ ] **T-THREAD-06**: Implement thread archive/unarchive
- [ ] **T-THREAD-07**: Implement auto-archive timer logic
- [ ] **T-THREAD-08**: Thread join/leave + notification preference toggle
- [ ] **T-THREAD-09**: Thread unread badge indicators
- [ ] **T-THREAD-10**: Integration test with real Hearth API thread endpoints

### Thread: Advanced Media Integration (#14_advanced_media_integration.md) — Productivity Differentiator

- [ ] **T-MEDIA-01**: Implement cross-platform screenshot capture (full screen, window, region)
- [ ] **T-MEDIA-02**: Build screenshot annotation UI with basic drawing tools
- [ ] **T-MEDIA-03**: Integrate global hotkey system for screenshot triggers
- [ ] **T-MEDIA-04**: Add instant upload pipeline for captured screenshots
- [ ] **T-MEDIA-05**: Implement clipboard monitoring with privacy controls
- [ ] **T-MEDIA-06**: Build drag-and-drop upload system with progress tracking

---

## P2 — Medium (Future)

- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Custom status messages (online/idle/dnd/custom)
- [ ] **T-P2-03**: Per-channel notification sounds
- [ ] **T-P2-04**: Keyboard shortcut customization UI
- [ ] **T-P2-05**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-06**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-07**: Message search with filters (from:, has:embed, during:, etc.)

---

### Thread: System Tray & Background (#06_system_tray_and_background_operation.md)

- [ ] **T-TRAY-01**: Extend `tray.rs` with full context menu (server/channel, mute/deafen, quit)
- [ ] **T-TRAY-02**: Implement window-close → minimize-to-tray (prevent quit on close)
- [ ] **T-TRAY-03**: Add unread badge counts to tray icon via platform APIs
- [ ] **T-TRAY-04**: Wire up `unread-count-changed` events from WebSocket to tray badge
- [ ] **T-TRAY-05**: Integrate `tauri-plugin-notification` for background desktop notifications
- [ ] **T-TRAY-06**: Handle notification click → open relevant channel
- [ ] **T-TRAY-07**: Test tray behavior on Windows, macOS, Linux

### Thread: Auto-Start & Window State (#07_auto_start_and_window_state.md)

- [ ] **T-AUTO-01**: Add `tauri-plugin-autostart` and `tauri-plugin-window-state` to `Cargo.toml`
- [ ] **T-AUTO-02**: Wire `is_autostart_enabled()` and `set_autostart(enabled)` Tauri commands
- [ ] **T-AUTO-03**: Configure `window-state` in `tauri.conf.json` plugins section
- [ ] **T-AUTO-04**: Add "Open on Startup" toggle to Settings UI
- [ ] **T-AUTO-05**: Test autostart registration on Windows, macOS, Ubuntu

### Thread: App Settings UI (#08_app_settings_and_preferences_ui.md)

- [ ] **T-SETTINGS-01**: Build `SettingsModal.svelte` container with sidebar navigation
- [ ] **T-SETTINGS-02**: Implement Appearance section (theme, font size, compact mode)
- [ ] **T-SETTINGS-03**: Implement Voice & Video section (device selectors, test buttons)
- [ ] **T-SETTINGS-04**: Implement Notifications section (desktop notifs, sounds toggles)
- [ ] **T-SETTINGS-05**: Implement App Settings section (autostart, minimize-to-tray, tray icon toggles)
- [ ] **T-SETTINGS-06**: Add My Account section (profile display, sign out)
- [ ] **T-SETTINGS-07**: Wire all settings to `settings` store with localStorage persistence
- [ ] **T-SETTINGS-08**: Integrate `tauri-plugin-store` for cross-session settings persistence

## Notes

- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
- Tray PRDs (#06, #07) depend on `tauri-plugin-notification`, `tauri-plugin-autostart`, `tauri-plugin-window-state` being added to Cargo.toml first

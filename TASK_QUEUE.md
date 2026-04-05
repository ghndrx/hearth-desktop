# Task Queue — Hearth Desktop

Last updated: 2026-04-05
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Shortcuts System (#23_global_shortcuts_system.md)

- [ ] **T-SHORTCUTS-01**: Add `tauri-plugin-global-shortcut` dependency to Cargo.toml
- [ ] **T-SHORTCUTS-02**: Implement GlobalHotkeyManager with basic registration/unregistration
- [ ] **T-SHORTCUTS-03**: Create push-to-talk start/end actions integrated with WebRTC voice pipeline
- [ ] **T-SHORTCUTS-04**: Implement toggle mute/deafen global shortcuts
- [ ] **T-SHORTCUTS-05**: Build shortcut configuration UI in Settings panel
- [ ] **T-SHORTCUTS-06**: Add overlay toggle hotkey (Ctrl+Shift+O) for PRD #20 integration

### Thread: Rich Notifications System (#24_rich_notifications_system.md)

- [ ] **T-NOTIF-01**: Enhance tauri-plugin-notification with action button support
- [ ] **T-NOTIF-02**: Implement notification grouping and batching logic
- [ ] **T-NOTIF-03**: Build Do Not Disturb scheduler with timezone support
- [ ] **T-NOTIF-04**: Implement notification action handlers (Reply, Mark as Read, Join Voice)
- [ ] **T-NOTIF-05**: Create per-server/channel notification customization UI
- [ ] **T-NOTIF-06**: Add notification sound manager with custom sound support

### Thread: System Tray Integration (#25_system_tray_integration.md)

- [ ] **T-TRAY-01**: Enhance existing tray with rich context menu system
- [ ] **T-TRAY-02**: Implement dynamic tray icon with unread indicators and badges
- [ ] **T-TRAY-03**: Build server/channel navigation in tray context menu
- [ ] **T-TRAY-04**: Add voice controls (mute, deafen, join/leave) to tray menu
- [ ] **T-TRAY-05**: Implement status and presence controls in tray
- [ ] **T-TRAY-06**: Integrate notification controls and DND toggle in tray menu

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

## Notes

- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team

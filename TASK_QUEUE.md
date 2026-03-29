# Task Queue — Hearth Desktop

Last updated: 2026-03-29
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys (#12_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Add `tauri-plugin-global-shortcut` dependency to Cargo.toml
- [ ] **T-HOTKEY-02**: Implement hotkey registration/unregistration system in src-tauri/src/hotkeys.rs
- [ ] **T-HOTKEY-05**: Integrate with WebRTC voice pipeline (PR #17) for PTT functionality
- [ ] **T-HOTKEY-06**: Implement push-to-talk state machine (hold key to transmit, release to mute)

### Thread: Advanced Tray System (#13_advanced_tray_system.md)

- [ ] **T-TRAY-01**: Extend existing tray.rs with context menu builder (Show, Status, Voice, Quit)
- [ ] **T-TRAY-05**: Implement minimize-to-tray preference setting (intercept close button)

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

### Thread: Global Hotkeys (#12_global_hotkeys_system.md)

- [ ] **T-HOTKEY-03**: Build hotkey conflict detection and resolution system
- [ ] **T-HOTKEY-04**: Add permission request flow for system access (macOS accessibility)
- [ ] **T-HOTKEY-07**: Add mute/unmute toggle with visual feedback in UI
- [ ] **T-HOTKEY-09**: Build hotkey customization UI settings panel

### Thread: Advanced Tray System (#13_advanced_tray_system.md)

- [ ] **T-TRAY-02**: Add status setting (Online/Away/DND) with persistence to local storage
- [ ] **T-TRAY-03**: Implement quick voice channel actions in tray menu
- [ ] **T-TRAY-04**: Add unread message badge overlay on tray icon
- [ ] **T-TRAY-06**: Add always-on-top toggle with hotkey integration

### Thread: Rich Notifications (#14_rich_notifications_system.md)

- [ ] **T-NOTIFY-01**: Extend notification system for action buttons (Reply, Mark Read)
- [ ] **T-NOTIFY-02**: Implement notification grouping/stacking by conversation
- [ ] **T-NOTIFY-05**: Implement Do Not Disturb with scheduling (weekdays/weekends)
- [ ] **T-NOTIFY-09**: Implement automatic idle/away detection via platform APIs

---

## P2 — Medium (Future)

- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-03**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-04**: Message search with filters (from:, has:embed, during:, etc.)
- [ ] **T-P2-05**: Game overlay system for in-game voice controls
- [ ] **T-P2-06**: URL protocol handling (hearth:// links for deep linking)
- [ ] **T-P2-07**: Hardware device integration (gaming headsets, RGB sync)

---

## Notes

- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
- **NEW**: P0 hotkeys and tray features are critical for Discord desktop parity
- Global hotkeys (T-HOTKEY-*) require platform-specific permissions on macOS/Linux
- Tray system (T-TRAY-*) should integrate with existing notification system
- Rich notifications (T-NOTIFY-*) complement the tray system for complete UX

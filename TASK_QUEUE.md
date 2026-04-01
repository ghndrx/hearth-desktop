# Task Queue — Hearth Desktop

Last updated: 2026-04-01
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys (#06_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Add `global-hotkey` crate to `src-tauri/Cargo.toml`
- [ ] **T-HOTKEY-02**: Implement `HotkeyManager` struct with cross-platform registration
- [ ] **T-HOTKEY-03**: Create Tauri commands `register_hotkey()`, `unregister_hotkey()`
- [ ] **T-HOTKEY-04**: Implement `ActionRouter` to map hotkey events to voice actions
- [ ] **T-HOTKEY-05**: Connect hotkeys to existing voice system (mute, push-to-talk)
- [ ] **T-HOTKEY-06**: Add hotkey conflict detection and resolution logic
- [ ] **T-HOTKEY-07**: Build hotkey configuration UI in settings panel
- [ ] **T-HOTKEY-08**: Add visual feedback for active hotkeys in system tray
- [ ] **T-HOTKEY-09**: Test <50ms latency requirement across platforms

### Thread: Rich Desktop Notifications (#08_rich_desktop_notifications.md)

- [ ] **T-NOTIFY-01**: Implement `NotificationManager` with platform-specific backends
- [ ] **T-NOTIFY-02**: Add rich content support (avatar, media previews, formatting)
- [ ] **T-NOTIFY-03**: Implement interactive actions (reply, mark read, join voice)
- [ ] **T-NOTIFY-04**: Build notification grouping and management system
- [ ] **T-NOTIFY-05**: Add priority levels and quiet hours functionality
- [ ] **T-NOTIFY-06**: Deep OS integration (Action Center, Notification Center)
- [ ] **T-NOTIFY-07**: Implement system tray badge count display
- [ ] **T-NOTIFY-08**: Build comprehensive notification settings UI
- [ ] **T-NOTIFY-09**: Test <500ms display latency and 95%+ delivery rate

### Thread: Game Overlay System (#07_game_overlay_system.md) *Depends on T-HOTKEY*

- [ ] **T-OVERLAY-01**: Research and implement DirectX/Vulkan overlay injection
- [ ] **T-OVERLAY-02**: Create shared memory IPC between game and host process
- [ ] **T-OVERLAY-03**: Implement game process detection and monitoring
- [ ] **T-OVERLAY-04**: Build basic overlay rendering with ImGui or custom renderer
- [ ] **T-OVERLAY-05**: Connect overlay to existing WebRTC voice infrastructure
- [ ] **T-OVERLAY-06**: Add voice participant display with speaking indicators
- [ ] **T-OVERLAY-07**: Implement overlay positioning and transparency controls
- [ ] **T-OVERLAY-08**: Add anti-cheat compatibility (BattlEye, EasyAntiCheat coordination)
- [ ] **T-OVERLAY-09**: Test <5% performance impact across 50+ popular games

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

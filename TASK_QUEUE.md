# Task Queue — Hearth Desktop

Last updated: 2026-04-03
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys & Push-to-Talk (#06_global_hotkeys_and_ptt.md)

- [ ] **T-HOTKEY-01**: Add `tauri-plugin-global-hotkey` dependency to `src-tauri/Cargo.toml`
- [ ] **T-HOTKEY-02**: Implement global mute/unmute hotkey (default: Ctrl+Shift+M)
- [ ] **T-HOTKEY-03**: Implement global deafen hotkey (default: Ctrl+Shift+D)
- [ ] **T-HOTKEY-04**: Build hotkey registration system with conflict detection
- [ ] **T-HOTKEY-05**: Implement push-to-talk functionality with configurable key
- [ ] **T-HOTKEY-06**: Add PTT press/release event handling to WebRTC pipeline
- [ ] **T-HOTKEY-07**: Create hotkey settings UI page with customization options
- [ ] **T-HOTKEY-08**: Add visual feedback for PTT activation in voice UI
- [ ] **T-HOTKEY-09**: Test cross-platform compatibility (Windows, macOS, Linux)

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

### Thread: Multi-Window Management (#07_multi_window_management.md)

- [ ] **T-WINDOW-01**: Implement window creation and management system in Rust backend
- [ ] **T-WINDOW-02**: Create pop-out voice channel overlay window functionality
- [ ] **T-WINDOW-03**: Implement always-on-top functionality for overlay windows
- [ ] **T-WINDOW-04**: Build compact voice participant UI for overlay windows
- [ ] **T-WINDOW-05**: Add window positioning and resizing capabilities
- [ ] **T-WINDOW-06**: Implement window state persistence across app restarts
- [ ] **T-WINDOW-07**: Create inter-window communication for voice state sync
- [ ] **T-WINDOW-08**: Add gaming mode (minimal transparent overlay)
- [ ] **T-WINDOW-09**: Test multi-monitor support and cross-platform compatibility

### Thread: Advanced Notifications (#08_advanced_notification_system.md)

- [ ] **T-NOTIFY-01**: Enhance notification system with rich content and actions
- [ ] **T-NOTIFY-02**: Implement per-channel notification settings
- [ ] **T-NOTIFY-03**: Build quiet hours functionality with timezone awareness
- [ ] **T-NOTIFY-04**: Add custom notification sounds with upload capability
- [ ] **T-NOTIFY-05**: Implement notification grouping and threading
- [ ] **T-NOTIFY-06**: Create comprehensive notification settings UI
- [ ] **T-NOTIFY-07**: Add notification actions (reply, mark read, join voice)
- [ ] **T-NOTIFY-08**: Integrate platform Do Not Disturb modes
- [ ] **T-NOTIFY-09**: Test notification delivery across platforms

---

## P2 — Medium (Future)

- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Custom status messages (online/idle/dnd/custom)
- [ ] **T-P2-03**: Advanced notification analytics and insights
- [ ] **T-P2-04**: Chat pop-out windows (beyond voice channels)
- [ ] **T-P2-05**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-06**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-07**: Message search with filters (from:, has:embed, during:, etc.)

---

## Notes

- **P0 Global Hotkeys**: Critical for desktop parity with Discord — users expect PTT functionality
- **P1 Multi-Window**: Voice overlay dependency on global hotkeys for optimal UX
- **P1 Advanced Notifications**: Integrates with multi-window system for overlay notifications
- All existing P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
- Window management system should coordinate with global hotkeys for keyboard shortcuts

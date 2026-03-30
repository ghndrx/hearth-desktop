# Task Queue — Hearth Desktop

Last updated: 2026-03-29
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys (#12_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Add `tauri-plugin-global-shortcut` and `rdev` crates for global input monitoring
- [ ] **T-HOTKEY-02**: Implement cross-platform hotkey registration (Windows/macOS/Linux)
- [ ] **T-HOTKEY-03**: Build hotkey configuration UI with key combination capture
- [ ] **T-HOTKEY-04**: Implement Push-to-Talk (PTT) functionality with voice pipeline integration
- [ ] **T-HOTKEY-05**: Add global mute/unmute toggle hotkey
- [ ] **T-HOTKEY-06**: Implement deafen toggle for complete audio isolation
- [ ] **T-HOTKEY-07**: Add permission handling for global input monitoring (especially macOS)
- [ ] **T-HOTKEY-08**: Test hotkey latency (target < 50ms) and conflict detection
- [ ] **T-HOTKEY-09**: Integrate hotkeys with existing voice infrastructure from PR #17

### Thread: Gaming Overlay (#15_gaming_overlay_system.md)

- [ ] **T-OVERLAY-01**: Add graphics API detection library (DirectX, OpenGL, Vulkan detection)
- [ ] **T-OVERLAY-02**: Implement basic overlay injector for DirectX 11 games
- [ ] **T-OVERLAY-03**: Build overlay window management and rendering pipeline
- [ ] **T-OVERLAY-04**: Create game process detection and monitoring system
- [ ] **T-OVERLAY-05**: Implement global overlay show/hide hotkey with game compatibility
- [ ] **T-OVERLAY-06**: Build voice controls UI for overlay (mute, deafen, volume)
- [ ] **T-OVERLAY-07**: Add text chat interface within overlay with message sending
- [ ] **T-OVERLAY-08**: Implement anti-cheat compatibility and safe injection methods
- [ ] **T-OVERLAY-09**: Test with top 20 Steam games and major anti-cheat systems

### Thread: Rich Notifications (#16_rich_notifications_system.md)

- [ ] **T-NOTIF-01**: Build notification manager with platform-specific handlers
- [ ] **T-NOTIF-02**: Implement rich notification templates with avatars and previews
- [ ] **T-NOTIF-03**: Add interactive notification buttons (Reply, Mark as Read, Mute)
- [ ] **T-NOTIF-04**: Create direct reply system with inline text input
- [ ] **T-NOTIF-05**: Implement Windows toast notifications with action buttons
- [ ] **T-NOTIF-06**: Add macOS User Notifications with quick reply support
- [ ] **T-NOTIF-07**: Build Linux notification system with DBus integration
- [ ] **T-NOTIF-08**: Add notification grouping and conversation threading
- [ ] **T-NOTIF-09**: Integrate with existing message pipeline and voice call notifications

### Thread: File & Media Handling (#17_file_media_handling_system.md)

- [ ] **T-FILE-01**: Implement cross-platform drag-and-drop file handling
- [ ] **T-FILE-02**: Build file upload manager with progress tracking and cancellation
- [ ] **T-FILE-03**: Add thumbnail generation for images, videos, and documents
- [ ] **T-FILE-04**: Create image preview modal with zoom and navigation controls
- [ ] **T-FILE-05**: Implement embedded video player with playback controls
- [ ] **T-FILE-06**: Build file download manager with resume capability
- [ ] **T-FILE-07**: Add file cache system with LRU eviction and size limits
- [ ] **T-FILE-08**: Create file validation and security scanning system
- [ ] **T-FILE-09**: Integrate with message system for file attachment sending/receiving

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

### Thread: Advanced Window Management (#13_advanced_window_management.md)

- [ ] **T-WINDOW-01**: Implement multi-window support with window identifier system
- [ ] **T-WINDOW-02**: Add window state persistence (size, position, layout)
- [ ] **T-WINDOW-03**: Build Picture-in-Picture (PiP) mode for video calls
- [ ] **T-WINDOW-04**: Implement always-on-top functionality for gaming overlay
- [ ] **T-WINDOW-05**: Add window transparency and opacity controls
- [ ] **T-WINDOW-06**: Build window manager UI for creating/managing multiple windows
- [ ] **T-WINDOW-07**: Implement window layout save/restore system
- [ ] **T-WINDOW-08**: Add multi-monitor support with monitor-specific positioning
- [ ] **T-WINDOW-09**: Test cross-platform window behavior and performance

### Thread: Rich Tray Integration (#14_rich_tray_integration.md)

- [ ] **T-TRAY-01**: Upgrade basic tray with rich context menu and quick actions
- [ ] **T-TRAY-02**: Implement dynamic icon generation with status overlays
- [ ] **T-TRAY-03**: Add notification badge system with unread message count
- [ ] **T-TRAY-04**: Build tray icon animation system (pulse, flash, bounce)
- [ ] **T-TRAY-05**: Implement status selection from tray menu (online/away/DND)
- [ ] **T-TRAY-06**: Add voice channel quick actions (join/leave, mute toggle)
- [ ] **T-TRAY-07**: Implement cross-platform tray theming (light/dark modes)
- [ ] **T-TRAY-08**: Add quick reply and notification management from tray
- [ ] **T-TRAY-09**: Test tray functionality across Windows/macOS/Linux desktop environments

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

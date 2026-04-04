# Task Queue — Hearth Desktop

Last updated: 2026-04-04
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys (#06_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Integrate `tauri-plugin-global-shortcut` into project dependencies
- [ ] **T-HOTKEY-02**: Implement basic Push-to-Talk (PTT) global hotkey with hold/release functionality
- [ ] **T-HOTKEY-03**: Add Mute/Unmute toggle global hotkey for microphone control
- [ ] **T-HOTKEY-04**: Build HotkeyRecorder UI component for key combination capture
- [ ] **T-HOTKEY-05**: Implement hotkey conflict detection and user-friendly resolution flow
- [ ] **T-HOTKEY-06**: Add system tray status indicators for mute/deafen states
- [ ] **T-HOTKEY-07**: Cross-platform testing on Windows 10/11, macOS 12+, Ubuntu 20.04+

### Thread: Rich Notifications (#07_rich_notifications_system.md)

- [ ] **T-NOTIFY-01**: Enhance tauri-plugin-notification with action button support
- [ ] **T-NOTIFY-02**: Implement inline reply functionality in notifications
- [ ] **T-NOTIFY-03**: Add quick action buttons (mark as read, emoji reactions)
- [ ] **T-NOTIFY-04**: Build notification grouping for multiple messages from same user/channel
- [ ] **T-NOTIFY-05**: Implement rich media previews (images, videos) in notifications
- [ ] **T-NOTIFY-06**: Add Do Not Disturb integration with system focus modes
- [ ] **T-NOTIFY-07**: Test notification delivery and interaction across all target platforms

---

## P1 — High (Next Sprint)

### Thread: File System Integration (#08_file_system_integration.md)

- [ ] **T-FILE-01**: Implement drag-and-drop file detection and visual drop zones
- [ ] **T-FILE-02**: Add multi-file upload with progress tracking and queue management
- [ ] **T-FILE-03**: Build image thumbnail generation and inline preview system
- [ ] **T-FILE-04**: Implement video preview with playback controls and thumbnails
- [ ] **T-FILE-05**: Add file type validation and security scanning before upload
- [ ] **T-FILE-06**: Build FileDropZone and FilePreview Svelte components
- [ ] **T-FILE-07**: Implement download progress tracking and file organization
- [ ] **T-FILE-08**: Add OS-specific integrations (context menus, file associations)
- [ ] **T-FILE-09**: Cross-platform file system testing and error handling

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

- **P0 Priorities**: Global hotkeys and rich notifications are critical for competitive parity with Discord
- **Gaming Focus**: Push-to-talk (T-HOTKEY-02) is essential for gaming community adoption
- **Notification Engagement**: Inline reply (T-NOTIFY-02) can significantly reduce context switching
- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
- File system integration (T-FILE-*) requires security review for malware scanning implementation

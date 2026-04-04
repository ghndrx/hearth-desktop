# Task Queue — Hearth Desktop

Last updated: 2026-04-04
Pipeline: Hearth Desktop Competitive Intelligence vs Discord Desktop

## P0 — Critical (Ship Now)

### Thread: Enhanced System Tray (#12_enhanced_system_tray.md)

- [ ] **T-TRAY-01**: Implement rich context menu structure with status controls and voice toggles
- [ ] **T-TRAY-02**: Add dynamic tray icon states for unread counts and connection status
- [ ] **T-TRAY-03**: Integrate voice controls (mute/deafen/disconnect) with existing WebRTC system

### Thread: Offline Functionality (#13_offline_functionality.md)

- [ ] **T-OFFLINE-01**: Implement SQLite-based message caching system (last 100 messages per channel)
- [ ] **T-OFFLINE-02**: Build connection status monitoring and offline detection
- [ ] **T-OFFLINE-03**: Create outgoing message queue with persistence across app restarts

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

### Thread: Advanced Window Management (#11_advanced_window_management.md)

- [ ] **T-WINDOW-01**: Implement window transparency control with hardware acceleration
- [ ] **T-WINDOW-02**: Add global shortcut for transparency toggle
- [ ] **T-WINDOW-03**: Build voice channel pop-out window functionality
- [ ] **T-WINDOW-04**: Implement window state persistence across app restarts
- [ ] **T-WINDOW-05**: Create picture-in-picture mode for voice calls (draggable, snap-to-edges)
- [ ] **T-WINDOW-06**: Add always-on-top mode with cross-platform compatibility
- [ ] **T-WINDOW-07**: Build window management settings UI with transparency slider

### Thread: Enhanced System Tray Completion (#12_enhanced_system_tray.md)

- [ ] **T-TRAY-04**: Add platform-specific badge integration (Windows taskbar, macOS dock)
- [ ] **T-TRAY-05**: Implement notification pause/resume controls in tray menu
- [ ] **T-TRAY-06**: Add server navigation submenu with recent servers
- [ ] **T-TRAY-07**: Create keyboard shortcuts for tray actions
- [ ] **T-TRAY-08**: Test tray functionality across platforms (Windows, macOS, Linux)

### Thread: Offline Functionality Completion (#13_offline_functionality.md)

- [ ] **T-OFFLINE-04**: Build automatic sync engine with conflict resolution
- [ ] **T-OFFLINE-05**: Implement progressive sync with loading states on reconnection
- [ ] **T-OFFLINE-06**: Add offline UI indicators and cached message visual distinction
- [ ] **T-OFFLINE-07**: Create queue management interface with manual retry controls
- [ ] **T-OFFLINE-08**: Add cache size management and automatic cleanup (50MB limit)
- [ ] **T-OFFLINE-09**: Test offline workflow end-to-end with network simulation

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

- **P0 System Tray** and **P0 Offline** are critical for desktop app competitive parity with Discord
- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
- **Window Management** requires Tauri 2.x features — verify compatibility before implementation
- **Offline functionality** needs SQLite database schema — coordinate with backend team on data models
- **System Tray** implementation varies significantly by platform — prioritize Windows/macOS for initial release

# Task Queue — Hearth Desktop

Last updated: 2026-03-31
Pipeline: Hearth Desktop PRD Competitive Analysis - Discord Parity Focus

## P0 — Critical (Ship Now)

### Thread: Native OS Integration (#06_native_os_integration_system.md)

- [ ] **T-TRAY-01**: Enhanced tray context menu implementation
- [ ] **T-TRAY-02**: Minimize-to-tray window behavior
- [ ] **T-TRAY-03**: Show/hide window controls from tray
- [ ] **T-TRAY-04**: Voice controls integration (mute/deafen)
- [ ] **T-BADGE-01**: Badge count API integration with message system
- [ ] **T-BADGE-02**: Platform-specific badge implementations (Windows/macOS/Linux)
- [ ] **T-BADGE-03**: Dynamic tray icon generation with overlays
- [ ] **T-BADGE-04**: Status indicator system (online/away/dnd)

### Thread: Global Hotkeys System (#07_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Global shortcut registration system using tauri-plugin-global-shortcut
- [ ] **T-HOTKEY-02**: Push-to-talk implementation with voice integration
- [ ] **T-HOTKEY-03**: Global mute/deafen toggle hotkeys
- [ ] **T-HOTKEY-04**: Hotkey conflict detection and user notification
- [ ] **T-IDLE-01**: System idle time detection (Windows/macOS/Linux)
- [ ] **T-IDLE-02**: Auto-away status based on configurable idle thresholds
- [ ] **T-IDLE-03**: User preference controls for idle behavior

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

### Thread: Game Overlay & Multi-Window (#08_game_overlay_multiwindow_system.md)

- [ ] **T-GAME-01**: Process monitoring and game detection system
- [ ] **T-GAME-02**: Popular games database with overlay configurations
- [ ] **T-GAME-03**: Fullscreen detection and window state monitoring
- [ ] **T-OVERLAY-01**: Transparent overlay window creation
- [ ] **T-OVERLAY-02**: Basic voice controls UI in overlay
- [ ] **T-OVERLAY-03**: Overlay positioning and game window tracking
- [ ] **T-WINDOW-01**: Voice channel pop-out windows
- [ ] **T-WINDOW-02**: Always-on-top window management
- [ ] **T-WINDOW-03**: Window state persistence across sessions
- [ ] **T-WINDOW-04**: Multi-monitor awareness and positioning

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

- **P0 Critical Path**: Native OS integration (PRD #06) and global hotkeys (PRD #07) are foundational desktop features — prioritize these for immediate Discord parity
- **Voice Integration**: T-HOTKEY-02 depends on existing voice infrastructure from WebRTC PR #17
- **Dependency Chain**: T-TRAY-04 voice controls require T-HOTKEY-03 global hotkey foundation
- **Platform Testing**: T-BADGE-02, T-IDLE-01, T-GAME-03 require extensive cross-platform validation
- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
- Game overlay system (PRD #08) requires careful anti-cheat compatibility testing

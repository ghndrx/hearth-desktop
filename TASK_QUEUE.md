# Task Queue — Hearth Desktop

Last updated: 2026-03-29
Pipeline: Discord Competitive Parity Analysis - Desktop Features

## P0 — Critical (Ship Now)

### Thread: Native File Integration (#12_native_file_integration_system.md)

- [ ] **T-FILE-01**: Add `tauri-plugin-dialog`, `tauri-plugin-clipboard`, `tauri-plugin-fs` to Cargo.toml
- [ ] **T-FILE-02**: Implement file type validation and security checks (whitelist, header validation)
- [ ] **T-FILE-03**: Build FileDropZone.svelte component with drag & drop visual feedback
- [ ] **T-FILE-04**: Implement native file dialog integration with multi-file selection
- [ ] **T-FILE-05**: Add clipboard paste handling for images and files (Ctrl+V in chat)
- [ ] **T-FILE-06**: Create FilePreviewModal.svelte with thumbnail generation for images
- [ ] **T-FILE-07**: Implement chunked file upload with progress tracking and pause/resume
- [ ] **T-FILE-08**: Register `hearth://` protocol handler for deep linking
- [ ] **T-FILE-09**: Add `.hearth` file association for backup/export files

### Thread: Rich System Tray & Window Management (#13_rich_system_tray_window_management.md)

- [ ] **T-TRAY-01**: Implement dynamic tray icon generation with status overlays
- [ ] **T-TRAY-02**: Build rich context menu with user status controls (online/away/DND/invisible)
- [ ] **T-TRAY-03**: Add quick actions to tray menu (mute/deafen, open channels, settings)
- [ ] **T-TRAY-04**: Implement cross-platform badge count system (macOS dock, Windows taskbar)
- [ ] **T-TRAY-05**: Add unread message indicator overlay to tray icon
- [ ] **T-TRAY-06**: Implement always-on-top window mode with keyboard shortcut
- [ ] **T-TRAY-07**: Add minimize behavior options (taskbar, tray only, close-to-tray)
- [ ] **T-TRAY-08**: Create window state persistence (position, size, monitor)
- [ ] **T-TRAY-09**: Enhance notifications with action buttons (Reply, Mark Read, Join Voice)

### Thread: Game Integration & Rich Presence (#14_game_integration_rich_presence.md)

- [ ] **T-GAME-01**: Implement cross-platform game process detection and scanning
- [ ] **T-GAME-02**: Build game database with top 100 popular games (Steam, Epic, Battle.net)
- [ ] **T-GAME-03**: Create rich presence display system with game details and time tracking
- [ ] **T-GAME-04**: Integrate Steam Web API for game library and achievements
- [ ] **T-GAME-05**: Add Epic Games Store API integration
- [ ] **T-GAME-06**: Build GameStatusCard.svelte component for user presence display
- [ ] **T-GAME-07**: Implement social gaming features (Join Game, Ask to Join, Spectate)
- [ ] **T-GAME-08**: Create party system with voice channel auto-join
- [ ] **T-GAME-09**: Add privacy controls for game detection and presence sharing

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

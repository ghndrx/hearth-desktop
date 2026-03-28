# Task Queue — Hearth Desktop

Last updated: 2026-03-27
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Native OS Integration (#12_native_os_integration_system.md)

- [ ] **T-OS-01**: Implement system tray with show/hide toggle and status indicator
- [ ] **T-OS-02**: Add minimize-to-tray functionality with user preferences
- [ ] **T-OS-03**: Build native OS notifications with action buttons (Reply, Mark Read)
- [ ] **T-OS-04**: Implement auto-startup registration for Windows/macOS/Linux
- [ ] **T-OS-05**: Add always-on-top window management for voice channels

### Thread: Advanced Moderation & Safety (#13_advanced_moderation_safety_system.md)

- [ ] **T-MOD-01**: Build role-based permission system with granular channel controls
- [ ] **T-MOD-02**: Implement auto-moderation engine for spam and explicit content detection
- [ ] **T-MOD-03**: Create audit logging system for all moderation actions
- [ ] **T-MOD-04**: Build advanced reporting system with evidence collection
- [ ] **T-MOD-05**: Add content filtering with safety warnings and age-appropriate controls

### Thread: Global Hotkeys (#06_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Implement basic Tauri global hotkey registration system
- [ ] **T-HOTKEY-02**: Add push-to-talk global shortcut integration with WebRTC voice
- [ ] **T-HOTKEY-03**: Implement system-wide mute/deafen shortcuts (Ctrl+Shift+M/D)
- [ ] **T-HOTKEY-04**: Build keybinding settings UI with conflict detection

### Thread: Game Detection (#07_game_detection_activity_system.md)

- [ ] **T-GAME-01**: Implement cross-platform process detection for running games
- [ ] **T-GAME-02**: Build game database with top 50 Steam games metadata
- [ ] **T-GAME-03**: Create "Currently Playing" status display in user profiles
- [ ] **T-GAME-04**: Add privacy controls for activity sharing preferences

---

## P1 — High (Next Sprint)

### Thread: Developer Platform & Integrations (#14_developer_platform_integrations.md)

- [ ] **T-DEV-01**: Build Bot API foundation with OAuth 2.0 authentication and permissions
- [ ] **T-DEV-02**: Implement slash commands framework with parameter validation
- [ ] **T-DEV-03**: Create webhook infrastructure with event filtering and retry logic
- [ ] **T-DEV-04**: Build API key management system with rate limiting and scopes
- [ ] **T-DEV-05**: Develop rich embeds system for enhanced message formatting
- [ ] **T-DEV-06**: Create TypeScript/JavaScript SDK with comprehensive documentation
- [ ] **T-DEV-07**: Build developer portal with application management and testing tools

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

### Thread: Advanced File & Media (#08_advanced_file_media_system.md)

- [ ] **T-FILE-01**: Implement drag-and-drop file handling with visual feedback
- [ ] **T-FILE-02**: Build file upload queue with progress tracking and pause/resume
- [ ] **T-FILE-03**: Create image thumbnail generation and optimization pipeline
- [ ] **T-FILE-04**: Build rich media viewer (lightbox for images, custom video player)
- [ ] **T-FILE-05**: Implement intelligent file compression for images/videos
- [ ] **T-FILE-06**: Add basic screen recording functionality (MP4 + GIF)
- [ ] **T-FILE-07**: Create file type validation and security scanning
- [ ] **T-FILE-08**: Build file management interface with search and categorization

---

## P2 — Medium (Future)

### Core P2 Features
- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Custom status messages (online/idle/dnd/custom)
- [ ] **T-P2-03**: Per-channel notification sounds
- [ ] **T-P2-04**: Keyboard shortcut customization UI
- [ ] **T-P2-05**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-06**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-07**: Message search with filters (from:, has:embed, during:, etc.)

### Advanced Gaming Features
- [ ] **T-P2-08**: Rich Presence SDK integration (Steam, Epic Games)
- [ ] **T-P2-09**: Game overlay implementation for in-game chat
- [ ] **T-P2-10**: Auto-detect streaming mode (OBS, Streamlabs) with optimized settings
- [ ] **T-P2-11**: Hardware acceleration for better gaming performance
- [ ] **T-P2-12**: Game-specific audio profiles and noise suppression

### Advanced Desktop Integration
- [ ] **T-P2-13**: Multi-window support (detachable voice channels, floating controls)
- [ ] **T-P2-14**: Picture-in-picture mode for voice controls during games
- [ ] **T-P2-15**: Advanced notification system with action buttons
- [ ] **T-P2-16**: Cloud storage integration (Google Drive, Dropbox, OneDrive)
- [ ] **T-P2-17**: Advanced themes and accessibility features (high contrast, zoom)

---

## Notes

- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team

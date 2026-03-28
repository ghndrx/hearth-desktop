# Task Queue — Hearth Desktop

Last updated: 2026-03-26
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys Foundation (#12_global_hotkeys_game_overlay_system.md)

- [ ] **T-HOTKEY-01**: Add `global-hotkey` crate to `src-tauri/Cargo.toml` for system-wide hotkey capture
- [ ] **T-HOTKEY-02**: Implement cross-platform hotkey registration system (Windows/macOS/Linux)
- [ ] **T-HOTKEY-03**: Build basic push-to-talk implementation with <50ms latency
- [ ] **T-HOTKEY-04**: Create hotkey configuration UI in Settings with conflict detection
- [ ] **T-HOTKEY-05**: Integrate PTT with existing WebRTC audio pipeline
- [ ] **T-HOTKEY-06**: Implement global mute/unmute hotkey functionality

### Thread: Native OS Integration (#15_native_os_integration_file_handling.md)

- [ ] **T-OS-01**: Add `tauri-plugin-dialog` and `tauri-plugin-fs` for native file handling
- [ ] **T-OS-02**: Implement cross-platform drag-and-drop file system
- [ ] **T-OS-03**: Build native file dialog integration with OS-specific features
- [ ] **T-OS-04**: Create platform-specific integrations (Windows Jump Lists, macOS Touch Bar, Linux D-Bus)
- [ ] **T-OS-05**: Implement hearth:// protocol registration and deep linking
- [ ] **T-OS-06**: Build rich clipboard integration with multi-format support

### Thread: Advanced Notification System (#16_advanced_notification_system.md)

- [ ] **T-NOTIF-01**: Implement rich notification data structures with actions and media
- [ ] **T-NOTIF-02**: Build intelligent notification grouping and prioritization engine
- [ ] **T-NOTIF-03**: Create cross-platform notification rendering with OS integration
- [ ] **T-NOTIF-04**: Implement inline reply and quick action functionality
- [ ] **T-NOTIF-05**: Build notification center integration and persistent history
- [ ] **T-NOTIF-06**: Create smart filtering system with context awareness (gaming mode, DND)

### Thread: Anti-Cheat Compatibility (#17_anticheat_compatibility_gaming_integration.md)

- [ ] **T-ANTICHEAT-01**: Build safe game overlay injection system with anti-cheat detection
- [ ] **T-ANTICHEAT-02**: Create anti-cheat compatibility database and validation system
- [ ] **T-ANTICHEAT-03**: Implement BattlEye/EasyAntiCheat/Vanguard safe overlay methods
- [ ] **T-ANTICHEAT-04**: Build process monitoring and safety validation pipeline
- [ ] **T-ANTICHEAT-05**: Test compatibility with top 50 Steam games
- [ ] **T-ANTICHEAT-06**: Create performance monitoring and gaming mode optimization

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

### Thread: Game Overlay System (#12_global_hotkeys_game_overlay_system.md)

- [ ] **T-OVERLAY-01**: Implement game process detection and fullscreen monitoring
- [ ] **T-OVERLAY-02**: Build DirectX/OpenGL overlay injection system for Windows
- [ ] **T-OVERLAY-03**: Create basic overlay UI (voice activity indicators, mute controls)
- [ ] **T-OVERLAY-04**: Implement overlay positioning and configuration system
- [ ] **T-OVERLAY-05**: Add overlay performance optimization (<2% game impact)
- [ ] **T-OVERLAY-06**: Test overlay compatibility with top 20 Steam games
- [ ] **T-OVERLAY-07**: Implement macOS Metal overlay and Linux OpenGL overlay

### Thread: Rich Presence System (#13_rich_presence_activity_system.md)

- [ ] **T-PRESENCE-01**: Build cross-platform process monitoring for activity detection
- [ ] **T-PRESENCE-02**: Implement game/application classification and metadata extraction
- [ ] **T-PRESENCE-03**: Create activity broadcasting WebSocket integration
- [ ] **T-PRESENCE-04**: Build Spotify integration for music activity sharing
- [ ] **T-PRESENCE-05**: Implement custom status message system with emoji support
- [ ] **T-PRESENCE-06**: Add privacy controls for selective activity sharing
- [ ] **T-PRESENCE-07**: Create VS Code/IDE integration for development activity

### Thread: Advanced Window Management (#14_advanced_window_system_tray.md)

- [ ] **T-WINDOW-01**: Implement window state persistence across app restarts
- [ ] **T-WINDOW-02**: Build multi-monitor position memory and adaptation system
- [ ] **T-WINDOW-03**: Add always-on-top mode for voice channel popouts
- [ ] **T-WINDOW-04**: Create enhanced system tray with rich notifications and actions
- [ ] **T-WINDOW-05**: Implement smart badge counting (mentions vs. regular messages)
- [ ] **T-WINDOW-06**: Build dynamic tray context menu with quick actions
- [ ] **T-WINDOW-07**: Add window transparency and advanced behavior controls

### Thread: Streaming & Gaming Hardware (#17_anticheat_compatibility_gaming_integration.md)

- [ ] **T-STREAM-01**: Build OBS Studio plugin with voice activity and chat overlay sources
- [ ] **T-STREAM-02**: Implement Stream Deck integration with dynamic button controls
- [ ] **T-STREAM-03**: Create cross-platform RGB gaming peripheral integration
- [ ] **T-STREAM-04**: Build Twitch/YouTube chat synchronization system
- [ ] **T-STREAM-05**: Implement gaming hardware macro and hotkey integration
- [ ] **T-STREAM-06**: Create competitive gaming mode with ultra-low latency optimization
- [ ] **T-STREAM-07**: Build game detection and automatic performance profile switching

---

## P2 — Medium (Future)

- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Custom status messages (online/idle/dnd/custom)
- [ ] **T-P2-03**: Per-channel notification sounds
- [ ] **T-P2-04**: Keyboard shortcut customization UI
- [ ] **T-P2-05**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-06**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-07**: Message search with filters (from:, has:embed, during:, etc.)
- [ ] **T-P2-08**: Advanced overlay features (text chat overlay, settings panel)
- [ ] **T-P2-09**: Anti-cheat compatibility testing and game-specific optimizations
- [ ] **T-P2-10**: Activity-based social features (friend suggestions, activity filtering)
- [ ] **T-P2-11**: Window layout profiles for different work contexts
- [ ] **T-P2-12**: Voice-controlled window management and automation triggers
- [ ] **T-P2-13**: External integration marketplace for custom activity plugins
- [ ] **T-P2-14**: AI-powered layout suggestions and activity recognition

---

## Notes

- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team

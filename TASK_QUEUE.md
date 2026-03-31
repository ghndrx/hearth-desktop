# Task Queue — Hearth Desktop

Last updated: 2026-03-26
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Auto-Away/Idle Detection System (#09_auto_away_idle_detection_system.md)

- [ ] **T-IDLE-01**: Implement cross-platform system idle time detection (Windows/macOS/Linux)
- [ ] **T-IDLE-02**: Add presence manager with configurable idle threshold (5-30min, default 10min)
- [ ] **T-IDLE-03**: Implement automatic status updates (Online ↔ Away based on activity)
- [ ] **T-IDLE-04**: Add screen lock detection for instant Away status
- [ ] **T-IDLE-05**: Build idle detection settings UI with threshold configuration
- [ ] **T-IDLE-06**: Integrate with voice system (disable auto-away during voice channels)

### Thread: Rich Interactive Notifications (#10_rich_interactive_notifications.md)

- [ ] **T-NOTIFY-01**: Enhance notification system with interactive actions (Reply, Mark Read, React)
- [ ] **T-NOTIFY-02**: Add rich content display (avatars, server/channel context, formatted text)
- [ ] **T-NOTIFY-03**: Implement reply-from-notification capability without opening app
- [ ] **T-NOTIFY-04**: Build notification center with grouped notifications and history
- [ ] **T-NOTIFY-05**: Add notification management (snooze, dismiss, batch operations)
- [ ] **T-NOTIFY-06**: Implement quiet hours and DND integration

### Thread: Custom Notification Sounds (#11_custom_notification_sounds.md)

- [ ] **T-SOUND-01**: Implement audio playback engine with rodio (MP3/WAV/OGG/M4A support)
- [ ] **T-SOUND-02**: Build hierarchical sound system (Global → Server → Channel → User)
- [ ] **T-SOUND-03**: Add custom sound file upload, validation, and management system
- [ ] **T-SOUND-04**: Build sound selector UI with preview capability
- [ ] **T-SOUND-05**: Implement per-server and per-channel sound assignment interface
- [ ] **T-SOUND-06**: Add independent notification volume control

### Thread: Global Hotkeys System (#07_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Add `tauri-plugin-global-shortcut` and `rdev` dependencies to Cargo.toml
- [ ] **T-HOTKEY-02**: Implement global push-to-talk hotkey registration (default F13)
- [ ] **T-HOTKEY-03**: Implement global mute/unmute toggle with system tray visual feedback
- [ ] **T-HOTKEY-04**: Add hotkey conflict detection and resolution system
- [ ] **T-HOTKEY-05**: Build hotkey settings UI with live testing capability

### Thread: Advanced System Tray (#06_advanced_system_tray_window_management.md)

- [ ] **T-TRAY-01**: Implement rich context menu for system tray (voice controls, settings, quit)
- [ ] **T-TRAY-02**: Add minimize to tray functionality and user preference setting
- [ ] **T-TRAY-03**: Implement badge count notifications on tray icon cross-platform
- [ ] **T-TRAY-04**: Add window state persistence (size, position, multi-monitor support)
- [ ] **T-TRAY-05**: Implement always-on-top window mode with tray menu toggle

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

### Thread: Game Overlay System (#08_game_overlay_system.md)

- [ ] **T-OVERLAY-01**: Add overlay dependencies (wgpu, winit, imgui) to Cargo.toml
- [ ] **T-OVERLAY-02**: Implement basic game process detection system
- [ ] **T-OVERLAY-03**: Build core overlay rendering infrastructure with ImGui
- [ ] **T-OVERLAY-04**: Implement overlay hotkey activation (default Shift+Tab)
- [ ] **T-OVERLAY-05**: Create minimalist in-game voice controls interface
- [ ] **T-OVERLAY-06**: Add DirectX 11/12 hooking for Windows game compatibility
- [ ] **T-OVERLAY-07**: Implement performance monitoring (FPS impact, memory usage)
- [ ] **T-OVERLAY-08**: Build in-game text chat slide-in interface
- [ ] **T-OVERLAY-09**: Add OpenGL/Vulkan support for Linux gaming
- [ ] **T-OVERLAY-10**: Test compatibility with top 20 Steam games

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

### Thread: Audio Device Management (New Priority)

- [ ] **T-AUDIO-01**: Implement hardware audio device detection and enumeration
- [ ] **T-AUDIO-02**: Add independent input/output audio device selection interface
- [ ] **T-AUDIO-03**: Implement audio device hotswapping without voice interruption
- [ ] **T-AUDIO-04**: Add audio ducking (lower other apps during voice calls)
- [ ] **T-AUDIO-05**: Build per-application volume control for Hearth Desktop

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

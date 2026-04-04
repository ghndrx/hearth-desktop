# Task Queue — Hearth Desktop

Last updated: 2026-04-04
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys (#06_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Add `tauri-plugin-global-shortcut = "2"` to `src-tauri/Cargo.toml`
- [ ] **T-HOTKEY-02**: Register plugin in main.rs and create hotkey manager module
- [ ] **T-HOTKEY-03**: Implement mute/unmute hotkey integration with WebRTC voice system
- [ ] **T-HOTKEY-04**: Implement deafen/undeafen hotkey functionality
- [ ] **T-HOTKEY-05**: Create hotkey settings schema and storage integration
- [ ] **T-HOTKEY-06**: Build hotkey configuration UI panel with conflict detection
- [ ] **T-HOTKEY-07**: Test cross-platform (Windows Ctrl+Shift+M, macOS Cmd+Shift+M, Linux)

### Thread: Advanced Window Management (#07_advanced_window_management.md)

- [ ] **T-WINDOW-01**: Add `tauri-plugin-window-state = "2"` to dependencies
- [ ] **T-WINDOW-02**: Implement window state persistence (position, size, maximized)
- [ ] **T-WINDOW-03**: Create enhanced tray context menu (Show/Hide, Settings, Quit)
- [ ] **T-WINDOW-04**: Implement "close to tray" vs "quit app" behavior toggle
- [ ] **T-WINDOW-05**: Add notification click handling to focus window and navigate
- [ ] **T-WINDOW-06**: Implement unread badge count for Windows taskbar/macOS dock
- [ ] **T-WINDOW-07**: Build window settings UI panel (close behavior, notifications)
- [ ] **T-WINDOW-08**: Test multi-monitor window restoration and edge cases

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

### Thread: Audio Processing Pipeline (#08_audio_processing_pipeline.md)

- [ ] **T-AUDIO-01**: Implement audio device enumeration via `navigator.mediaDevices.enumerateDevices()`
- [ ] **T-AUDIO-02**: Build audio device selection UI with preview and testing capabilities
- [ ] **T-AUDIO-03**: Create audio processing worklet infrastructure (AudioWorkletProcessor)
- [ ] **T-AUDIO-04**: Implement noise suppression pipeline (high-pass filter + spectral gating)
- [ ] **T-AUDIO-05**: Integrate browser native echo cancellation (`echoCancellation: true`)
- [ ] **T-AUDIO-06**: Implement automatic gain control for consistent volume levels
- [ ] **T-AUDIO-07**: Build voice activity detection using energy + frequency analysis
- [ ] **T-AUDIO-08**: Create comprehensive audio settings UI with real-time feedback
- [ ] **T-AUDIO-09**: Integrate audio processing with existing WebRTC pipeline
- [ ] **T-AUDIO-10**: Performance optimization and cross-platform testing

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

### Dependencies
- **P0 Global Hotkeys** depend on stable WebRTC voice system (PR #17) for mute/unmute integration
- **P0 Window Management** depends on notification system and settings UI framework
- **P1 Audio Processing** depends on stable WebRTC implementation and device management APIs
- All existing P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline — coordinate to avoid conflicts

### Implementation Priority
1. **Complete P0 tasks first** - Global hotkeys and window management are critical for feature parity
2. **Audio processing can be developed in parallel** with existing P1 video/screen sharing work
3. **Thread UI** (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team

### Cross-Platform Testing Requirements
- **Global hotkeys**: Test key combinations on Windows (Ctrl+Shift), macOS (Cmd+Shift), Linux (Ctrl+Shift)
- **Window management**: Multi-monitor scenarios, different desktop environments (GNOME, KDE, Windows 11)
- **Audio processing**: Test with popular headsets, different audio drivers (WASAPI, PulseAudio, Core Audio)

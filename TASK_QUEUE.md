# Task Queue — Hearth Desktop

Last updated: 2026-03-30
Pipeline: Hearth Desktop Discord Parity Analysis

## P0 — Critical (Ship Now)

### Thread: Advanced Audio System (#08_advanced_audio_system.md)

- [ ] **T-AUDIO-01**: Implement cross-platform audio device enumeration (WASAPI/Core Audio/PipeWire)
- [ ] **T-AUDIO-02**: Add hot-swapping audio devices without voice disconnection
- [ ] **T-AUDIO-03**: Implement WebRTC audio track replacement for seamless device switching
- [ ] **T-AUDIO-04**: Build basic audio ducking system for major applications (browsers, games, Spotify)

### Thread: Multi-Window Architecture (#07_multi_window_architecture.md)

- [ ] **T-WINDOW-01**: Implement Tauri multi-window manager with state synchronization
- [ ] **T-WINDOW-02**: Build voice channel popout windows with compact UI
- [ ] **T-WINDOW-03**: Add always-on-top and click-through window modes
- [ ] **T-WINDOW-04**: Implement cross-window WebRTC voice state synchronization

---

## P1 — High (Next Sprint)

### Thread: Game Overlay System (#06_game_overlay_system.md)

- [ ] **T-OVERLAY-01**: Research and implement DirectX/OpenGL hook injection for Windows
- [ ] **T-OVERLAY-02**: Build Dear ImGui overlay renderer with WebRTC voice integration
- [ ] **T-OVERLAY-03**: Implement game process detection and automatic overlay activation
- [ ] **T-OVERLAY-04**: Add voice activity visualization and participant list overlay
- [ ] **T-OVERLAY-05**: Build overlay quick controls (mute/deafen buttons with hotkeys)
- [ ] **T-OVERLAY-06**: Implement FPS impact optimization (<2% target)
- [ ] **T-OVERLAY-07**: Add Linux overlay support (XDG Desktop Portal, X11/Wayland)
- [ ] **T-OVERLAY-08**: Test anti-cheat compatibility (Valorant, CS2, Apex Legends)

### Thread: Advanced Audio System (Continued)

- [ ] **T-AUDIO-05**: Add hardware acceleration support (NVIDIA RTX Voice, AMD, Intel GNA)
- [ ] **T-AUDIO-06**: Implement per-application volume control with smooth fading
- [ ] **T-AUDIO-07**: Build multi-stream audio routing (voice/media/notifications to different devices)
- [ ] **T-AUDIO-08**: Add advanced audio processing (noise suppression, echo cancellation, AGC)
- [ ] **T-AUDIO-09**: Build comprehensive audio device management UI with testing

### Thread: Multi-Window Architecture (Continued)

- [ ] **T-WINDOW-05**: Implement text channel popout windows with full functionality
- [ ] **T-WINDOW-06**: Build Picture-in-Picture voice overlay with auto-hide
- [ ] **T-WINDOW-07**: Add window positioning memory and edge-snapping for PiP mode
- [ ] **T-WINDOW-08**: Implement platform-specific window management (taskbar grouping, Spaces, etc.)

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

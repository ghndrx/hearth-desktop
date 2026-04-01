# Task Queue — Hearth Desktop

Last updated: 2026-04-01
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Native File System Integration (#12_native_file_system_integration.md)

- [ ] **T-FILES-01**: Implement platform-specific file dialog APIs (Windows, macOS, Linux)
- [ ] **T-FILES-02**: Create unified file system abstraction layer
- [ ] **T-FILES-03**: Add drag-drop support from OS file managers
- [ ] **T-FILES-04**: Build file upload queue with progress tracking
- [ ] **T-FILES-05**: Implement thumbnail generation for images/videos
- [ ] **T-FILES-06**: Add metadata extraction for major file types
- [ ] **T-FILES-07**: Build preview panel UI with file details
- [ ] **T-FILES-08**: Create thumbnail caching system
- [ ] **T-FILES-09**: Test cross-platform file operations and compatibility

### Thread: Advanced Accessibility Support (#13_advanced_accessibility_support.md)

- [ ] **T-A11Y-01**: Implement semantic HTML structure with ARIA landmarks
- [ ] **T-A11Y-02**: Add comprehensive ARIA labels and descriptions
- [ ] **T-A11Y-03**: Build accessibility tree for complex UI components
- [ ] **T-A11Y-04**: Integrate platform accessibility APIs (UIA, NSAccessibility, AT-SPI)
- [ ] **T-A11Y-05**: Implement high contrast themes meeting WCAG AA standards
- [ ] **T-A11Y-06**: Add font scaling and magnification support (400% zoom)
- [ ] **T-A11Y-07**: Build enhanced focus indicators
- [ ] **T-A11Y-08**: Ensure complete keyboard navigation for all features
- [ ] **T-A11Y-09**: WCAG 2.1 AA compliance validation and testing

---

## P1 — High (Next Sprint)

### Thread: Advanced Audio/Video Processing (#14_advanced_audio_video_processing.md)

- [ ] **T-AUDIO-01**: Implement real-time audio DSP pipeline
- [ ] **T-AUDIO-02**: Add noise suppression using WebRTC audio processing
- [ ] **T-AUDIO-03**: Build audio device enumeration and routing system
- [ ] **T-AUDIO-04**: Create basic audio effects (EQ, compressor, gate)
- [ ] **T-AUDIO-05**: Implement background blur using depth estimation
- [ ] **T-AUDIO-06**: Add virtual background replacement with ML
- [ ] **T-AUDIO-07**: Build real-time video filters and color correction
- [ ] **T-AUDIO-08**: Optimize GPU acceleration for video effects
- [ ] **T-AUDIO-09**: Test with content creator community for quality validation

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

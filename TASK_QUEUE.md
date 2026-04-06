# Task Queue — Hearth Desktop

Last updated: 2026-04-06
Pipeline: Hearth Desktop PRD Competitive Analysis + Discord Feature Gap Analysis

## P0 — Critical (Ship Now)

### Thread: Rich Notification System (#01_rich_notification_system.md)

- [ ] **T-NOTIF-01**: Design notification preference data structures and SQLite schema
- [ ] **T-NOTIF-02**: Implement granular notification preference storage (per-server, per-channel, per-user)
- [ ] **T-NOTIF-03**: Build notification batching and grouping logic to prevent spam
- [ ] **T-NOTIF-04**: Implement quiet hours with timezone support using `chrono` crate
- [ ] **T-NOTIF-05**: Add cross-platform unread badge counts (Windows Toast, macOS NSUserNotificationCenter)
- [ ] **T-NOTIF-06**: Build notification settings UI panel in Svelte with real-time preview
- [ ] **T-NOTIF-07**: Implement custom notification sounds with `rodio` for audio playback
- [ ] **T-NOTIF-08**: Add notification sound selection and preview in settings
- [ ] **T-NOTIF-09**: Test notification behavior across Windows 10/11, macOS, and Linux

### Thread: Keyboard Shortcuts & Accessibility (#02_keyboard_shortcuts_accessibility.md)

- [ ] **T-KEYS-01**: Implement core navigation shortcuts (Ctrl+K quick switcher, Alt+Up/Down channel nav)
- [ ] **T-KEYS-02**: Add global hotkey system using `tauri-plugin-global-shortcut` for push-to-talk
- [ ] **T-KEYS-03**: Build customizable keybind system with conflict detection and storage
- [ ] **T-KEYS-04**: Implement complete keyboard navigation with proper focus management
- [ ] **T-KEYS-05**: Add ARIA live regions and screen reader announcements for dynamic content
- [ ] **T-KEYS-06**: Implement skip links, focus trapping, and logical tab order
- [ ] **T-KEYS-07**: Build high contrast mode and reduced motion accessibility options
- [ ] **T-KEYS-08**: Add keyboard shortcut help overlay (Ctrl+/) with search functionality
- [ ] **T-KEYS-09**: Test with screen readers (NVDA, JAWS, VoiceOver) for WCAG 2.1 AA compliance

---

## P1 — High (Next Sprint)

### Thread: Advanced Audio Processing (#03_advanced_audio_processing.md)

- [ ] **T-AUDIO-01**: Implement noise suppression engine using RNNoise or equivalent ML model
- [ ] **T-AUDIO-02**: Add echo cancellation system for speakers and headphones
- [ ] **T-AUDIO-03**: Implement automatic gain control (AGC) for voice normalization
- [ ] **T-AUDIO-04**: Build voice activity detection (VAD) with customizable sensitivity
- [ ] **T-AUDIO-05**: Add audio device enumeration and management using `cpal` crate
- [ ] **T-AUDIO-06**: Implement audio quality presets (Battery Saver, Standard, High, Studio)
- [ ] **T-AUDIO-07**: Build audio settings UI with real-time preview and testing
- [ ] **T-AUDIO-08**: Integrate audio processing pipeline with existing WebRTC infrastructure
- [ ] **T-AUDIO-09**: Performance testing and optimization (target <5% CPU usage, <20ms latency)

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

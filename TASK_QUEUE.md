# Task Queue — Hearth Desktop

Last updated: 2026-03-26
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Advanced Voice Controls (#10_advanced_voice_controls_ptt.md)

- [ ] **T-VOICE-01**: Extend tauri-plugin-global-shortcut for configurable PTT hotkeys
- [ ] **T-VOICE-02**: Implement voice transmission gating in WebRTC pipeline
- [ ] **T-VOICE-03**: Add PTT visual indicators and status to UI
- [ ] **T-VOICE-04**: Implement hold-to-talk and toggle-to-talk modes
- [ ] **T-VOICE-05**: Add real-time audio level monitoring and VAD sensitivity controls
- [ ] **T-VOICE-06**: Build voice settings panel with real-time feedback
- [ ] **T-VOICE-07**: Integrate WebAssembly noise suppression (RNNoise)
- [ ] **T-VOICE-08**: Add audio device enumeration and switching UI

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

### Thread: Rich Presence & Activity Status (#11_rich_presence_activity_status.md)

- [ ] **T-PRESENCE-01**: Implement process monitoring system for game/app detection
- [ ] **T-PRESENCE-02**: Build game database and metadata management
- [ ] **T-PRESENCE-03**: Integrate Steam Web API for game metadata
- [ ] **T-PRESENCE-04**: Add Epic Games Store, Battle.net launcher detection
- [ ] **T-PRESENCE-05**: Implement rich presence data model and storage
- [ ] **T-PRESENCE-06**: Add time tracking and session management
- [ ] **T-PRESENCE-07**: Build custom status input and emoji picker
- [ ] **T-PRESENCE-08**: Implement Rich Presence API with OAuth authorization
- [ ] **T-PRESENCE-09**: Add "Join Game" integration for supported games

### Thread: Advanced Notification Management (#12_advanced_notification_management.md)

- [ ] **T-NOTIF-01**: Build per-server and per-channel notification preference controls
- [ ] **T-NOTIF-02**: Implement custom notification sounds system with audio management
- [ ] **T-NOTIF-03**: Add Windows Focus Assist and macOS Do Not Disturb integration
- [ ] **T-NOTIF-04**: Implement intelligent notification batching algorithms
- [ ] **T-NOTIF-05**: Build rich notification templates with inline actions
- [ ] **T-NOTIF-06**: Add notification history and persistence
- [ ] **T-NOTIF-07**: Implement quiet hours scheduling and priority breakthrough
- [ ] **T-NOTIF-08**: Add notification settings UI with real-time preview

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

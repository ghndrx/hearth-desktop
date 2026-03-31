# Task Queue — Hearth Desktop

Last updated: 2026-03-31
Pipeline: Hearth Desktop Competitive Gap Analysis - Discord Parity

## P0 — Critical (Ship Now)

### Thread: Global Push-to-Talk (#06_global_push_to_talk_system.md)

- [ ] **T-PTT-01**: Add `tauri-plugin-global-shortcut` dependency to `src-tauri/Cargo.toml`
- [ ] **T-PTT-02**: Implement `PTTManager` struct with global shortcut registration
- [ ] **T-PTT-03**: Create PTT settings UI component with hotkey configuration
- [ ] **T-PTT-04**: Implement `register_ptt_shortcut(hotkey)` Tauri command
- [ ] **T-PTT-05**: Connect PTT activation to existing WebRTC audio pipeline
- [ ] **T-PTT-06**: Add PTT status visual indicator to system tray
- [ ] **T-PTT-07**: Implement platform-specific permissions (macOS accessibility, Windows hooks)
- [ ] **T-PTT-08**: Test cross-platform PTT latency (<100ms requirement)

### Thread: Advanced System Tray (#07_advanced_system_tray.md)

- [ ] **T-TRAY-01**: Expand existing `src-tauri/src/tray.rs` with context menu framework
- [ ] **T-TRAY-02**: Implement status indicators (Online/Away/DND/Invisible) in tray icon
- [ ] **T-TRAY-03**: Build dynamic context menu with status controls and voice actions
- [ ] **T-TRAY-04**: Implement unread badge rendering system with count overlay
- [ ] **T-TRAY-05**: Add recent voice channels submenu with quick join
- [ ] **T-TRAY-06**: Connect tray actions to app state (mute/deafen, status change)
- [ ] **T-TRAY-07**: Test platform-specific tray behavior (Windows/macOS/Linux)

### Thread: Rich Interactive Notifications (#08_rich_interactive_notifications.md)

- [ ] **T-NOTIF-01**: Upgrade to advanced Tauri notification APIs with rich content support
- [ ] **T-NOTIF-02**: Implement avatar caching and notification content rendering
- [ ] **T-NOTIF-03**: Build inline reply functionality with notification action handlers
- [ ] **T-NOTIF-04**: Create notification configuration UI (sounds, grouping, DND)
- [ ] **T-NOTIF-05**: Implement smart notification grouping for same conversations
- [ ] **T-NOTIF-06**: Add custom notification sounds per server/channel
- [ ] **T-NOTIF-07**: Build Do Not Disturb scheduling with priority overrides
- [ ] **T-NOTIF-08**: Test notification interactivity across platforms

---

## P1 — High (Next Sprint)

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

### Additional Features

- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Custom status messages (online/idle/dnd/custom) — *Partially covered by P0 tray work*
- [ ] **T-P2-03**: Keyboard shortcut customization UI — *PTT shortcuts covered in P0*
- [ ] **T-P2-04**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-05**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-06**: Message search with filters (from:, has:embed, during:, etc.)
- [ ] **T-P2-07**: Game detection and basic overlay system
- [ ] **T-P2-08**: Protocol handler for hearth:// links

---

## Notes

### P0 Priority Rationale
- **Global Push-to-Talk**, **Advanced System Tray**, and **Rich Interactive Notifications** are critical competitive gaps vs Discord
- These features are expected desktop application basics that users will immediately notice if missing
- P0 features provide immediate competitive advantage and user satisfaction improvements

### Dependencies & Coordination
- All P0 tray and notification tasks depend on basic messaging infrastructure being stable
- PTT system extends existing WebRTC voice pipeline (PR #17) — coordinate with T-PTT-05
- Screen share and video call (P2) both extend WebRTC pipeline — defer until P0 desktop integration complete
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team

### Cross-Platform Testing Priority
- P0 features must work consistently across Windows, macOS, and Linux before P1/P2 work begins
- Focus testing on: Windows 10/11, macOS 12+, Ubuntu/Fedora/Arch Linux

# Task Queue — Hearth Desktop

Last updated: 2026-03-30
Pipeline: Hearth Desktop PRD Competitive Analysis + Desktop Feature Parity

## P0 — Critical (Ship Now)

### Thread: Global Push-to-Talk System (#06_global_push_to_talk_system.md)

- [ ] **T-PTT-01**: Add `tauri-plugin-global-shortcut = "2.0"` to `src-tauri/Cargo.toml`
- [ ] **T-PTT-02**: Implement basic hotkey registration/unregistration in Rust backend
- [ ] **T-PTT-03**: Integrate PTT with existing voice system in `src/lib/stores/voice.ts`
- [ ] **T-PTT-04**: Create PTT settings panel in existing settings UI
- [ ] **T-PTT-05**: Test PTT across Windows/macOS/Linux with <50ms latency requirement

### Thread: Enhanced System Tray (#07_enhanced_system_tray_window_management.md)

- [ ] **T-TRAY-01**: Extend existing `src-tauri/src/tray.rs` with rich context menu
- [ ] **T-TRAY-02**: Implement badge count system with platform-specific handlers
- [ ] **T-TRAY-03**: Add minimize-to-tray behavior and window restoration
- [ ] **T-TRAY-04**: Add voice controls (mute/unmute) to tray context menu
- [ ] **T-TRAY-05**: Test badge counts on Windows taskbar, macOS dock, Linux system tray

---

## P1 — High (Next Sprint)

### Thread: Gaming Integration & Overlay (#08_gaming_integration_overlay_system.md)

- [ ] **T-GAME-01**: Implement cross-platform process detection and game database
- [ ] **T-GAME-02**: Build Steam platform integration and game identification
- [ ] **T-GAME-03**: Add Epic Games, Origin, GOG platform support
- [ ] **T-GAME-04**: Implement basic rich presence broadcasting
- [ ] **T-GAME-05**: Design overlay architecture and window management system
- [ ] **T-GAME-06**: Implement Windows DirectX overlay injection (high complexity)
- [ ] **T-GAME-07**: Add Linux X11/Wayland overlay support
- [ ] **T-GAME-08**: Create overlay UI components with voice controls

### Thread: Multi-Window Support (#07_enhanced_system_tray_window_management.md)

- [ ] **T-WINDOW-01**: Implement multi-window manager architecture
- [ ] **T-WINDOW-02**: Create voice channel pop-out windows
- [ ] **T-WINDOW-03**: Add always-on-top and opacity controls
- [ ] **T-WINDOW-04**: Window state persistence and restoration
- [ ] **T-WINDOW-05**: Create text channel pop-out windows (lower priority)

### Thread: Advanced PTT Features (#06_global_push_to_talk_system.md)

- [ ] **T-PTT-06**: System tray PTT controls integration
- [ ] **T-PTT-07**: Audio/visual feedback implementation
- [ ] **T-PTT-08**: Multi-hotkey support for power users
- [ ] **T-PTT-09**: Enterprise policy compliance features

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

### P0 Dependencies & Coordination
- **T-PTT-01 through T-PTT-05**: Essential for Discord feature parity, blocks gaming user migration
- **T-TRAY-01 through T-TRAY-05**: Core desktop UX expectations, blocks professional user adoption
- PTT integration must coordinate with existing voice system from PR #17
- Tray badge counts need platform-specific testing (Windows/macOS/Linux variations)

### P1 Dependencies & Coordination
- **Gaming overlay tasks (T-GAME-05, T-GAME-06, T-GAME-07)**: High complexity, requires extensive compatibility testing
- **Multi-window support**: Coordinate with existing voice/WebRTC infrastructure from PR #17
- All P1 tasks depend on P0 items being stable (text messaging system + new P0 desktop features)
- Screen share and video call both extend the WebRTC pipeline — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team

### Implementation Priority
1. **Week 1-2**: Focus on P0 PTT and Tray enhancements (user migration blockers)
2. **Week 3-4**: Gaming integration foundation (competitive differentiation)
3. **Week 5-6**: Multi-window support and advanced features

# Task Queue — Hearth Desktop

Last updated: 2026-03-31
Pipeline: Hearth Desktop Competitive Analysis & Native Desktop Integration

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys & Voice Controls (#06_global_hotkeys_voice_controls.md)

- [ ] **T-HOTKEY-01**: Add `tauri-plugin-global-shortcut` dependency to `src-tauri/Cargo.toml`
- [ ] **T-HOTKEY-02**: Implement `HotkeyManager` service in Rust with platform-specific registration
- [ ] **T-HOTKEY-03**: Create platform-specific hotkey registration (Windows/macOS/Linux)
- [ ] **T-HOTKEY-04**: Build Tauri commands for hotkey management (register/unregister/test)
- [ ] **T-HOTKEY-05**: Implement global push-to-talk functionality with <50ms latency
- [ ] **T-HOTKEY-06**: Integrate with existing WebRTC voice system for PTT controls
- [ ] **T-HOTKEY-07**: Implement global mute/unmute hotkey functionality

### Thread: Advanced Native Desktop Integration (#08_advanced_native_desktop_integration.md)

- [ ] **T-NATIVE-01**: Build enhanced tray context menu with voice controls and recent channels
- [ ] **T-NATIVE-02**: Implement tray badge count functionality (Windows taskbar + macOS dock)
- [ ] **T-NATIVE-03**: Create rich notification system with inline reply and actions
- [ ] **T-NATIVE-05**: Implement Do Not Disturb functionality with custom schedules
- [ ] **T-NATIVE-06**: Implement system idle time detection for auto-away status

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

### Thread: Game Overlay System (#07_game_overlay_system.md)

- [ ] **T-OVERLAY-01**: Research and implement Windows game detection system
- [ ] **T-OVERLAY-02**: Create basic overlay window management with transparent windows
- [ ] **T-OVERLAY-03**: Implement DirectX overlay renderer for Windows gaming
- [ ] **T-OVERLAY-04**: Build overlay positioning system for multi-monitor setups
- [ ] **T-OVERLAY-06**: Design and implement voice widget for in-game voice controls
- [ ] **T-OVERLAY-07**: Create chat widget with in-game message display
- [ ] **T-OVERLAY-09**: Implement overlay hotkey controls for show/hide functionality

### Thread: Advanced Native Desktop Integration (Continued) (#08_advanced_native_desktop_integration.md)

- [ ] **T-NATIVE-07**: Create automatic away/idle status updates with configurable timeouts
- [ ] **T-NATIVE-08**: Add game detection integration for "Playing [Game]" status
- [ ] **T-NATIVE-11**: Create multi-window management system for power users
- [ ] **T-NATIVE-12**: Implement voice channel pop-out windows
- [ ] **T-NATIVE-13**: Add text channel pop-out functionality
- [ ] **T-NATIVE-16**: Windows taskbar and jump list integration

---

## P2 — Medium (Future)

- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Custom status messages (online/idle/dnd/custom)
- [ ] **T-P2-03**: Per-channel notification sounds
- [ ] **T-P2-04**: Keyboard shortcut customization UI
- [ ] **T-P2-05**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-06**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-07**: Message search with filters (from:, has:embed, during:, etc.)
- [ ] **T-P2-08**: macOS Metal overlay renderer for gaming (cross-platform game overlay)
- [ ] **T-P2-09**: Advanced hotkey profiles with context-aware switching
- [ ] **T-P2-10**: Linux desktop environment integration (GNOME/KDE/Unity)
- [ ] **T-P2-11**: Streaming software integration (OBS/XSplit overlay sharing)
- [ ] **T-P2-12**: Custom notification bundling and smart grouping

---

## Notes

- **P0 Global Hotkeys** are critical for voice user retention — prioritize T-HOTKEY-01 through T-HOTKEY-07
- **P0 Native Integration** provides immediate desktop app legitimacy — focus on tray and notification improvements
- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- **Game Overlay** requires extensive compatibility testing — start with top 10 PC games
- **Multi-window support** needs careful state synchronization design
- Global hotkeys must coordinate with overlay system to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team

### Implementation Dependencies
- **T-HOTKEY-01** → **T-HOTKEY-07**: Sequential implementation required
- **T-OVERLAY-01** → **T-OVERLAY-03**: Core overlay infrastructure before widgets
- **T-NATIVE-01** → **T-NATIVE-02**: Tray enhancements before badge system

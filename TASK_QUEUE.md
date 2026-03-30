# Task Queue — Hearth Desktop

Last updated: 2026-03-30
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Desktop Integration (Critical for Discord Parity)

#### Global Push-to-Talk System (#06_global_push_to_talk_system.md)

- [ ] **T-PTT-01**: Add `tauri-plugin-global-shortcut` dependency to `src-tauri/Cargo.toml`
- [ ] **T-PTT-02**: Implement `register_push_to_talk(shortcut)` Tauri command
- [ ] **T-PTT-03**: Implement `unregister_push_to_talk(shortcut)` Tauri command
- [ ] **T-PTT-04**: Create hotkey settings UI with conflict detection
- [ ] **T-PTT-05**: Integrate PTT activation with existing WebRTC voice pipeline
- [ ] **T-PTT-06**: Add system permissions handling for global shortcuts
- [ ] **T-PTT-07**: Test PTT functionality across Windows/macOS/Linux
- [ ] **T-PTT-08**: Add PTT visual feedback in system tray

#### Enhanced System Tray (#07_enhanced_system_tray.md)

- [ ] **T-TRAY-01**: Enhance `src-tauri/src/tray.rs` with context menu system
- [ ] **T-TRAY-02**: Implement voice controls menu (mute/unmute/deafen)
- [ ] **T-TRAY-03**: Implement status change menu (online/away/dnd/invisible)
- [ ] **T-TRAY-04**: Add `update_tray_badge(count)` command for unread indicators
- [ ] **T-TRAY-05**: Implement platform-specific badge count display
- [ ] **T-TRAY-06**: Add tray icon state management (voice active, notifications)
- [ ] **T-TRAY-07**: Connect tray controls to existing voice/status systems

#### Minimize to Tray System (#08_minimize_to_tray_system.md)

- [ ] **T-MINTRAY-01**: Implement `minimize_to_tray()` Tauri command
- [ ] **T-MINTRAY-02**: Implement `restore_from_tray()` Tauri command
- [ ] **T-MINTRAY-03**: Add window close event handler with user preference check
- [ ] **T-MINTRAY-04**: Create tray behavior settings UI panel
- [ ] **T-MINTRAY-05**: Implement single/double-click tray restoration options
- [ ] **T-MINTRAY-06**: Add first-run onboarding for minimize-to-tray feature
- [ ] **T-MINTRAY-07**: Test window focus restoration across platforms

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

### Thread: Game Overlay & Activity Detection (#07_game_overlay_and_activity_detection.md)

- [ ] **T-GAME-01**: Research anti-cheat compatibility and create game whitelist for overlay support
- [ ] **T-GAME-02**: Implement game process detection system using `sysinfo` crate
- [ ] **T-GAME-03**: Build game database with popular titles and process names
- [ ] **T-GAME-04**: Implement `create_game_overlay()` Tauri command with transparent window
- [ ] **T-GAME-05**: Build overlay UI with voice controls, participant list, and quick chat
- [ ] **T-GAME-06**: Add overlay positioning system over fullscreen games
- [ ] **T-GAME-07**: Implement overlay hotkey toggle (default: Shift+Tab)
- [ ] **T-GAME-08**: Add game activity detection and rich presence broadcasting
- [ ] **T-GAME-09**: Create overlay performance monitoring to ensure <3% FPS impact
- [ ] **T-GAME-10**: Test overlay functionality with 15+ popular games across platforms

### Thread: Multi-Window Support & Desktop Integration (#08_multi_window_and_desktop_integration.md)

- [ ] **T-WINDOW-01**: Implement `create_voice_window()` for pop-out voice channels
- [ ] **T-WINDOW-02**: Implement `create_text_window()` for pop-out text channels
- [ ] **T-WINDOW-03**: Build Picture-in-Picture (PiP) voice overlay system
- [ ] **T-WINDOW-04**: Implement cross-window state synchronization for voice/mute status
- [ ] **T-WINDOW-05**: Add window state persistence (position, size, always-on-top)
- [ ] **T-WINDOW-06**: Build window layout save/restore system for different workflows
- [ ] **T-WINDOW-07**: Implement cross-window drag & drop for files and content
- [ ] **T-WINDOW-08**: Add multi-monitor support and positioning
- [ ] **T-WINDOW-09**: Create window management UI in main app settings
- [ ] **T-WINDOW-10**: Test multi-window performance and memory usage optimization

### Thread: Screen Share Zoom & Pan (#09_screenshare_zoom_pan.md)

- [ ] **T-ZOOM-01**: Implement `ZoomPanState` TypeScript interface with scale/pan tracking
- [ ] **T-ZOOM-02**: Create `useZoomPan` Svelte store for state management
- [ ] **T-ZOOM-03**: Build `ZoomPanControls` component with zoom slider and reset button
- [ ] **T-ZOOM-04**: Wire mouse wheel events to zoom handler (0.5x to 4.0x scale)
- [ ] **T-ZOOM-05**: Implement click+drag pan with boundary clamping
- [ ] **T-ZOOM-06**: Extend WebRTC signaling protocol to broadcast zoom/pan state
- [ ] **T-ZOOM-07**: Apply remote zoom/pan transforms on subscriber side
- [ ] **T-ZOOM-08**: Add keyboard shortcuts (Plus/Minus for zoom, Arrow keys for pan)
- [ ] **T-ZOOM-09**: Build minimap showing current viewport position
- [ ] **T-ZOOM-10**: Optimize for <5ms additional latency during zoom/pan operations

### Thread: Desktop Navigation UX (#10_desktop_navigation_ux.md)

- [ ] **T-NAV-01**: Implement `NavigationHistory` TypeScript class with back/forward stack
- [ ] **T-NAV-02**: Create Svelte `navigation` store for history management
- [ ] **T-NAV-03**: Add Back/Forward buttons to app header with visual indicators
- [ ] **T-NAV-04**: Wire Alt+Left/Right keyboard shortcuts for navigation
- [ ] **T-NAV-05**: Support mouse buttons 4/5 via `@mousedown` events
- [ ] **T-NAV-06**: Add history dropdown showing back stack on button hover
- [ ] **T-NAV-07**: Implement `getRoleMembers` API method for role member lookup
- [ ] **T-NAV-08**: Create `RoleMemberList` modal component with search functionality
- [ ] **T-NAV-09**: Parse @role mentions in message content for clickability
- [ ] **T-NAV-10**: Add status grouping in role member list (Online/Idle/DND/Offline)

### Thread: Widget-Based Overlay System (#11_widget_based_overlay.md)

- [ ] **T-WIDGET-01**: Setup overlay window infrastructure (HWND_TOPMOST/NSWindow/layer-shell)
- [ ] **T-WIDGET-02**: Build widget rendering framework with Svelte components
- [ ] **T-WIDGET-03**: Implement widget drag-and-drop positioning with persistence
- [ ] **T-WIDGET-04**: Create Action Bar widget (mute/deafen/video/share/leave controls)
- [ ] **T-WIDGET-05**: Build Participant List widget with speaking indicators
- [ ] **T-WIDGET-06**: Implement Voice Controls widget (volume sliders, PTT toggle)
- [ ] **T-WIDGET-07**: Create Chat widget with message display and scrolling
- [ ] **T-WIDGET-08**: Build Stream widget for picture-in-picture friend streams
- [ ] **T-WIDGET-09**: Implement preset system (FPS/RTS/MMO/Custom layouts)
- [ ] **T-WIDGET-10**: Add per-game auto-load presets with game detection integration
- [ ] **T-WIDGET-11**: Optimize for <1.5% FPS impact and anti-cheat compatibility
- [ ] **T-WIDGET-12**: Test widget functionality with top 50 games across platforms

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

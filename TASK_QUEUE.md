# Task Queue — Hearth Desktop

Last updated: 2026-04-04
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Shortcuts System (#06_global_shortcuts_system.md)

- [ ] **T-SHORTCUTS-01**: Create Tauri custom global-shortcut plugin extending tauri-plugin-global-shortcut
- [ ] **T-SHORTCUTS-02**: Implement Windows RegisterHotKey backend with low-level hooks for gaming compatibility
- [ ] **T-SHORTCUTS-03**: Build core VoiceShortcuts struct (PTT, mute toggle, deafen toggle, voice activation)
- [ ] **T-SHORTCUTS-04**: Integrate shortcuts with existing voice store infrastructure from PR #17
- [ ] **T-SHORTCUTS-05**: Create basic Settings → Shortcuts UI with shortcut recorder components
- [ ] **T-SHORTCUTS-06**: Implement shortcut conflict detection and warning system
- [ ] **T-SHORTCUTS-07**: Add macOS accessibility permissions request flow
- [ ] **T-SHORTCUTS-08**: Test global PTT functionality in fullscreen games across platforms

---

## P1 — High (Next Sprint)

### Thread: Multi-Window Support (#07_multi_window_support.md)

- [ ] **T-WINDOWS-01**: Implement Tauri multi-window infrastructure with WindowManager and state sync
- [ ] **T-WINDOWS-02**: Create voice channel detachment UI with "Detach" button and smooth animations
- [ ] **T-WINDOWS-03**: Build VoiceWindow.svelte component for detached voice channel interface
- [ ] **T-WINDOWS-04**: Implement CrossWindowStateManager for voice state synchronization across windows
- [ ] **T-WINDOWS-05**: Add window persistence system to remember positions/sizes across restarts
- [ ] **T-WINDOWS-06**: Create video call popout functionality (depends on PRD #04 video calls)
- [ ] **T-WINDOWS-07**: Test multi-monitor support and DPI scaling edge cases
- [ ] **T-WINDOWS-08**: Implement smart default positioning and reattachment workflow

### Thread: Theme & Customization System (#08_theme_customization_system.md)

- [ ] **T-THEME-01**: Implement ThemeEngine with CSS custom properties and safe CSS injection
- [ ] **T-THEME-02**: Create default themes (Hearth Light, Hearth Dark, Midnight Blue)
- [ ] **T-THEME-03**: Build Settings → Appearance page with theme picker and live preview
- [ ] **T-THEME-04**: Implement layout customization controls (sidebar width, message density, font size)
- [ ] **T-THEME-05**: Create ColorCustomizer component with visual color picker interface
- [ ] **T-THEME-06**: Add CSS sanitization system with security validation and property whitelist
- [ ] **T-THEME-07**: Implement theme persistence and cloud sync via Tauri app data
- [ ] **T-THEME-08**: Build accessibility validator with WCAG 2.1 AA contrast checking

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

# Task Queue — Hearth Desktop

Last updated: 2026-04-03
Pipeline: Hearth Desktop Competitive Analysis — Discord March 2026 Feature Scan

## P0 — Critical (Ship Now)

### Thread: Rich Presence & Activity System (#06_rich_presence_activity_system.md)

- [ ] **T-PRESENCE-01**: Add `sysinfo` crate to Cargo.toml for cross-platform process monitoring
- [ ] **T-PRESENCE-02**: Implement ActivityDetector with process/window enumeration
- [ ] **T-PRESENCE-03**: Build game pattern database (Steam, Epic, popular games)
- [ ] **T-PRESENCE-04**: Create activity data models and Tauri commands
- [ ] **T-PRESENCE-05**: Design Rich Presence protocol for Hearth ecosystem
- [ ] **T-PRESENCE-06**: Implement presence broadcasting to Hearth servers
- [ ] **T-PRESENCE-07**: Build Rich Presence JavaScript SDK
- [ ] **T-PRESENCE-08**: Create StatusBar component with activity display
- [ ] **T-PRESENCE-09**: Implement custom status system with presets

### Thread: Advanced Window & Overlay System (#07_advanced_window_overlay_system.md)

- [ ] **T-OVERLAY-01**: Implement cross-platform window manipulation APIs (always-on-top, opacity)
- [ ] **T-OVERLAY-02**: Build window snapping and positioning system
- [ ] **T-OVERLAY-03**: Create compact mode UI layouts
- [ ] **T-OVERLAY-04**: Design platform-specific overlay architecture (Windows/macOS/Linux)
- [ ] **T-OVERLAY-05**: Implement game detection and window targeting
- [ ] **T-OVERLAY-06**: Build overlay rendering system with transparency
- [ ] **T-OVERLAY-07**: Add overlay input handling and interaction system
- [ ] **T-OVERLAY-08**: Create VoiceOverlay component for in-game controls
- [ ] **T-OVERLAY-09**: Test overlay compatibility with popular games

---

## P1 — High (Next Sprint)

### Thread: Theme & Appearance Customization (#08_theme_appearance_customization.md)

- [ ] **T-THEME-01**: Design CSS custom properties architecture for dynamic theming
- [ ] **T-THEME-02**: Implement theme data models and storage system
- [ ] **T-THEME-03**: Build basic dark/light mode switching functionality
- [ ] **T-THEME-04**: Create theme application and persistence logic
- [ ] **T-THEME-05**: Implement accent color picker and system
- [ ] **T-THEME-06**: Build font scaling and typography controls
- [ ] **T-THEME-07**: Add message density and layout options
- [ ] **T-THEME-08**: Create ThemePicker component with preview
- [ ] **T-THEME-09**: Add system theme synchronization (OS dark/light mode)

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
- [ ] **T-SCREEN-10**: ⭐ NEW (Discord Mar 2026) — Implement scroll-wheel zoom/pan on screenshare stream (viewer side)

### Thread: Invite to Voice Recommendations (#09_invite_to_voice_recommendations.md) ⭐ NEW

- [ ] **T-INVITE-01**: Add `voice_interaction_count` to user-pair data model (Hearth API)
- [ ] **T-INVITE-02**: Implement `get_recent_interactions()` Tauri command
- [ ] **T-INVITE-03**: Implement `get_close_friends()` Tauri command
- [ ] **T-INVITE-04**: Implement `get_server_members_nearby()` Tauri command
- [ ] **T-INVITE-05**: Build InvitePanel Svelte component (two-section: Server Members + Friends)
- [ ] **T-INVITE-06**: Add "Invite to Voice" button to voice channel toolbar
- [ ] **T-INVITE-07**: Wire invite action into WebRTC signaling protocol
- [ ] **T-INVITE-08**: Privacy filter: respect `hide-online-status` and `friend-requests:off`
- [ ] **T-INVITE-09**: Keyboard navigation + screen reader labels (a11y)

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
- [ ] **T-P2-08**: ⭐ NEW (Discord Mar 2026) — Dynamic @time timestamp command in message composer
- [ ] **T-P2-09**: ⭐ NEW (Discord Mar 2026) — Role mention click → popover showing up to 100 users with that role
- [ ] **T-P2-10**: ⭐ NEW (Discord Mar 2026) — Desktop Settings redesign: Notifications, Voice/Video, Clips, Streamer Mode pages
- [ ] **T-P2-11**: ⭐ NEW (Discord Mar 2026) — Go Live stream preview load time optimization (Tauri streaming approach)
- [ ] **T-P2-12**: ⭐ NEW (Discord Mar 2026) — Back/Forward browser-style navigation buttons in desktop chrome

---

## Notes

### Competitive Priority
- **P0 tasks target Discord feature parity gaps** — Rich Presence and Overlay are critical for gaming community adoption
- Rich Presence system enables game detection and social features core to Discord's value proposition
- Overlay system required for competitive gaming experience (voice controls without tabbing out)

### Dependencies
- Rich Presence tasks (T-PRESENCE-*) can run in parallel with existing development
- Overlay system (T-OVERLAY-*) benefits from but doesn't block on WebRTC voice (PR #17)
- Theme system (T-THEME-*) requires CSS architecture refactor — plan coordination
- Screen share and video call both extend WebRTC pipeline — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team

### Platform Considerations
- Overlay system requires platform-specific implementations (Windows DLL injection, macOS accessibility, Linux X11/Wayland)
- Rich Presence needs cross-platform process monitoring (Windows WinAPI, macOS NSRunningApplication, Linux /proc)
- Theme system should leverage native OS appearance APIs for system sync

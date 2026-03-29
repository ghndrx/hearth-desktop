# Task Queue — Hearth Desktop

Last updated: 2026-03-26
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

*(No P0 items — text messaging PRDs are already in progress)*

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

---

## P0 — Critical (NEW — API Foundation)

### Thread: API Client & WebSocket (PRD #14)

- [ ] **T-API-01**: Create `src/lib/api/client.ts` — typed HTTP client wrapper (GET/POST/PUT/DELETE)
- [ ] **T-API-02**: Create `src/lib/api/websocket.ts` — WebSocket client with auto-reconnect and heartbeat
- [ ] **T-API-03**: Build authentication store (`src/lib/stores/auth.ts`) — JWT storage via tauri-plugin-store, token refresh logic
- [ ] **T-API-04**: Create server/channel state stores (`src/lib/stores/servers.ts`, `src/lib/stores/channels.ts`)
- [ ] **T-API-05**: Implement reconnection logic with exponential backoff (max 30s), offline message queue
- [ ] **T-API-06**: Wire WebSocket events to Svelte stores (messages, typing, voice state, presence)
- [ ] **T-API-07**: Add Tauri commands `getStoredToken()` / `clearStoredToken()` in Rust
- [ ] **T-API-08**: Connection status indicator UI in Sidebar (connected/disconnected/reconnecting)
- [ ] **T-API-09**: Integration test with real Hearth server WebSocket endpoint

### Thread: Settings UI (PRD #14 dependency)

- [ ] **T-SETTINGS-01**: Create Settings route/page (`src/routes/settings/+page.svelte`)
- [ ] **T-SETTINGS-02**: Account section (display name, avatar preview — no upload yet)
- [ ] **T-SETTINGS-03**: Notifications section (enable/disable, sound toggle)
- [ ] **T-SETTINGS-04**: Audio/Video device selectors (enumerate devices, preview)
- [ ] **T-SETTINGS-05**: Window behavior section (always-on-top toggle, minimize-to-tray toggle)
- [ ] **T-SETTINGS-06**: Persist settings via `tauri-plugin-store`

---

## P1 — High (NEW — Desktop Integration)

### Thread: System Tray Enhancement (PRD #15)

- [ ] **T-TRAY-01**: Rewrite `src-tauri/src/tray.rs` with full context menu (Show, Mute, Disconnect, Quit)
- [ ] **T-TRAY-02**: Implement minimize-to-tray behavior — hide window on minimize/close (configurable)
- [ ] **T-TRAY-03**: Wire unread badge count to tray icon (macOS badge, tooltip on all platforms)
- [ ] **T-TRAY-04**: Rich notification payloads — avatar, channel name, message preview in toast
- [ ] **T-TRAY-05**: Notification sound playback on new message (configurable)
- [ ] **T-TRAY-06**: Test tray behavior on Linux (X11 + Wayland), macOS, Windows

### Thread: Window Management (PRD #16)

- [ ] **T-WINDOW-01**: Implement `set_always_on_top()` Tauri command in Rust
- [ ] **T-WINDOW-02**: Add "Always on Top" toggle button in voice controls UI
- [ ] **T-WINDOW-03**: Register global shortcut Ctrl+Shift+T for always-on-top toggle
- [ ] **T-WINDOW-04**: Persist and restore window position/size on restart (tauri-plugin-store)
- [ ] **T-WINDOW-05**: Add settings UI toggle for "Always on Top" and "Minimize to Tray"
- [ ] **T-WINDOW-06**: Visual indicator (icon/badge) when window is in always-on-top mode

---

## Notes (Updated)

- **P0 tasks (T-API-*) MUST be completed before any feature PRDs can be validated end-to-end**
- Screen share (T-SCREEN-*) can proceed in parallel — does not depend on API client
- All P1 desktop integration tasks (T-TRAY-*, T-WINDOW-*) should be started in parallel with API client
- Existing P1 thread tasks (T-SCREEN-*, T-VIDEO-*, T-THREAD-*) remain valid but need API client before integration testing

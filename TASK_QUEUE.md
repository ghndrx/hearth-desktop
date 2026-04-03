# Task Queue — Hearth Desktop

Last updated: 2026-04-03
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Native Desktop Integration (#06_native_desktop_integration.md)

- [ ] **T-DESKTOP-01**: Add `tauri-plugin-notification`, `tauri-plugin-global-shortcut`, `tauri-plugin-autostart` to dependencies
- [ ] **T-DESKTOP-02**: Implement system tray integration with context menu (Show/Hide, Mute, Quit)
- [ ] **T-DESKTOP-03**: Build native notification system with action buttons (Reply, Mark as Read, Mute Channel)
- [ ] **T-DESKTOP-04**: Implement global shortcuts (Push-to-talk, Mute/unmute, Show/hide window)
- [ ] **T-DESKTOP-05**: Add startup management (launch on startup, start minimized options)
- [ ] **T-DESKTOP-06**: Cross-platform testing (Windows 10/11, macOS 10.14+, Ubuntu 20.04+)
- [ ] **T-DESKTOP-07**: Build settings UI for notification preferences and keybinding configuration

### Thread: Rich Text & Media System (#07_rich_text_and_media_system.md)

- [ ] **T-MEDIA-01**: Build rich text editor with Markdown support (bold, italic, strikethrough, code blocks)
- [ ] **T-MEDIA-02**: Implement file upload system with drag-and-drop and progress indicators
- [ ] **T-MEDIA-03**: Build emoji picker with Unicode + custom emoji support and autocomplete
- [ ] **T-MEDIA-04**: Add media preview system (images, videos, audio, PDFs) with inline display
- [ ] **T-MEDIA-05**: Implement @ mentions and # channel references with autocomplete
- [ ] **T-MEDIA-06**: Add message reactions with emoji and user count display
- [ ] **T-MEDIA-07**: Build file security scanning and virus detection pipeline
- [ ] **T-MEDIA-08**: Add syntax highlighting for 20+ programming languages in code blocks

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

### Thread: Multi-Account & Server Organization (#08_multi_account_server_organization.md)

- [ ] **T-ACCOUNT-01**: Build multi-account management system with secure token storage (OS keychain)
- [ ] **T-ACCOUNT-02**: Implement account switching with <2 second switch time and visual feedback
- [ ] **T-ACCOUNT-03**: Build server folder system with drag-and-drop organization and custom colors
- [ ] **T-ACCOUNT-04**: Add server discovery with public directory, search, and preview mode
- [ ] **T-ACCOUNT-05**: Implement account-specific status management and custom status messages
- [ ] **T-ACCOUNT-06**: Build keyboard shortcuts for account switching (Ctrl+1-9)
- [ ] **T-ACCOUNT-07**: Add cross-account data isolation and independent notification settings
- [ ] **T-ACCOUNT-08**: Build server folder notification badges with unread count aggregation

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

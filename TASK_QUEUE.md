# Task Queue — Hearth Desktop

Last updated: 2026-04-05
Pipeline: Hearth Desktop Competitive Analysis vs Discord

## P0 — Critical (Ship Now)

### Thread: Advanced Window Management (#11_advanced_window_management.md)

- [ ] **T-WINDOW-01**: Add `set_always_on_top()` Tauri command with cross-platform support
- [ ] **T-WINDOW-02**: Implement UI toggle in main window header for "Pin on top" feature  
- [ ] **T-WINDOW-03**: Add window state persistence (position, size, always-on-top status)

### Thread: System Tray Voice Controls (#14_system_tray_voice_controls.md)

- [ ] **T-TRAY-01**: Extend tray icon with dynamic tooltip showing voice status
- [ ] **T-TRAY-02**: Add basic context menu (Open, Quit) to tray
- [ ] **T-TRAY-03**: Implement voice status tracking (connected, muted, deafened)
- [ ] **T-TRAY-04**: Add mute/deafen controls to tray context menu
- [ ] **T-TRAY-05**: Add status quick-switch menu (online, idle, DND, invisible)
- [ ] **T-TRAY-06**: Add notification badge to tray icon for unread messages
- [ ] **T-TRAY-07**: Implement minimize-to-tray behavior on close
- [ ] **T-TRAY-08**: Test cross-platform tray behavior (Windows/macOS/Linux)

### Thread: Desktop Notification Settings (#15_desktop_notification_settings.md)

- [ ] **T-NOTIF-01**: Add sound playback system to Rust backend (rodio or kira)
- [ ] **T-NOTIF-02**: Include default notification sounds (message, mention, call)
- [ ] **T-NOTIF-03**: Implement per-channel notification level settings (All/MentionsOnly/Nothing)
- [ ] **T-NOTIF-04**: Build notification settings UI panel with sound preview
- [ ] **T-NOTIF-05**: Add @mention highlighting detection and distinct notification text
- [ ] **T-NOTIF-06**: Implement Do Not Disturb toggle and schedule
- [ ] **T-NOTIF-07**: Add auto-DND during screen share (integrate with screen share feature)
- [ ] **T-NOTIF-08**: Test cross-platform notification behavior

---

## P1 — High (Next Sprint)

### Thread: Enhanced File Integration (#12_enhanced_file_integration.md)

- [ ] **T-FILE-01**: Add `tauri-plugin-drag-drop` for native drag-drop file handling
- [ ] **T-FILE-02**: Implement DropZone.svelte component with visual feedback states
- [ ] **T-FILE-03**: Add clipboard monitoring for instant screenshot/image pasting
- [ ] **T-FILE-04**: Create PastePreview.svelte for clipboard content confirmation
- [ ] **T-FILE-05**: Implement file validation (type, size limits) with clear error messages
- [ ] **T-FILE-06**: Add upload progress tracking with native progress indicators
- [ ] **T-FILE-07**: Create upload queue UI with pause/resume/cancel functionality
- [ ] **T-FILE-08**: Register as OS share target (platform-specific implementations)
- [ ] **T-FILE-09**: Build channel picker modal for shared content
- [ ] **T-FILE-10**: Implement file preview thumbnails for images/videos

### Thread: Native Media Capture (#13_native_media_capture.md)

- [ ] **T-CAPTURE-01**: Research and implement native screenshot APIs (Windows/macOS/Linux)
- [ ] **T-CAPTURE-02**: Build area selection overlay with crosshair cursor
- [ ] **T-CAPTURE-03**: Create CaptureOverlay.svelte for screenshot selection UI
- [ ] **T-CAPTURE-04**: Implement annotation canvas with drawing tools (arrow, text, highlight)
- [ ] **T-CAPTURE-05**: Add global hotkeys for instant screenshot capture
- [ ] **T-CAPTURE-06**: Integrate with existing global shortcut plugin
- [ ] **T-CAPTURE-07**: Test capture functionality over fullscreen applications

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

### Thread: Desktop Integration (#16_desktop_integration_OS_share_deeplinks.md)

- [ ] **T-DESKTOP-01**: Register `hearth://` URL scheme via Tauri
- [ ] **T-DESKTOP-02**: Implement deep link parsing in Rust (channel, user, invite, voice)
- [ ] **T-DESKTOP-03**: Add frontend navigation for deep link routes
- [ ] **T-DESKTOP-04**: Handle invite acceptance flow (accept → join voice)
- [ ] **T-DESKTOP-05**: Implement share target handler on each platform
- [ ] **T-DESKTOP-06**: Build channel picker modal for share destination
- [ ] **T-DESKTOP-07**: Configure autostart with launch minimized option
- [ ] **T-DESKTOP-08**: Implement single instance lock
- [ ] **T-DESKTOP-09**: Define and register `.hearth` file association

### Thread: Advanced Window Management (#11_advanced_window_management.md)

- [ ] **T-WINDOW-04**: Create VoicePopout.svelte component (mini voice control window)
- [ ] **T-WINDOW-05**: Implement `create_popout_window()` command for voice controls
- [ ] **T-WINDOW-06**: Add popout button to voice channel UI
- [ ] **T-WINDOW-07**: Implement monitor detection and multi-screen position mapping
- [ ] **T-WINDOW-08**: Build window positioning preferences UI
- [ ] **T-WINDOW-09**: Test always-on-top behavior across Windows/macOS/Linux

---

## P2 — Medium (Future)

### Advanced Media Capture
- [ ] **T-P2-01**: Screen recording with area selection and GIF generation
- [ ] **T-P2-02**: Audio capture integration (system + microphone) for recordings
- [ ] **T-P2-03**: Advanced annotation tools (blur, pixelate, shapes)
- [ ] **T-P2-04**: Smart capture suggestions (auto-detect error dialogs)

### File Integration Enhancements  
- [ ] **T-P2-05**: Cloud storage integration (Google Drive, Dropbox share menu)
- [ ] **T-P2-06**: Smart content recognition (auto-suggest channels for file types)
- [ ] **T-P2-07**: File encryption for sensitive content

### Window Management Polish
- [ ] **T-P2-08**: Custom window transparency/opacity controls
- [ ] **T-P2-09**: Snap zones for automatic window positioning
- [ ] **T-P2-10**: Integration with OS virtual desktop/workspace features

### Desktop Integration
- [ ] **T-P2-11**: Notification history panel
- [ ] **T-P2-12**: Keyword-based notification filters
- [ ] **T-P2-13**: Native notification actions (reply, mark read)
- [ ] **T-P2-14**: Launch with OS boot option

### Core App Features
- [ ] **T-P2-15**: Custom status messages (online/idle/dnd/custom)
- [ ] **T-P2-16**: Per-channel notification sounds
- [ ] **T-P2-17**: Keyboard shortcut customization UI
- [ ] **T-P2-18**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-19**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-20**: Message search with filters (from:, has:embed, during:, etc.)

---

## Notes

- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
- NEW (2026-04-05): Added P0 tasks for System Tray Voice Controls (#14) and Desktop Notifications (#15) 
- NEW (2026-04-05): Added P1 tasks for Desktop Integration deep links/share targets (#16)

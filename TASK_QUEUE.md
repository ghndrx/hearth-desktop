# Task Queue — Hearth Desktop

Last updated: 2026-04-03
Pipeline: Hearth Desktop Competitive Analysis — Discord March 2026 Feature Scan

## P0 — Critical (Ship Now)

### Thread: Advanced Audio Processing Engine (#13_advanced_audio_processing_engine.md) ⭐ NEW — HIGHEST PRIORITY

- [ ] **T-AUDIO-01**: Integrate CPAL and basic audio pipeline with real-time processing framework
- [ ] **T-AUDIO-02**: Implement RNNoise integration for AI-powered noise suppression
- [ ] **T-AUDIO-03**: Add automatic gain control and basic noise gate functionality
- [ ] **T-AUDIO-04**: Build voice effects pipeline (pitch shifting, robot voice, echo)
- [ ] **T-AUDIO-05**: Implement soundboard system with hotkey triggers and audio mixing
- [ ] **T-AUDIO-06**: Add GPU acceleration support for ML processing (CUDA/Metal/OpenCL)
- [ ] **T-AUDIO-07**: Build acoustic echo cancellation using adaptive filters
- [ ] **T-AUDIO-08**: Create audio settings UI with noise calibration and effect controls
- [ ] **T-AUDIO-09**: Integrate with existing WebRTC voice pipeline for seamless operation

### Thread: Gaming Performance & Hardware Integration (#14_gaming_performance_hardware_integration.md) ⭐ NEW

- [ ] **T-GAMING-01**: Implement game detection engine with process and GPU monitoring
- [ ] **T-GAMING-02**: Build RGB lighting integration (OpenRGB, Logitech G HUB, Razer Synapse)
- [ ] **T-GAMING-03**: Add gaming headset integration with advanced audio device management
- [ ] **T-GAMING-04**: Create performance optimization engine (CPU/memory management during gaming)
- [ ] **T-GAMING-05**: Implement anti-cheat compatibility layer for EasyAntiCheat/BattlEye
- [ ] **T-GAMING-06**: Build controller integration with haptic feedback for voice notifications
- [ ] **T-GAMING-07**: Add gaming mode UI with performance metrics and hardware status
- [ ] **T-GAMING-08**: Implement network traffic prioritization for voice during gameplay
- [ ] **T-GAMING-09**: Test compatibility with top 50 games and measure performance impact

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

### Thread: Advanced Media & Content Creation Tools (#15_advanced_media_content_creation.md) ⭐ NEW

- [ ] **T-MEDIA-01**: Implement background clip recording with circular buffer system
- [ ] **T-MEDIA-02**: Add voice command processing for clip triggers ("clip that", "save highlight")
- [ ] **T-MEDIA-03**: Build AI highlight detection using audio analysis and emotion detection
- [ ] **T-MEDIA-04**: Create multi-stream screen sharing for collaborative presentations
- [ ] **T-MEDIA-05**: Implement real-time screen annotation tools (drawing, shapes, text)
- [ ] **T-MEDIA-06**: Add AI image enhancement (upscaling, noise reduction, compression)
- [ ] **T-MEDIA-07**: Build real-time translation engine for voice calls
- [ ] **T-MEDIA-08**: Implement voice transcription with speaker identification
- [ ] **T-MEDIA-09**: Create clip editing interface with timeline and basic editing tools

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

### Thread: System Tray & Advanced Notifications (#10_system_tray_advanced_notifications.md) ⭐ NEW

- [ ] **T-TRAY-01**: Extend existing tray.rs with enhanced context menu system
- [ ] **T-TRAY-02**: Implement status change functionality from tray (online/idle/dnd/invisible)
- [ ] **T-TRAY-03**: Add voice controls to tray menu (mute/deafen toggles)
- [ ] **T-TRAY-04**: Build rich notification system with action buttons
- [ ] **T-TRAY-05**: Implement notification grouping and bundling algorithms
- [ ] **T-TRAY-06**: Add OS Do Not Disturb detection and integration
- [ ] **T-TRAY-07**: Build notification history and persistence system
- [ ] **T-TRAY-08**: Add avatar/image display in notifications
- [ ] **T-TRAY-09**: Implement cross-platform notification action callbacks

### Thread: Native File Handling & Drag/Drop System (#11_native_file_handling_dragdrop.md) ⭐ NEW

- [ ] **T-FILE-01**: Implement native file dialog integration with Tauri APIs
- [ ] **T-FILE-02**: Build cross-platform drag/drop event handling system
- [ ] **T-FILE-03**: Create file upload queue management with priority system
- [ ] **T-FILE-04**: Implement preview generation engine (image/video/document thumbnails)
- [ ] **T-FILE-05**: Build resumable upload system with chunking support
- [ ] **T-FILE-06**: Add file compression and optimization options
- [ ] **T-FILE-07**: Implement clipboard integration for image/file pasting
- [ ] **T-FILE-08**: Build screen capture with annotation tools
- [ ] **T-FILE-09**: Add folder drag/drop with recursive uploading support

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

### Thread: Desktop Accessibility & Voice Control (#12_desktop_accessibility_voice_control.md) ⭐ NEW

- [ ] **T-ACCESS-01**: Implement comprehensive ARIA labeling throughout application
- [ ] **T-ACCESS-02**: Build screen reader announcement system for state changes
- [ ] **T-ACCESS-03**: Add semantic HTML structure and landmark navigation
- [ ] **T-ACCESS-04**: Create focus management system with proper tab ordering
- [ ] **T-ACCESS-05**: Implement complete keyboard navigation for all UI elements
- [ ] **T-ACCESS-06**: Add customizable keyboard shortcuts with conflict detection
- [ ] **T-ACCESS-07**: Build voice command parsing and execution engine
- [ ] **T-ACCESS-08**: Integrate platform-specific speech recognition APIs
- [ ] **T-ACCESS-09**: Implement high contrast themes and visual accessibility features

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
- [ ] **T-P2-13**: ⭐ NEW — Advanced tray notification scheduling and quiet hours
- [ ] **T-P2-14**: ⭐ NEW — Cloud storage integration (Google Drive, OneDrive, Dropbox) for file sharing
- [ ] **T-P2-15**: ⭐ NEW — Voice control custom command creation and training
- [ ] **T-P2-16**: ⭐ NEW — File content analysis and auto-tagging with AI
- [ ] **T-P2-17**: ⭐ NEW — Eye tracking integration for accessibility navigation
- [ ] **T-P2-18**: ⭐ NEW — Hardware peripheral RGB sync for notifications
- [ ] **T-P2-19**: ⭐ NEW — Advanced file versioning and collaborative editing
- [ ] **T-P2-20**: ⭐ NEW — Enterprise accessibility audit reporting and compliance tools

---

## Notes

### Competitive Priority
- **CRITICAL AUDIO GAP**: Advanced Audio Processing Engine (PRD #13) is highest priority — audio quality is Discord's primary competitive moat
- **GAMING PERFORMANCE**: Gaming optimization (PRD #14) essential for serious gamer adoption — zero performance impact requirement
- **CONTENT CREATION**: Advanced media tools (PRD #15) required for 2026 feature parity — AI-powered content creation is becoming standard
- Rich Presence system enables game detection and social features core to Discord's value proposition
- Overlay system required for competitive gaming experience (voice controls without tabbing out)
- Advanced tray notifications and file drag/drop create native desktop experience vs web app feeling

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

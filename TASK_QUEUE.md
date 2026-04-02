# Task Queue — Hearth Desktop

Last updated: 2026-04-02
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Global Hotkeys (#06_global_hotkeys_system.md)

- [ ] **T-HOTKEY-01**: Add `global-hotkey` crate to `src-tauri/Cargo.toml`
- [ ] **T-HOTKEY-02**: Implement `HotkeyManager` struct with cross-platform registration
- [ ] **T-HOTKEY-03**: Create Tauri commands `register_hotkey()`, `unregister_hotkey()`
- [ ] **T-HOTKEY-04**: Implement `ActionRouter` to map hotkey events to voice actions
- [ ] **T-HOTKEY-05**: Connect hotkeys to existing voice system (mute, push-to-talk)
- [ ] **T-HOTKEY-06**: Add hotkey conflict detection and resolution logic
- [ ] **T-HOTKEY-07**: Build hotkey configuration UI in settings panel
- [ ] **T-HOTKEY-08**: Add visual feedback for active hotkeys in system tray
- [ ] **T-HOTKEY-09**: Test <50ms latency requirement across platforms

### Thread: Dynamic Tray Context Menu (#09_dynamic_tray_context_menu.md)

- [ ] **T-TRAY-01**: Design tray menu structure and state model
- [ ] **T-TRAY-02**: Implement `TrayMenuState` struct and IPC commands in Rust
- [ ] **T-TRAY-03**: Build `trayStore.ts` reactive store in frontend
- [ ] **T-TRAY-04**: Implement dynamic menu rebuild on tray open (Linux)
- [ ] **T-TRAY-05**: Wire up all menu item actions to IPC events
- [ ] **T-TRAY-06**: Add tooltip update for current voice channel name
- [ ] **T-TRAY-07**: Platform testing: Linux (GTK), macOS, Windows
- [ ] **T-TRAY-08**: Accessibility: keyboard navigation of tray menu

### Thread: Badge Count Display (#10_badge_count_display.md)

- [ ] **T-BADGE-01**: Design unread state model and persistence schema
- [ ] **T-BADGE-02**: Implement `unreadStore.ts` with per-channel counters
- [ ] **T-BADGE-03**: Create `BadgeCount.svelte` component for channel tree
- [ ] **T-BADGE-04**: Wire MESSAGE_CREATE WebSocket → unreadStore
- [ ] **T-BADGE-05**: Implement `set_badge_count` / `clear_badge` Rust commands
- [ ] **T-BADGE-06**: Windows badge implementation (TaskbarList3)
- [ ] **T-BADGE-07**: macOS badge implementation (NSApp dockTile)
- [ ] **T-BADGE-08**: Linux badge implementation (unity-launcher)
- [ ] **T-BADGE-09**: Cross-platform testing: Linux, macOS, Windows
- [ ] **T-BADGE-10**: Unread persistence on app restart (tauri-plugin-store)

### Thread: Minimize to Tray Behavior (#11_minimize_to_tray_behavior.md)

- [ ] **T-MINTR-01**: Intercept window close event in Rust, prevent default quit
- [ ] **T-MINTR-02**: Implement window hide/show logic with state restoration
- [ ] **T-MINTR-03**: Wire tray icon double-click to restore window
- [ ] **T-MINTR-04**: Add `Minimize to tray` setting toggle (Settings UI)
- [ ] **T-MINTR-05**: Persist setting via tauri-plugin-store
- [ ] **T-MINTR-06**: Update tooltip on tray during background running
- [ ] **T-MINTR-07**: Voice connection maintained during minimize-to-tray
- [ ] **T-MINTR-08**: Platform testing: Linux, macOS, Windows

### Thread: Rich Desktop Notifications (#08_rich_desktop_notifications.md)

- [ ] **T-NOTIFY-01**: Implement `NotificationManager` with platform-specific backends
- [ ] **T-NOTIFY-02**: Add rich content support (avatar, media previews, formatting)
- [ ] **T-NOTIFY-03**: Implement interactive actions (reply, mark read, join voice)
- [ ] **T-NOTIFY-04**: Build notification grouping and management system
- [ ] **T-NOTIFY-05**: Add priority levels and quiet hours functionality
- [ ] **T-NOTIFY-06**: Deep OS integration (Action Center, Notification Center)
- [ ] **T-NOTIFY-07**: Implement system tray badge count display *(moved to T-BADGE-05 through T-BADGE-10)*
- [ ] **T-NOTIFY-08**: Build comprehensive notification settings UI
- [ ] **T-NOTIFY-09**: Test <500ms display latency and 95%+ delivery rate

### Thread: Protocol Handler System (#12_protocol_handler_system.md)

- [ ] **T-PROTO-01**: Design URL schema and routing table
- [ ] **T-PROTO-02**: Implement `DeepLinkRouter` in Rust
- [ ] **T-PROTO-03**: Add protocol registration to Tauri config
- [ ] **T-PROTO-04**: Create IPC command `handle_deep_link(url)`
- [ ] **T-PROTO-05**: Windows protocol registration (installer + registry)
- [ ] **T-PROTO-06**: macOS URL scheme handling (Info.plist + NSAppleEventManager)
- [ ] **T-PROTO-07**: Linux .desktop file + MIME association
- [ ] **T-PROTO-08**: Test cross-platform protocol activation
- [ ] **T-PROTO-09**: Extend frontend router for deep link navigation
- [ ] **T-PROTO-10**: Add loading states for external link handling
- [ ] **T-PROTO-11**: Error handling UI (invalid invites, network failures)
- [ ] **T-PROTO-12**: Integration testing with real invite flows

### Thread: Advanced Audio Features (#14_advanced_audio_features.md)

- [ ] **T-AUDIO-01**: Research and select noise suppression library (WebRTC vs. custom)
- [ ] **T-AUDIO-02**: Implement AudioPipeline architecture in Rust
- [ ] **T-AUDIO-03**: Add enhanced echo cancellation algorithms
- [ ] **T-AUDIO-04**: Build automatic gain control with attack/release settings
- [ ] **T-AUDIO-05**: Platform-specific audio backend optimization
- [ ] **T-AUDIO-06**: Implement AudioDeviceManager with hot-swap detection
- [ ] **T-AUDIO-07**: Build device profile system (save/load settings per device)
- [ ] **T-AUDIO-08**: Add automatic device switching logic
- [ ] **T-AUDIO-09**: Hardware button integration (mute, volume, media keys)

### Thread: Enhanced Security & Privacy System (#17_enhanced_security_privacy_system.md)

- [ ] **T-SECURITY-01**: Design security architecture and implement TOTP-based 2FA
- [ ] **T-SECURITY-02**: Build SMS authentication fallback with recovery codes
- [ ] **T-SECURITY-03**: Implement active session tracking and device management
- [ ] **T-SECURITY-04**: Add login anomaly detection and remote session termination
- [ ] **T-SECURITY-05**: Build GDPR-compliant data export and account deletion
- [ ] **T-SECURITY-06**: Create privacy settings dashboard with granular controls
- [ ] **T-SECURITY-07**: Implement Signal Protocol E2E encryption for private messages
- [ ] **T-SECURITY-08**: Add encrypted voice calls with perfect forward secrecy
- [ ] **T-SECURITY-09**: Build comprehensive audit logging and security monitoring
- [ ] **T-SECURITY-10**: Implement ML-based content filtering and user reporting

### Thread: Advanced Voice Communication System (#18_advanced_voice_communication_system.md)

- [ ] **T-VOICE-01**: Implement voice message recording with waveform visualization
- [ ] **T-VOICE-02**: Add voice message transcription using Whisper WASM
- [ ] **T-VOICE-03**: Build real-time speech-to-text with live captions display
- [ ] **T-VOICE-04**: Implement real-time voice effects and DSP processing
- [ ] **T-VOICE-05**: Create custom soundboard with hotkey activation
- [ ] **T-VOICE-06**: Build 3D spatial audio with Web Audio API and HRTF
- [ ] **T-VOICE-07**: Add spatial audio zones and gaming position integration
- [ ] **T-VOICE-08**: Implement voice call recording with consent management
- [ ] **T-VOICE-09**: Build meeting transcription and automatic note generation

### Thread: Game Overlay System (#07_game_overlay_system.md) *Depends on T-HOTKEY*

- [ ] **T-OVERLAY-01**: Research and implement DirectX/Vulkan overlay injection
- [ ] **T-OVERLAY-02**: Create shared memory IPC between game and host process
- [ ] **T-OVERLAY-03**: Implement game process detection and monitoring
- [ ] **T-OVERLAY-04**: Build basic overlay rendering with ImGui or custom renderer
- [ ] **T-OVERLAY-05**: Connect overlay to existing WebRTC voice infrastructure
- [ ] **T-OVERLAY-06**: Add voice participant display with speaking indicators
- [ ] **T-OVERLAY-07**: Implement overlay positioning and transparency controls
- [ ] **T-OVERLAY-08**: Add anti-cheat compatibility (BattlEye, EasyAntiCheat coordination)
- [ ] **T-OVERLAY-09**: Test <5% performance impact across 50+ popular games

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

### Thread: Multi-Window Support (#13_multi_window_support.md)

- [ ] **T-WINDOW-01**: Design WindowManager architecture and state model
- [ ] **T-WINDOW-02**: Implement multi-window Tauri configuration
- [ ] **T-WINDOW-03**: Create window factory pattern for different types
- [ ] **T-WINDOW-04**: Build window state persistence system
- [ ] **T-WINDOW-05**: Add "Pop out channel" context menu option
- [ ] **T-WINDOW-06**: Create compact channel layout for popout windows
- [ ] **T-WINDOW-07**: Implement cross-window message synchronization
- [ ] **T-WINDOW-08**: Add window close/restore flows
- [ ] **T-WINDOW-09**: Build compact voice controls popout
- [ ] **T-WINDOW-10**: Implement always-on-top toggle with system permissions
- [ ] **T-WINDOW-11**: Create picture-in-picture video component
- [ ] **T-WINDOW-12**: Add resizing and positioning controls
- [ ] **T-WINDOW-13**: Multi-monitor support with DPI awareness
- [ ] **T-WINDOW-14**: Window state restoration across app restarts
- [ ] **T-WINDOW-15**: Keyboard shortcuts for window management
- [ ] **T-WINDOW-16**: Integration testing across platforms

### Thread: Advanced File Management & Collaboration (#16_advanced_file_management_system.md)

- [ ] **T-FILE-01**: Design cloud storage architecture and implement file upload/download
- [ ] **T-FILE-02**: Build file metadata management with resumable transfers
- [ ] **T-FILE-03**: Implement hierarchical folder system and file tagging
- [ ] **T-FILE-04**: Build file browser UI with tree navigation and search
- [ ] **T-FILE-05**: Create bidirectional sync engine with conflict resolution
- [ ] **T-FILE-06**: Add offline file access and local caching system
- [ ] **T-FILE-07**: Implement file versioning and history management
- [ ] **T-FILE-08**: Build rich file preview generation for common formats
- [ ] **T-FILE-09**: Add syntax highlighting for code files and document conversion
- [ ] **T-FILE-10**: Implement Operational Transform for real-time collaborative editing
- [ ] **T-FILE-11**: Build collaborative text editor with presence indicators
- [ ] **T-FILE-12**: Add commenting and annotation system for documents

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

# Task Queue — Hearth Desktop

Last updated: 2026-04-02
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

### Thread: Native System Integration (#06_native_system_integration.md)

- [ ] **T-NATIVE-01**: Integrate tauri-plugin-global-shortcut for global shortcut system
- [ ] **T-NATIVE-02**: Implement global push-to-talk shortcut (works when app unfocused)
- [ ] **T-NATIVE-03**: Add global mute/unmute and show/hide app shortcuts
- [ ] **T-NATIVE-04**: Build shortcut configuration UI with conflict detection
- [ ] **T-NATIVE-05**: Upgrade notification system with action buttons (reply, join voice)
- [ ] **T-NATIVE-06**: Implement notification grouping and priority levels
- [ ] **T-NATIVE-07**: Add rich context menu to system tray (status, recent channels, voice info)
- [ ] **T-NATIVE-08**: Implement dynamic tray icon states (unread badges, voice indicators)

### Thread: File Handling & Media System (#07_file_handling_and_media_system.md)

- [ ] **T-FILE-01**: Implement cross-platform drag & drop detection for file upload
- [ ] **T-FILE-02**: Build chunked file upload pipeline with progress tracking
- [ ] **T-FILE-03**: Add clipboard image paste support (Ctrl+V for screenshots)
- [ ] **T-FILE-04**: Create file type validation and size checking system
- [ ] **T-FILE-05**: Implement in-app image viewer with zoom and navigation
- [ ] **T-FILE-06**: Add basic video/audio playbook with custom controls
- [ ] **T-FILE-07**: Build download management with progress tracking
- [ ] **T-FILE-08**: Create automatic image compression and EXIF stripping

### Thread: Mobile Companion Integration (#10_mobile_companion_integration.md)

- [ ] **T-MOBILE-01**: Build secure device pairing system with QR codes and WebSocket infrastructure
- [ ] **T-MOBILE-02**: Implement remote voice channel join/leave from mobile devices
- [ ] **T-MOBILE-03**: Add remote microphone mute/unmute controls from mobile app
- [ ] **T-MOBILE-04**: Create mobile voice session UI with desktop connection status
- [ ] **T-MOBILE-05**: Implement cross-device notification deduplication and priority routing
- [ ] **T-MOBILE-06**: Build real-time state synchronization (read status, presence, drafts)
- [ ] **T-MOBILE-07**: Add desktop wake/sleep remote control capabilities

### Thread: Advanced Audio System (#11_advanced_audio_system.md)

- [ ] **T-AUDIO-01**: Implement real-time AI noise suppression with WebAudio API pipeline
- [ ] **T-AUDIO-02**: Add automatic gain control (AGC) and dynamic range compression
- [ ] **T-AUDIO-03**: Integrate ASIO driver support for professional audio interfaces
- [ ] **T-AUDIO-04**: Build hardware audio device detection and low-latency monitoring
- [ ] **T-AUDIO-05**: Create configurable audio effects chain with real-time processing
- [ ] **T-AUDIO-06**: Implement audio quality monitoring and performance metrics
- [ ] **T-AUDIO-07**: Add custom audio profiles for different scenarios (gaming, professional, streaming)

### Thread: System Performance & Auto-Updates (#12_system_performance_optimization.md)

- [ ] **T-PERF-01**: Build delta update system with atomic installation and rollback capability
- [ ] **T-PERF-02**: Implement intelligent auto-update scheduling during idle periods
- [ ] **T-PERF-03**: Create real-time performance monitoring (CPU, memory, network metrics)
- [ ] **T-PERF-04**: Build gaming mode with automatic game detection and resource optimization
- [ ] **T-PERF-05**: Implement intelligent background task deferral and resource management
- [ ] **T-PERF-06**: Add system health monitoring with predictive issue detection
- [ ] **T-PERF-07**: Create crash recovery system with voice session state restoration

### Thread: Developer Ecosystem Platform (#13_developer_ecosystem_platform.md)

- [ ] **T-DEV-01**: Design Discord-compatible REST API architecture with authentication framework
- [ ] **T-DEV-02**: Implement WebSocket gateway for real-time events and bot communication
- [ ] **T-DEV-03**: Build OAuth2 bot authorization system with scope-based permissions
- [ ] **T-DEV-04**: Create basic message sending/receiving API endpoints for bots
- [ ] **T-DEV-05**: Implement slash command registration and handling system
- [ ] **T-DEV-06**: Build interactive message components (buttons, select menus, modals)
- [ ] **T-DEV-07**: Create developer dashboard for bot management and analytics
- [ ] **T-DEV-08**: Implement webhook infrastructure (incoming/outgoing) with security

### Thread: Advanced Community Management (#14_advanced_community_management.md)

- [ ] **T-COMMUNITY-01**: Build AutoMod content analysis engine with AI toxicity detection
- [ ] **T-COMMUNITY-02**: Implement automated moderation actions (timeout, warn, ban)
- [ ] **T-COMMUNITY-03**: Create centralized moderation dashboard with real-time alerts
- [ ] **T-COMMUNITY-04**: Build user moderation history tracking and case management
- [ ] **T-COMMUNITY-05**: Implement server analytics dashboard with growth and engagement metrics
- [ ] **T-COMMUNITY-06**: Create forum channel system with thread organization
- [ ] **T-COMMUNITY-07**: Build community discovery and public server directory
- [ ] **T-COMMUNITY-08**: Implement advanced user permission and role management system

### Thread: Comprehensive Accessibility System (#15_comprehensive_accessibility_system.md)

- [ ] **T-ACCESS-01**: Implement WCAG 2.1 AA compliant semantic HTML structure with ARIA labels
- [ ] **T-ACCESS-02**: Build complete keyboard navigation system with focus management
- [ ] **T-ACCESS-03**: Create high contrast theme variants (dark/light) with 7:1 contrast ratio
- [ ] **T-ACCESS-04**: Implement screen reader support for NVDA, JAWS, VoiceOver, and Orca
- [ ] **T-ACCESS-05**: Add scalable typography system (100%-400%) with dyslexia-friendly fonts
- [ ] **T-ACCESS-06**: Build internationalization framework supporting 30+ languages with RTL
- [ ] **T-ACCESS-07**: Implement visual audio indicators and real-time voice transcription
- [ ] **T-ACCESS-08**: Create motor accessibility features (adjustable targets, alternative input)

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

### Thread: Advanced Window Management (#09_advanced_window_management.md)

- [ ] **T-WINDOW-01**: Design multi-window architecture with shared state synchronization
- [ ] **T-WINDOW-02**: Implement window spawning for voice channels (pop-out functionality)
- [ ] **T-WINDOW-03**: Build window state persistence (position, size, monitor)
- [ ] **T-WINDOW-04**: Add always-on-top mode toggle for floating windows
- [ ] **T-WINDOW-05**: Implement window opacity/transparency controls
- [ ] **T-WINDOW-06**: Create compact/mini mode for small persistent windows
- [ ] **T-WINDOW-07**: Build smart window positioning and multi-monitor support
- [ ] **T-WINDOW-08**: Add cross-window communication and event system

### Thread: Mobile Companion Advanced Features (#10_mobile_companion_integration.md)

- [ ] **T-MOBILE-08**: Implement seamless call handoff from desktop to mobile
- [ ] **T-MOBILE-09**: Add file upload continuity across device switches
- [ ] **T-MOBILE-10**: Build iOS companion app with Siri Shortcuts and Control Center widget
- [ ] **T-MOBILE-11**: Create Android companion app with Quick Settings tile and Tasker integration
- [ ] **T-MOBILE-12**: Add Apple Watch / Wear OS companion apps for voice control
- [ ] **T-MOBILE-13**: Implement cross-device clipboard synchronization
- [ ] **T-MOBILE-14**: Build mobile push notification management with desktop sync

### Thread: Professional Audio Features (#11_advanced_audio_system.md)

- [ ] **T-AUDIO-08**: Add real-time voice effects (pitch shift, voice changer, reverb)
- [ ] **T-AUDIO-09**: Implement multi-channel audio interface support
- [ ] **T-AUDIO-10**: Build MIDI controller integration for hardware audio control
- [ ] **T-AUDIO-11**: Add streaming software integration (OBS, XSplit) with virtual audio device
- [ ] **T-AUDIO-12**: Implement VST plugin support for professional audio processing
- [ ] **T-AUDIO-13**: Create spectrum analyzer and real-time audio visualization
- [ ] **T-AUDIO-14**: Add background noise classification and adaptive suppression

### Thread: Enterprise Performance Features (#12_system_performance_optimization.md)

- [ ] **T-PERF-08**: Build enterprise update management with Group Policy support
- [ ] **T-PERF-09**: Implement performance analytics and trend analysis
- [ ] **T-PERF-10**: Add machine learning models for usage pattern recognition
- [ ] **T-PERF-11**: Create predictive resource allocation and optimization
- [ ] **T-PERF-12**: Build integration with enterprise monitoring tools
- [ ] **T-PERF-13**: Implement automated optimization recommendations
- [ ] **T-PERF-14**: Add cross-platform performance baseline establishment

### Thread: Advanced Developer Platform Features (#13_developer_ecosystem_platform.md)

- [ ] **T-DEV-09**: Build application marketplace and bot directory with search/discovery
- [ ] **T-DEV-10**: Implement advanced bot permissions and OAuth2 scopes system
- [ ] **T-DEV-11**: Add voice API endpoints for music bots and audio applications
- [ ] **T-DEV-12**: Create comprehensive API documentation with interactive examples
- [ ] **T-DEV-13**: Build bot verification system and developer support tools
- [ ] **T-DEV-14**: Implement rate limiting and abuse prevention for developer APIs
- [ ] **T-DEV-15**: Add webhook retry logic, failure handling, and security verification
- [ ] **T-DEV-16**: Create official SDKs for Python, JavaScript, Java, and C#

### Thread: Enterprise Community Management (#14_advanced_community_management.md)

- [ ] **T-COMMUNITY-09**: Build advanced user appeals system with workflow management
- [ ] **T-COMMUNITY-10**: Implement server monetization tools and subscription management
- [ ] **T-COMMUNITY-11**: Add community events system with calendar integration and RSVPs
- [ ] **T-COMMUNITY-12**: Create server backup and export functionality for data portability
- [ ] **T-COMMUNITY-13**: Build cross-server moderation sharing and collaboration tools
- [ ] **T-COMMUNITY-14**: Implement advanced analytics with predictive community insights
- [ ] **T-COMMUNITY-15**: Add integration with external moderation and security services
- [ ] **T-COMMUNITY-16**: Create comprehensive audit logging with compliance reporting

### Thread: Advanced Accessibility Features (#15_comprehensive_accessibility_system.md)

- [ ] **T-ACCESS-09**: Implement voice control integration with speech-to-text commands
- [ ] **T-ACCESS-10**: Add eye tracking and head mouse support for alternative navigation
- [ ] **T-ACCESS-11**: Build cognitive accessibility features (simplified UI, reading aids)
- [ ] **T-ACCESS-12**: Create personalized accessibility adaptations with ML preferences
- [ ] **T-ACCESS-13**: Add advanced screen reader optimizations and custom commands
- [ ] **T-ACCESS-14**: Implement comprehensive cultural localization beyond language translation
- [ ] **T-ACCESS-15**: Build accessibility testing framework for continuous compliance
- [ ] **T-ACCESS-16**: Create accessibility onboarding and feature discovery system

---

## P2 — Medium (Future)

- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Custom status messages (online/idle/dnd/custom) and status indicators in tray
- [ ] **T-P2-03**: Per-channel notification sounds and advanced notification filtering
- [ ] **T-P2-04**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-05**: Rich text editor (markdown toolbar, emoji picker)
- [ ] **T-P2-06**: Message search with filters (from:, has:embed, during:, etc.)
- [ ] **T-P2-07**: Advanced window layouts and workspace management
- [ ] **T-P2-08**: Platform-specific integrations (Windows jump lists, macOS dock menus)
- [ ] **T-P2-09**: Advanced media processing (video thumbnails, audio waveforms)
- [ ] **T-P2-10**: Multi-file upload queue and batch processing

---

## Notes

### Dependencies
- P0 Native Integration tasks can run in parallel with text messaging development
- P0 File Handling tasks require basic text messaging for file sharing context
- P0 Mobile Companion requires voice system and notification infrastructure
- P0 Advanced Audio requires WebRTC pipeline from PR #17 as foundation
- P0 Performance/Updates can start immediately as foundational infrastructure
- P1 Window Management can start after basic text messaging is stable
- All existing P1 tasks still depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts

### Critical Path for Discord Desktop Parity
**NEW CRITICAL GAPS IDENTIFIED (2026-04-02):**
1. **Developer Ecosystem Platform** (T-DEV-01 to T-DEV-08) — HIGHEST PRIORITY: No bot/API support blocks community migration
2. **Comprehensive Accessibility** (T-ACCESS-01 to T-ACCESS-08) — LEGAL REQUIREMENT: WCAG compliance for enterprise adoption
3. **Advanced Community Management** (T-COMMUNITY-01 to T-COMMUNITY-08) — SCALING BLOCKER: No moderation tools prevent large communities

**EXISTING CRITICAL PATH:**
4. **Auto-Updates & Performance** (T-PERF-01 to T-PERF-07) — Essential infrastructure for competitive product
5. **Advanced Audio Processing** (T-AUDIO-01 to T-AUDIO-07) — Critical for voice quality parity with Discord
6. **Mobile Companion Integration** (T-MOBILE-01 to T-MOBILE-07) — Required for modern cross-device workflows
7. **Global Shortcuts** (T-NATIVE-01 to T-NATIVE-04) — Essential for power users and gaming
8. **Enhanced Notifications** (T-NATIVE-05 to T-NATIVE-06) — Critical for Discord parity
9. **File Upload/Drop** (T-FILE-01 to T-FILE-04) — Required for basic chat functionality
10. **Multi-window Support** (T-WINDOW-01 to T-WINDOW-02) — High-value differentiator

### Updated Dependencies (Post Competitive Analysis)
- **Developer Platform** (T-DEV-01 to T-DEV-08) has ZERO dependencies — can start immediately
- **Accessibility Foundation** (T-ACCESS-01 to T-ACCESS-06) can start immediately with design system
- **Community Management** (T-COMMUNITY-01 to T-COMMUNITY-05) requires basic user/permission system

### Design Dependencies
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
- File upload UI (T-FILE-01, T-FILE-02) needs drag-drop visual design
- Window management UI (T-WINDOW-04, T-WINDOW-05) needs settings panel design

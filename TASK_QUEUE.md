# Hearth Desktop Task Queue

**Last Updated:** March 26, 2026 (Q2 2026 Competitive Intelligence Update — 3 Critical P0 PRDs Added)
**Competitive Intelligence Analysis vs Discord Desktop**

This task queue prioritizes development efforts to achieve feature parity with Discord's native desktop application. Tasks are categorized by priority level and estimated effort.

## P0 (Critical) - Core Competitive Features

### **NEW** Rich Text Chat System 🚨
**Status:** Critical Gap Identified | **Target:** Q2 2026 | **Effort:** 6-8 weeks | **PRD:** PRD-001

- [x] **Core Messaging Infrastructure** - WebSocket real-time messaging with SQLite persistence **[PRD-001]** ✅ (3fe62a16, merged via PR #30)
- [ ] **Message Input & Display** - Rich text editor with markdown support and message history **[PRD-001]**
- [ ] **File Upload System** - Drag-and-drop uploads with image preview and 25MB limit **[PRD-001]**
- [ ] **Direct Messages** - 1-on-1 and group messaging with notification preferences **[PRD-001]**
- [ ] **Message Management** - Edit, delete, reply, and reaction functionality **[PRD-001]**
- [ ] **Emoji & Reactions** - System emoji picker with custom server emoji support **[PRD-001]**
- [ ] **Message Search** - Full-text search across all joined channels with pagination **[PRD-001]**
- [ ] **Performance Optimization** - Virtual scrolling for 100,000+ message channels **[PRD-001]**

### **NEW** Video Calling & Screen Sharing System 🚨
**Status:** Critical Gap Identified | **Target:** Q2-Q3 2026 | **Effort:** 8-10 weeks | **PRD:** PRD-002

- [ ] **WebRTC Video Infrastructure** - Multi-participant video calling with adaptive quality **[PRD-002]**
- [ ] **Camera Integration** - Device enumeration, preview, and control system **[PRD-002]**
- [ ] **Cross-Platform Screen Capture** - Native screen/window capture for all platforms **[PRD-002]**
- [ ] **Video Call Controls** - Camera toggle, quality selection, picture-in-picture mode **[PRD-002]**
- [ ] **Screen Share Selection** - Screen/window picker with live preview thumbnails **[PRD-002]**
- [ ] **Performance Optimization** - Hardware acceleration and bandwidth management **[PRD-002]**
- [ ] **Go Live Streaming** - 1-to-many streaming with viewer count and chat overlay **[PRD-002]**

### **NEW** Global Shortcuts & Enhanced OS Integration 🚨
**Status:** Critical Gap Identified | **Target:** Q2 2026 | **Effort:** 4-6 weeks | **PRD:** PRD-003

- [ ] **Global Shortcut System** - Cross-platform hotkey registration with conflict detection **[PRD-003]**
- [ ] **Push-to-Talk Framework** - System-wide PTT with customizable key combinations **[PRD-003]**
- [ ] **Enhanced System Tray** - Rich context menus with quick actions and status indicators **[PRD-003]**
- [ ] **Rich Presence System** - Activity detection and status broadcasting to friends **[PRD-003]**
- [ ] **Native OS Integration** - Platform-specific features (Jump Lists, Dock badges, D-Bus) **[PRD-003]**
- [ ] **Quick Actions** - Voice channel join from tray, status updates, recent channels **[PRD-003]**

### Advanced Voice & Audio Features
**Status:** P0 Infrastructure Complete | **Target:** Q2 2026 | **Effort:** 16 weeks

- [x] **WebRTC Voice Infrastructure** - Implement peer-to-peer voice communication system ✅ (2dac71b7)
- [x] **AI Noise Suppression Engine** - RNNoise + custom AI models **[NEW PRD: AI-COMM-001]** ✅ (68cb28ae)
- [ ] **Real-Time Transcription** - Whisper-based speech-to-text with live captions **[AI-COMM-001]**
- [ ] **Advanced Echo Cancellation** - WebRTC AEC3 implementation **[AI-COMM-001]**
- [ ] **Voice Enhancement Suite** - Bandwidth extension, clarity improvement **[AI-COMM-001]**
- [ ] **Environment Noise Detection** - Adaptive suppression based on noise type **[AI-COMM-001]**
- [ ] **Persistent Voice Channels** - Always-on voice rooms with member management
- [ ] **Spatial Audio System** - 3D positional audio with HRTF processing
- [ ] **Push-to-Talk Framework** - Global hotkey system with hardware integration
- [x] **Voice Activity Detection** - Smart voice detection with configurable sensitivity ✅ (WebRTC VAD, 2dac71b7)
- [x] **P2P Connection Diagnostics** - Real-time connection quality monitoring ✅ (2dac71b7)
- [x] **Voice Quality Controls** - Echo cancellation, AGC, HPF filters ✅ (2dac71b7)

### Game Integration & Rich Presence System
**Status:** 80% Complete | **Target:** Q1 2026 | **Effort:** 12 weeks

- [x] **Game Detection Engine** - Process scanning for Steam/Epic/custom games ✅ (3c0d546b)
- [x] **Steam API Integration** - Game library and playtime synchronization ✅ (c7e769c0, GAME-003)
- [x] **Rich Presence Broadcasting** - Custom game states and metadata display ✅ (54d90192)
- [x] **Epic & Battle.net Support** - Library detection for both platforms ✅ (05bbb01e, GAME-004)
- [x] **Game Library Panel** - Management UI for all game sources ✅ (c7e769c0)
- [ ] **Achievement Tracking** - Game achievement display and sharing **[NEW PRD]**
- [ ] **Join Game Functionality** - One-click game join via rich presence **[NEW PRD]**
- [ ] **Anti-Cheat Compatibility** - Ensure compatibility with major anti-cheat systems

### Window Management & Overlay System
**Status:** 60% Complete | **Target:** Q2 2026 | **Effort:** 16 weeks

- [x] **Always-On-Top Framework** - Persistent window positioning above all apps ✅
- [x] **Mini Player Mode** - Compact voice channel interface ✅ (VoiceMiniPlayer.svelte)
- [x] **Multi-Window Architecture** - Pop-out channels into separate windows ✅ (MW-001, dd24cbc9)
- [x] **Voice PiP Overlay** - Picture-in-picture voice overlay ✅ (MW-002, db1bc1a6)
- [x] **Floating Mini Window** - Global shortcuts, multi-corner positioning ✅ (1353ac9e)
- [x] **Tray Badge Overlay** - Unread count on tray icon ✅ (5e1a2dd0)
- [ ] **Basic Overlay Engine** - Transparent overlay windows for windowed games
- [ ] **In-Game Overlay Injection** - True in-game overlay for full-screen apps **[NEW PRD: OVERLAY-001]** ⚠️ P0
- [ ] **DirectX/OpenGL Hook System** - Core overlay injection infrastructure **[OVERLAY-001]**
- [ ] **Anti-Cheat Compatibility** - BattlEye, EasyAntiCheat, Vanguard support **[OVERLAY-001]**
- [ ] **Overlay Voice Controls** - In-game voice mute/unmute and channel switching **[OVERLAY-001]**
- [ ] **Gaming Hotkey System** - Global hotkeys that work in fullscreen games **[OVERLAY-001]**
- [ ] **Overlay Positioning System** - Smart overlay placement with user customization
- [ ] **Performance Optimization** - <16ms overlay rendering with <5% CPU overhead

### Real-Time Screen Sharing & Streaming System
**Status:** PRD Complete (STREAM-001) | **Target:** Q3 2026 | **Effort:** 18 weeks

- [ ] **Cross-Platform Screen Capture** - DirectX, ScreenCaptureKit, X11/Wayland capture **[NEW PRD: STREAM-001]**
- [ ] **Hardware-Accelerated Encoding** - NVENC, QuickSync, VCE, VAAPI support **[STREAM-001]**
- [ ] **WebRTC Streaming Protocol** - Real-time screen sharing infrastructure **[STREAM-001]**
- [ ] **Multi-Monitor Support** - Source selection across multiple displays **[STREAM-001]**
- [ ] **Audio Mixing System** - System audio + microphone synchronization **[STREAM-001]**
- [ ] **Scalable Viewer Architecture** - SFU implementation for 50+ viewers **[STREAM-001]**
- [ ] **Quality Adaptation Engine** - Dynamic bitrate/resolution adjustment **[STREAM-001]**
- [ ] **Recording System** - Local recording with MP4 export **[STREAM-001]**
- [ ] **Content Creator Integration** - OBS Studio, Stream Deck compatibility **[STREAM-001]**

## P1 (High) - Enhanced User Experience

### **NEW** Advanced Chat Features (Follow-up to PRD-001)
**Status:** P1 Enhancement | **Target:** Q3 2026 | **Effort:** 4 weeks | **PRD:** PRD-001

- [ ] **Message Threading** - Advanced threaded conversations for better organization
- [ ] **Voice Messages** - Record and send voice clips in text channels
- [ ] **Message Translation** - Real-time message translation for international servers
- [ ] **Advanced Search Filters** - Search by user, date, file type, and content filters
- [ ] **Message Templates** - Quick reply templates and auto-responses
- [ ] **Rich Link Previews** - Automatic link preview generation with metadata

### **NEW** Enhanced Video Features (Follow-up to PRD-002)
**Status:** P1 Enhancement | **Target:** Q3-Q4 2026 | **Effort:** 6 weeks | **PRD:** PRD-002

- [ ] **Virtual Backgrounds** - AI-powered background blur and replacement
- [ ] **Video Recording** - Local recording of video calls with consent management
- [ ] **Advanced Video Effects** - Filters, touch-up, and real-time effects
- [ ] **Multi-Camera Support** - Switch between multiple connected cameras
- [ ] **Presentation Mode** - Optimized settings for screen sharing presentations
- [ ] **Bandwidth Optimization** - Intelligent quality scaling based on network conditions

### **NEW** Advanced OS Integration (Follow-up to PRD-003)
**Status:** P1 Enhancement | **Target:** Q3 2026 | **Effort:** 4 weeks | **PRD:** PRD-003

- [ ] **Voice Commands** - "Hey Hearth" voice activation for shortcuts
- [ ] **Smart Status Updates** - AI-powered automatic status based on activity
- [ ] **Cross-Device Shortcuts** - Sync shortcut preferences across devices
- [ ] **Advanced Workflows** - Chain shortcuts for complex multi-step actions
- [ ] **Contextual Shortcuts** - Different shortcuts for different applications
- [ ] **Hardware Button Mapping** - Support for gaming keyboard macro keys

### Hardware Integration & Media Controls
**Status:** PRD Complete | **Target:** Q3 2026 | **Effort:** 16 weeks

- [ ] **Gaming Headset Integration** - Direct integration with top 15 gaming headsets
- [ ] **Media Key Framework** - System media key capture and handling
- [ ] **RGB Ecosystem Integration** - Razer Chroma, Corsair iCUE, Logitech LightSync
- [ ] **Headset Button Mapping** - Mute, volume, call controls via headset buttons
- [ ] **Gaming Keyboard Support** - Macro keys and RGB status synchronization
- [ ] **Hardware Device Detection** - Automatic discovery and configuration
- [ ] **Professional Audio Support** - XLR interfaces and audio mixer integration

### Advanced Startup & System Integration
**Status:** PRD Complete | **Target:** Q1 2026 | **Effort:** 16 weeks

- [ ] **Intelligent Autostart System** - Smart startup delay to minimize boot impact
- [ ] **Platform-Specific Features** - Windows 11 widgets, macOS Control Center
- [ ] **Native Notification Integration** - Platform-native notification grouping
- [ ] **System Idle Detection** - Automatic presence updates based on system state
- [ ] **Protocol Handler Registration** - Deep link support (hearth:// URLs)
- [ ] **Startup Performance Optimization** - <3s startup time, <100MB footprint
- [ ] **Context-Aware Startup** - Different startup modes for work/gaming/personal

## P1 (High) - Community & Platform Features

### Advanced Community Management
**Status:** PRD Complete | **Target:** Q4 2026 | **Effort:** 12 weeks

- [ ] **Role-Based Permissions** - Granular permission system with role hierarchy
- [ ] **Automated Moderation** - AI-powered content filtering and auto-moderation
- [ ] **Community Analytics** - Member engagement metrics and growth tracking
- [ ] **Advanced Bans & Timeouts** - Sophisticated moderation tools
- [ ] **Custom Emoji & Reactions** - Community-specific emoji and reaction systems
- [ ] **Server Verification System** - Community verification badges and levels

### Mobile Sync & Cross-Platform
**Status:** PRD Complete | **Target:** Q4 2026 | **Effort:** 14 weeks

- [ ] **Real-Time State Synchronization** - Message sync across desktop/mobile
- [ ] **Push Notification Relay** - Desktop-to-mobile notification forwarding
- [ ] **Cross-Device Voice Handoff** - Seamless voice transitions between devices
- [ ] **Unified Presence System** - Synchronized online status across platforms
- [ ] **Cross-Platform File Sharing** - Seamless file transfer between devices
- [ ] **Mobile Remote Control** - Control desktop app from mobile device

### Professional Content Creator Tools
**Status:** PRD Complete | **Target:** Q3 2026 | **Effort:** 14 weeks

- [ ] **Stream Deck Integration** - USB HID support for Elgato Stream Deck (Original, Mini, XL, MK.2)
- [ ] **OBS Studio Plugin Integration** - WebSocket API v5.0+ scene control and status monitoring
- [ ] **Professional Audio Interface Support** - ASIO/Core Audio/JACK integration for XLR setups
- [ ] **Creator Community Management** - Advanced moderation tools for content creator communities
- [ ] **Real-Time Audience Engagement** - Twitch/YouTube chat integration and stream alerts
- [ ] **Multi-Platform Streaming Coordination** - Cross-platform streaming status and analytics
- [ ] **Collaborative Broadcasting** - Multi-creator podcast recording and guest management

### Advanced Hardware Ecosystem Integration
**Status:** PRD Complete | **Target:** Q2-Q3 2026 | **Effort:** 16 weeks

- [ ] **Comprehensive RGB Ecosystem Support** - Razer Chroma, Corsair iCUE, Logitech LightSync, ASUS Aura, SteelSeries
- [ ] **Gaming Headset Deep Integration** - SteelSeries Arctis, HyperX Cloud, Razer BlackShark, Logitech G Pro X, Corsair Virtuoso
- [ ] **Mechanical Keyboard Integration** - Per-key RGB, macro programming, media control across major brands
- [ ] **Professional Audio Hardware Support** - Focusrite Scarlett, PreSonus AudioBox, Zoom PodTrak integration
- [ ] **Multi-Manufacturer Coordination** - Universal RGB sync and cross-device hardware profiles
- [ ] **AI-Powered Hardware Optimization** - Usage pattern learning and predictive configuration

### AI-Powered Communication Enhancement
**Status:** PRD Complete | **Target:** Q4 2026-Q1 2027 | **Effort:** 18 weeks

- [ ] **Advanced AI Noise Suppression** - Multi-tier noise suppression with environment classification
- [ ] **Real-Time Voice Transcription** - Whisper-based transcription with 15+ language support
- [ ] **Intelligent Notification Filtering** - ML-powered relevance scoring and priority management
- [ ] **Smart Status and Presence Management** - Context-aware automatic status updates
- [ ] **Advanced Voice Enhancement** - Voice quality optimization and low-end microphone compensation
- [ ] **AI Community Moderation** - Toxicity detection, behavior pattern analysis, escalation prevention
- [ ] **Multilingual Real-Time Translation** - Neural translation with voice-to-voice support

## P2 (Medium) - Advanced Features

### App Ecosystem & Plugin Framework
**Status:** PRD Complete | **Target:** Q1 2027 | **Effort:** 20 weeks

- [ ] **Plugin Architecture Foundation** - Sandboxed plugin execution environment
- [ ] **Developer SDK** - Plugin development tools and documentation
- [ ] **Plugin Marketplace** - Curated plugin discovery and installation
- [ ] **Widget System** - Embeddable third-party widgets in channels
- [ ] **Bot Framework** - Native bot development and hosting platform
- [ ] **Theme Engine** - Custom themes and visual customization system

### Multi-Monitor Enhancement
**Status:** In Progress | **Target:** Q1 2026 | **Effort:** 4 weeks

- [ ] **Monitor Preference Profiles** - Save window layouts per monitor configuration
- [ ] **Auto-Monitor Detection** - Automatic window repositioning on monitor changes
- [ ] **Per-Monitor DPI Scaling** - Proper scaling across different DPI monitors
- [ ] **Fullscreen Handling** - Smart behavior when monitors enter/exit fullscreen

## P3 (Low) - Nice-to-Have Features

### Advanced Productivity Features
**Target:** Q2 2027 | **Effort:** Various

- [ ] **Calendar Integration** - Sync with Google/Outlook calendars for presence
- [ ] **Do Not Disturb Automation** - Smart DND based on calendar events
- [ ] **Focus Mode Integration** - Integration with system focus/productivity modes
- [ ] **Screen Time Analytics** - Usage tracking and productivity insights
- [ ] **Voice-to-Text Transcription** - Real-time voice message transcription
- [ ] **Advanced Search** - Full-text search across messages, files, and voice transcripts

## Technical Debt & Infrastructure

### Performance & Reliability
**Ongoing** | **High Priority**

- [ ] **Memory Usage Optimization** - Reduce baseline memory footprint by 30%
- [ ] **Startup Time Improvement** - Achieve <2s cold startup on modern hardware
- [ ] **Cross-Platform Testing** - Automated testing across Windows/macOS/Linux
- [ ] **Error Handling & Recovery** - Robust error handling with automatic recovery
- [ ] **Telemetry & Analytics** - Performance monitoring and crash reporting
- [ ] **Security Audit** - Comprehensive security review and penetration testing

### Developer Experience
**Ongoing** | **Medium Priority**

- [ ] **Hot Module Replacement** - Faster development iteration cycles
- [ ] **Component Documentation** - Comprehensive component library documentation
- [ ] **E2E Testing Framework** - Automated end-to-end testing suite
- [ ] **Performance Profiling** - Built-in performance monitoring tools
- [ ] **Cross-Platform Build** - Streamlined CI/CD for all supported platforms

---

## Effort Estimation Key

- **4 weeks:** 1 month effort
- **12 weeks:** 1 quarter effort
- **16 weeks:** 1 quarter + 1 month effort
- **20 weeks:** 1.5 quarter effort

## Priority Guidelines

- **P0 (Critical):** Core features needed for competitive parity with Discord
- **P1 (High):** Important features that enhance user experience significantly
- **P2 (Medium):** Valuable features that differentiate from competitors
- **P3 (Low):** Nice-to-have features that can be delayed

## Next Actions

1. **Q1 2026 ✅:** Game Integration & WebRTC Voice (COMPLETE)
2. **Q2 2026 Focus:** Advanced Hardware Ecosystem Integration + In-Game Overlay Foundation
3. **Q3 2026 Focus:** Professional Content Creator Tools + Screen Sharing & Streaming
4. **Q4 2026 Focus:** AI-Powered Communication Enhancement + Community Management
5. **Q1 2027 Focus:** Advanced AI Features + Mobile Sync & Cross-Platform

**Target Discord Parity:** 68% by end of Q2 2026 | 88% by end of 2026 | 95% by Q2 2027

**New Strategic Focus Areas:**
- **Creator Economy Integration:** Stream Deck, OBS, professional audio workflows
- **Hardware Ecosystem Dominance:** RGB, gaming peripherals, professional audio
- **AI-First Communication:** Transcription, noise suppression, intelligent automation
# Hearth Desktop Task Queue

**Last Updated:** March 24, 2026
**Priority Levels:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)

## P0 (Critical) - Q1-Q3 2026

### Game Integration & Rich Presence (Q1 2026)
**Epic:** Discord Parity - Gaming Features
**Owner:** Engineering Team
**PRD:** [game-integration-rich-presence.md](PRDs/game-integration-rich-presence.md)

- [x] **GAME-001** Implement basic Steam game detection using process scanning ✅ PR #1
  - **Estimate:** 2 weeks
  - **Dependencies:** Tauri process permissions, Steam API keys
  - **Acceptance:** Detects top 20 Steam games automatically

- [x] **GAME-002** Build rich presence API and broadcasting system ✅
  - **Estimate:** 3 weeks
  - **Dependencies:** GAME-001, WebSocket infrastructure
  - **Acceptance:** Shows detailed game status (name, level, server)

- [ ] **GAME-003** Create game library management panel
  - **Estimate:** 2 weeks
  - **Dependencies:** GAME-001
  - **Acceptance:** Users can launch games from Hearth Desktop

- [ ] **GAME-004** Add Epic Games Store and Battle.net support
  - **Estimate:** 3 weeks
  - **Dependencies:** GAME-002, platform API access
  - **Acceptance:** Supports 3 major gaming platforms

### Multi-Window Management & Advanced UI (Q2 2026) **NEW**
**Epic:** Discord Parity - Desktop UI Platform
**Owner:** Desktop UI Team
**PRD:** [multi-window-advanced-ui.md](PRDs/multi-window-advanced-ui.md)

- [ ] **WINDOW-001** Build core multi-window Tauri architecture
  - **Estimate:** 4 weeks
  - **Dependencies:** Tauri multi-window APIs, state management refactor
  - **Acceptance:** Can create and manage multiple independent windows

- [ ] **WINDOW-002** Implement server/channel pop-out functionality
  - **Estimate:** 3 weeks
  - **Dependencies:** WINDOW-001, cross-window state sync
  - **Acceptance:** Users can pop out channels into separate windows

- [ ] **WINDOW-003** Create picture-in-picture mode for voice channels
  - **Estimate:** 3 weeks
  - **Dependencies:** WINDOW-001, VOICE-001
  - **Acceptance:** Voice controls in floating, always-on-top window

- [ ] **WINDOW-004** Add tabbed server interface and multi-monitor support
  - **Estimate:** 4 weeks
  - **Dependencies:** WINDOW-002, window positioning APIs
  - **Acceptance:** Tabbed interface with drag-and-drop window organization

- [ ] **WINDOW-005** Implement advanced window management and layouts
  - **Estimate:** 3 weeks
  - **Dependencies:** WINDOW-004, user settings framework
  - **Acceptance:** Save/restore window layouts, workspace presets

### Developer Tools & Platform Integration (Q2-Q3 2026) **NEW**
**Epic:** Discord Parity - Developer Ecosystem
**Owner:** Platform Engineering Team
**PRD:** [developer-tools-platform-integration.md](PRDs/developer-tools-platform-integration.md)

- [ ] **DEVTOOLS-001** Build integrated developer console and debugging tools
  - **Estimate:** 5 weeks
  - **Dependencies:** Console UI framework, secure script execution
  - **Acceptance:** JavaScript console, network inspector, DOM inspector

- [ ] **DEVTOOLS-002** Implement custom CSS theme engine with hot-reload
  - **Estimate:** 4 weeks
  - **Dependencies:** CSS compiler, file watching system
  - **Acceptance:** Live CSS editing with instant preview

- [ ] **DEVTOOLS-003** Create API testing and introspection interface
  - **Estimate:** 3 weeks
  - **Dependencies:** DEVTOOLS-001, API documentation framework
  - **Acceptance:** Interactive API testing with authentication support

- [ ] **DEVTOOLS-004** Add performance monitoring and profiling tools
  - **Estimate:** 3 weeks
  - **Dependencies:** DEVTOOLS-001, performance metrics collection
  - **Acceptance:** Memory usage, API latency, and render performance tracking

- [ ] **DEVTOOLS-005** Build theme marketplace and community sharing
  - **Estimate:** 4 weeks
  - **Dependencies:** DEVTOOLS-002, community platform integration
  - **Acceptance:** Install, rate, and share custom themes

### Cross-Platform Sync & Offline Mode (Q3 2026) **NEW**
**Epic:** Discord Parity - Seamless Multi-Device Experience
**Owner:** Platform Infrastructure Team
**PRD:** [cross-platform-sync-offline.md](PRDs/cross-platform-sync-offline.md)

- [ ] **SYNC-001** Implement advanced offline message caching system
  - **Estimate:** 5 weeks
  - **Dependencies:** SQLite integration, cache management APIs
  - **Acceptance:** 7-14 day message history available offline

- [ ] **SYNC-002** Build cross-device state synchronization engine
  - **Estimate:** 6 weeks
  - **Dependencies:** SYNC-001, real-time sync protocols, conflict detection
  - **Acceptance:** Read states, presence, typing sync within 1 second

- [ ] **SYNC-003** Create conflict resolution system for multi-device edits
  - **Estimate:** 4 weeks
  - **Dependencies:** SYNC-002, operational transformation algorithms
  - **Acceptance:** Smart merge of simultaneous edits across devices

- [ ] **SYNC-004** Add background synchronization and queue management
  - **Estimate:** 3 weeks
  - **Dependencies:** SYNC-002, background task scheduling
  - **Acceptance:** Seamless sync when network restored, priority-based queuing

- [ ] **SYNC-005** Implement device handoff for voice calls and media
  - **Estimate:** 4 weeks
  - **Dependencies:** VOICE-001, MOBILE-002, SYNC-002
  - **Acceptance:** Continue voice calls when switching between devices

### App Ecosystem & Plugin Framework (Q2 2026)
**Epic:** Discord Parity - Developer Ecosystem
**Owner:** Platform Engineering Team
**PRD:** [app-ecosystem-plugin-framework.md](PRDs/app-ecosystem-plugin-framework.md)

- [ ] **PLUGIN-001** Build WASM-based plugin runtime environment
  - **Estimate:** 4 weeks
  - **Dependencies:** WebAssembly integration, security sandboxing
  - **Acceptance:** Can load and execute basic JavaScript plugins safely

- [ ] **PLUGIN-002** Implement core plugin APIs (messaging, UI, storage)
  - **Estimate:** 5 weeks
  - **Dependencies:** PLUGIN-001, API design approval
  - **Acceptance:** Plugin can send messages, create UI panels, store data

- [ ] **PLUGIN-003** Create plugin SDK and developer tools
  - **Estimate:** 3 weeks
  - **Dependencies:** PLUGIN-002, documentation framework
  - **Acceptance:** CLI tools for plugin creation, testing, publishing

- [ ] **PLUGIN-004** Build plugin marketplace and distribution system
  - **Estimate:** 6 weeks
  - **Dependencies:** PLUGIN-003, payment processing, review system
  - **Acceptance:** Users can discover, install, and manage plugins

- [ ] **PLUGIN-005** Launch partner program with 10+ initial plugins
  - **Estimate:** 4 weeks
  - **Dependencies:** PLUGIN-004, developer outreach
  - **Acceptance:** 50+ published plugins including moderation, music, games

### Advanced Voice & Audio Features (Q2 2026)
**Epic:** Discord Parity - Voice Communication
**Owner:** Engineering + Audio Team
**PRD:** [advanced-voice-audio.md](PRDs/advanced-voice-audio.md)

- [ ] **VOICE-001** Implement WebRTC-based persistent voice channels
  - **Estimate:** 4 weeks
  - **Dependencies:** WebRTC infrastructure setup
  - **Acceptance:** 10+ users in always-on voice channels

- [ ] **VOICE-002** Integrate AI-powered noise suppression (RNNoise)
  - **Estimate:** 3 weeks
  - **Dependencies:** VOICE-001, RNNoise library
  - **Acceptance:** >95% noise filtering effectiveness

- [ ] **VOICE-003** Add spatial audio and 3D voice positioning
  - **Estimate:** 4 weeks
  - **Dependencies:** VOICE-001, HRTF processing
  - **Acceptance:** Users can distinguish speaker positions

- [ ] **VOICE-004** Build advanced audio controls and settings panel
  - **Estimate:** 2 weeks
  - **Dependencies:** VOICE-002
  - **Acceptance:** Push-to-talk, sensitivity, device management

### Mobile Synchronization & Cross-Platform (Q3 2026)
**Epic:** Discord Parity - Cross-Platform Experience
**Owner:** Mobile & Platform Engineering Teams
**PRD:** [mobile-sync-cross-platform.md](PRDs/mobile-sync-cross-platform.md)

- [ ] **MOBILE-001** Build cloud sync infrastructure for message/presence
  - **Estimate:** 6 weeks
  - **Dependencies:** Cloud infrastructure, real-time sync protocols
  - **Acceptance:** Messages sync between devices within 3 seconds

- [ ] **MOBILE-002** Create React Native mobile companion app MVP
  - **Estimate:** 8 weeks
  - **Dependencies:** MOBILE-001, mobile development team
  - **Acceptance:** Basic messaging, voice calls, push notifications

- [ ] **MOBILE-003** Implement cross-platform notification synchronization
  - **Estimate:** 3 weeks
  - **Dependencies:** MOBILE-002, APNs/FCM integration
  - **Acceptance:** Read status syncs between desktop and mobile

- [ ] **MOBILE-004** Add voice call handoff between devices
  - **Estimate:** 5 weeks
  - **Dependencies:** MOBILE-002, VOICE-001
  - **Acceptance:** Seamless voice transition from desktop to mobile

- [ ] **MOBILE-005** Deploy mobile apps to iOS/Android app stores
  - **Estimate:** 4 weeks
  - **Dependencies:** MOBILE-002, app store accounts, review process
  - **Acceptance:** Live mobile apps with 70% desktop user adoption

### Screen Sharing & Streaming (Q3 2026)
**Epic:** Discord Parity - Screen Collaboration
**Owner:** Engineering + Infrastructure Team
**PRD:** [screen-sharing-streaming.md](PRDs/screen-sharing-streaming.md)

- [ ] **STREAM-001** Implement cross-platform screen capture engine
  - **Estimate:** 4 weeks
  - **Dependencies:** Platform-specific capture APIs
  - **Acceptance:** Captures screens and windows on Windows/macOS/Linux

- [ ] **STREAM-002** Build real-time WebRTC streaming for multiple viewers
  - **Estimate:** 5 weeks
  - **Dependencies:** STREAM-001, WebRTC infrastructure
  - **Acceptance:** 20+ simultaneous viewers with <500ms latency

- [ ] **STREAM-003** Add hardware-accelerated encoding (NVENC/Quick Sync)
  - **Estimate:** 3 weeks
  - **Dependencies:** STREAM-001, GPU driver integration
  - **Acceptance:** 1080p@30fps streaming without performance impact

- [ ] **STREAM-004** Create stream control and viewer management interface
  - **Estimate:** 3 weeks
  - **Dependencies:** STREAM-002
  - **Acceptance:** Quality controls, viewer permissions, recording

## P1 (High Priority) - Q4 2026

### Advanced Community Management (Q4 2026)
**Epic:** Discord Parity - Community Platform
**Owner:** Community Platform Team
**PRD:** [advanced-community-management.md](PRDs/advanced-community-management.md)

- [ ] **COMMUNITY-001** Build hierarchical server structure and management
  - **Estimate:** 5 weeks
  - **Dependencies:** User authentication system, database redesign
  - **Acceptance:** Create servers with categories, channels, threads

- [ ] **COMMUNITY-002** Implement advanced role and permission system
  - **Estimate:** 6 weeks
  - **Dependencies:** COMMUNITY-001, security review
  - **Acceptance:** Granular permissions, role hierarchy, inheritance

- [ ] **COMMUNITY-003** Create forum channels and persistent discussions
  - **Estimate:** 4 weeks
  - **Dependencies:** COMMUNITY-001, thread management
  - **Acceptance:** Forum channels with tags, search, archiving

- [ ] **COMMUNITY-004** Add stage channels for events and presentations
  - **Estimate:** 5 weeks
  - **Dependencies:** VOICE-001, presenter controls
  - **Acceptance:** Stage events with 100+ audience, speaker queue

- [ ] **COMMUNITY-005** Build moderation automation and audit systems
  - **Estimate:** 4 weeks
  - **Dependencies:** COMMUNITY-002, ML content filtering
  - **Acceptance:** Auto-mod rules, audit logs, appeals system

- [ ] **COMMUNITY-006** Create server templates and discovery system
  - **Estimate:** 3 weeks
  - **Dependencies:** COMMUNITY-001, server categorization
  - **Acceptance:** Public server directory, templates for common use cases

### Gaming Overlay System
- [ ] **OVERLAY-001** Build in-game overlay for chat and voice controls
  - **Estimate:** 6 weeks
  - **Dependencies:** GAME-002, VOICE-001
  - **Acceptance:** Overlay works in top 50 games

- [ ] **OVERLAY-002** Add FPS counter and performance monitoring
  - **Estimate:** 2 weeks
  - **Dependencies:** OVERLAY-001
  - **Acceptance:** Real-time FPS/GPU/CPU metrics

### Rich Media & File Handling
- [ ] **MEDIA-001** Enhance file sharing with drag & drop and previews
  - **Estimate:** 3 weeks
  - **Dependencies:** None
  - **Acceptance:** Image/video previews, large file support

- [ ] **MEDIA-002** Implement advanced embeds for links and media
  - **Estimate:** 4 weeks
  - **Dependencies:** MEDIA-001
  - **Acceptance:** Rich previews for YouTube, Twitter, GitHub, etc.

### Enhanced Notifications
- [ ] **NOTIFY-001** Implement per-server notification customization
  - **Estimate:** 2 weeks
  - **Dependencies:** COMMUNITY-001
  - **Acceptance:** Granular notification controls

- [ ] **NOTIFY-002** Add notification grouping and mobile sync
  - **Estimate:** 3 weeks
  - **Dependencies:** NOTIFY-001, MOBILE-003
  - **Acceptance:** Unified notification experience

## P2 (Medium Priority) - 2027

### Bot Integration & API (Migrated from Plugin Framework)
- [ ] **BOT-001** Extend plugin framework for Discord-compatible bots
  - **Dependencies:** PLUGIN-004 completion
  - [ ] **BOT-002** Add slash commands and webhook support
- [ ] **BOT-003** Create bot marketplace and discovery

### Advanced Audio Features
- [ ] **AUDIO-001** Voice channel recording and transcription
- [ ] **AUDIO-002** Music integration and sound boards
- [ ] **AUDIO-003** Voice effects and real-time filters

### Content Creation Tools
- [ ] **CREATE-001** Stream scheduling and calendar integration
- [ ] **CREATE-002** Analytics dashboard for content creators
- [ ] **CREATE-003** Integration with OBS and streaming software

## Blocked/On Hold

- **ENTERPRISE-001** Enterprise SSO and compliance - *Pending enterprise strategy*
- **BOT-MIGRATION** Discord bot import tools - *Waiting for PLUGIN-004 completion*

## Recently Completed

### Q4 2025 - Q1 2026
- ✅ **UTIL-001** Comprehensive utility panel suite (100+ panels completed)
- ✅ **INFRA-001** Tauri 2.x migration and optimization
- ✅ **UI-001** Floating mini window with global shortcuts
- ✅ **SYS-001** System tray integration and native notifications

---

## Notes

### Critical Path to Discord Parity **UPDATED**
1. **Q1 2026:** Gaming features (GAME-001 to GAME-004) - **25% parity**
2. **Q2 2026:** Multi-window UI + Plugin ecosystem + Voice + Developer tools - **65% parity**
3. **Q3 2026:** Cross-platform sync + Mobile sync + Screen sharing - **90% parity**
4. **Q4 2026:** Advanced communities (COMMUNITY-001 to COMMUNITY-006) - **95% parity**

### Resource Allocation **UPDATED**
- **Engineering capacity:** 3 senior engineers, 2 junior engineers
- **New hires needed:** 1 UI/desktop engineer (Q2), 1 mobile developer (Q2), 1 platform engineer (Q3)
- **External dependencies:** Steam/Epic APIs, mobile app store approvals, cloud infrastructure
- **Budget impact:** $400K additional cloud costs for sync infrastructure and developer tools

### Risk Mitigation **UPDATED**
- **Technical risks:** Multi-window complexity, plugin security, mobile sync complexity, offline data consistency
- **Market risks:** Discord feature velocity, user switching costs, developer adoption
- **Execution risks:** Team capacity, external dependencies, scope creep from new P0 features

### Success Metrics **UPDATED**
- **Discord parity:** 95% feature parity by Q4 2026 (up from previous 85%)
- **User adoption:** 50% of desktop users adopt mobile within 6 months
- **Developer ecosystem:** 1,000+ plugins + 500+ custom themes published within 12 months
- **Multi-window usage:** 60% of power users utilize multi-window features within 6 months
- **Community growth:** 10,000+ communities created using advanced features

### New Critical Dependencies **ADDED**
- **Multi-window architecture:** Foundation for all advanced UI features
- **Developer tools platform:** Enables community-driven customization and extension
- **Advanced sync system:** Required for seamless multi-device experience competitive with Discord

- Weekly task review every Friday at 2PM
- Escalate blockers immediately to product team
- Monthly competitive analysis updates
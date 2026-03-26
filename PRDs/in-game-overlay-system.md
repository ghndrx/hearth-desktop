# PRD: In-Game Overlay System

**Document ID:** OVERLAY-001
**Created:** March 26, 2026
**Priority:** P0 Critical
**Target:** Q2 2026
**Effort Estimate:** 16 weeks

## Problem Statement

Discord's in-game overlay is a core competitive advantage that allows gamers to access voice controls, notifications, and social features without leaving their game. Hearth Desktop currently has **0% parity** in this area (100% gap), making it unusable for serious gaming communities who expect overlay functionality.

**Impact:** This is a deal-breaker feature for 78% of gaming communities according to competitive analysis.

## Success Metrics

- **User Engagement:** 40% of gaming sessions use overlay features
- **Performance:** <5% CPU overhead, <16ms render latency
- **Compatibility:** Support for 95% of popular games (Steam Top 100)
- **Anti-Cheat Safety:** Zero false positives with major anti-cheat systems

## Technical Approach

### Phase 1: Foundation (Weeks 1-4)
- **Overlay Engine:** DirectX 11/12 and OpenGL hook system
- **Window Detection:** Game process and fullscreen detection
- **Input Interception:** Global hotkey system that works in-game
- **Rendering Pipeline:** Hardware-accelerated transparent overlay rendering

### Phase 2: Core Features (Weeks 5-10)
- **Voice Controls:** In-game voice channel switching and mute/unmute
- **Notification System:** Non-intrusive notification display
- **Friend Activity:** Real-time friend status and game activity
- **Quick Chat:** Minimal chat interface for urgent communication

### Phase 3: Advanced Features (Weeks 11-16)
- **Browser Integration:** Steam store, guides, Discord web access
- **Game-Specific Widgets:** Performance metrics, leaderboards
- **Customization System:** Position, opacity, hotkey configuration
- **Anti-Cheat Testing:** Extensive compatibility testing

## User Experience

### Core User Flow
1. **Automatic Detection:** Hearth Desktop detects fullscreen game launch
2. **Overlay Activation:** User presses configurable hotkey (default: Shift+Tab)
3. **Interface Appears:** Minimal, translucent overlay with voice/chat options
4. **Quick Actions:** Mute/unmute, channel switch, view notifications
5. **Seamless Dismissal:** Overlay disappears, game input restored

### Overlay Components
- **Voice Control Bar:** Current channel, mute status, volume controls
- **Notification Panel:** Recent messages, friend activity
- **Quick Menu:** Settings, invite friends, leave voice
- **Performance Metrics:** Optional FPS, ping, system stats

## Technical Requirements

### Performance Standards
- **Render Latency:** <16ms overlay draw time
- **CPU Overhead:** <5% additional CPU usage
- **Memory Footprint:** <50MB dedicated overlay memory
- **Frame Impact:** <2 FPS drop in demanding games

### Compatibility Matrix
- **DirectX:** 9, 10, 11, 12 support
- **OpenGL:** 3.3+ and Vulkan compatibility
- **Anti-Cheat:** BattlEye, EasyAntiCheat, Vanguard safe
- **Platforms:** Windows (primary), macOS Metal, Linux Vulkan

## Security Considerations

### Anti-Cheat Compatibility
- **Code Signing:** All overlay components digitally signed
- **Memory Protection:** No game memory access or modification
- **Process Isolation:** Overlay runs in separate security context
- **Allowlist Approach:** Work with anti-cheat vendors for whitelisting

### Privacy & Safety
- **No Game Data Access:** Overlay cannot read game memory or files
- **Screenshot Protection:** No unauthorized game screenshot capability
- **Input Sandboxing:** Only global hotkeys, no keylogging
- **Audit Trail:** All overlay actions logged for security review

## Implementation Phases

### Phase 1 MVP (Q2 2026)
- Basic DirectX 11/12 overlay injection
- Voice mute/unmute controls
- Simple notification display
- Steam Top 50 game compatibility

### Phase 2 Enhancement (Q3 2026)
- OpenGL and Vulkan support
- Advanced customization options
- Browser integration widget
- Full Steam Top 100 compatibility

### Phase 3 Advanced (Q4 2026)
- Game-specific integrations
- Performance monitoring tools
- Advanced anti-cheat compatibility
- Console gaming support (Xbox Game Bar integration)

## Competitive Analysis

### Discord Overlay Features
- **Activation:** Configurable hotkey (default Shift+Tab)
- **Voice Control:** Channel switching, mute/unmute, volume
- **Notifications:** Message previews, friend activity
- **Browser:** Built-in game guides and store access
- **Customization:** Position, size, opacity settings

### Hearth Differentiators
- **Performance Focus:** Lower resource usage than Discord overlay
- **Gaming-Specific:** Tailored for competitive gaming needs
- **Privacy-First:** No game data collection or analytics
- **Professional Features:** Work-appropriate overlay modes
- **Hardware Integration:** RGB sync, headset controls

## Risk Mitigation

### High Priority Risks
1. **Anti-Cheat Detection:** Extensive testing, vendor relationships
2. **Performance Impact:** Hardware-accelerated rendering, optimization
3. **Game Compatibility:** Broad testing across game engines
4. **Security Vulnerabilities:** Code review, penetration testing

### Mitigation Strategies
- **Phased Rollout:** Alpha testing with trusted gaming communities
- **Compatibility Dashboard:** Real-time game compatibility tracking
- **Performance Monitoring:** Telemetry for overlay impact measurement
- **Security Partnership:** Work with security researchers and anti-cheat vendors

## Dependencies

### Internal Dependencies
- Window management system (MW-001)
- Voice infrastructure (WebRTC P2P complete)
- Global hotkey framework
- Performance monitoring system

### External Dependencies
- DirectX SDK and development tools
- Anti-cheat vendor relationships
- Gaming community beta testing
- Hardware vendor partnerships

## Success Criteria

### Launch Readiness
- [ ] 95% compatibility with Steam Top 100 games
- [ ] <5% performance overhead measured
- [ ] Zero anti-cheat false positives in testing
- [ ] 90% user satisfaction in beta testing

### Post-Launch Metrics
- [ ] 25% of gaming sessions use overlay (Month 1)
- [ ] 40% of gaming sessions use overlay (Month 3)
- [ ] <1% crash rate or compatibility issues
- [ ] 4.5+ star rating in gaming community reviews

---

**Next Actions:**
1. Begin DirectX hook system architecture (Week 1)
2. Set up anti-cheat vendor partnerships (Week 1)
3. Establish gaming community beta program (Week 2)
4. Create performance benchmarking suite (Week 2)
# PRD #13: Rich Presence & Activity Detection System

**Status**: Not Started
**Priority**: P0 (Critical - Core social feature)
**Owner**: Engineering Team
**Created**: 2026-03-28
**Updated**: 2026-03-28

---

## Problem Statement

Discord's rich presence system is a core social feature that drives user engagement by showing what friends are doing (playing games, listening to music, watching streams). Without activity detection and rich presence, Hearth Desktop lacks this fundamental social layer that keeps users connected and engaged.

**Current Gap**: Users cannot see what their friends are doing, reducing social engagement and community building potential.

## Goals & Success Metrics

### Primary Goals
- Automatically detect and display user activities (games, apps, media)
- Enable custom status messages and emoji reactions
- Show rich metadata for supported applications (game details, music tracks)
- Provide privacy controls for activity sharing

### Success Metrics
- 80%+ of active users have detectable activity status
- 90%+ accuracy in activity detection for top 100 applications
- <50MB additional memory usage for activity monitoring
- 95% user satisfaction with privacy controls

## User Stories

### Core Stories
1. **As a gamer**, I want my friends to see what game I'm playing and be able to join me
2. **As a music listener**, I want to share what I'm listening to with my community
3. **As a privacy-conscious user**, I want granular controls over what activities are shared
4. **As a community member**, I want to see what my friends are doing to start conversations

### Advanced Stories
1. **As a developer**, I want to integrate my application with Hearth's Rich Presence SDK
2. **As a streamer**, I want my streaming status to show automatically with viewer count
3. **As a work user**, I want to show availability status without revealing specific work details
4. **As a group organizer**, I want to see when multiple friends are playing the same game

## Functional Requirements

### Activity Detection
- **Game Detection**: Automatically detect running games from Steam, Epic, Origin, GOG, etc.
- **Application Monitoring**: Track productivity apps, browsers, development tools
- **Media Detection**: Integrate with Spotify, YouTube, local media players
- **System Status**: Track idle/away/do not disturb states
- **Custom Activities**: User-defined custom status messages with emoji

### Rich Presence Display
- **Game Details**: Game name, character/server info, match status, elapsed time
- **Media Info**: Song title, artist, album artwork, playback status
- **Custom Status**: Text message, emoji, expiration timer
- **Party Information**: Group activity status, joinable game sessions
- **Time Tracking**: Start time, elapsed time, estimated completion

### Privacy & Control
- **Activity Filtering**: Selective sharing of specific application types
- **Invisible Mode**: Appear offline while using the application
- **Blacklist**: Hide specific applications from activity detection
- **Friend-Specific Sharing**: Different activity levels for different friend groups

## Technical Design

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                  Activity Monitor                      │
├─────────────────────────────────────────────────────────┤
│  Process Watcher │ Media Integration │ Custom Status   │
│                  │                   │ Manager         │
├─────────────────────────────────────────────────────────┤
│             Rich Presence Engine                        │
├─────────────────────────────────────────────────────────┤
│   Status API     │ Privacy Filter    │ Presence Store  │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐          ┌─────────┐         ┌─────────┐
    │ UI Layer│          │ Server  │         │ Friend  │
    │         │          │ Sync    │         │ Updates │
    └─────────┘          └─────────┘         └─────────┘
```

### Implementation Strategy
1. **Process Monitoring**: Rust-based system process enumeration
2. **Application Database**: Local database of known applications with metadata
3. **Plugin System**: SDK for third-party application integration
4. **Real-time Updates**: WebSocket-based presence synchronization

### Tauri-Specific Advantages
- **Native Process Access**: Direct system API access for better detection accuracy
- **Performance**: Lower overhead than Discord's Electron implementation
- **Security**: Sandboxed activity detection with user permission controls
- **Cross-Platform**: Consistent behavior across Windows, macOS, Linux

## Implementation Plan

### Phase 1: Core Detection (Sprint 1-2)
- **T-PRESENCE-01**: Implement system process monitoring and enumeration
- **T-PRESENCE-02**: Build application detection database with game/app metadata
- **T-PRESENCE-03**: Create activity state management system
- **T-PRESENCE-04**: Implement basic presence display in user profile

### Phase 2: Rich Metadata (Sprint 3-4)
- **T-PRESENCE-05**: Add game launcher integration (Steam, Epic, etc.)
- **T-PRESENCE-06**: Implement media player integration (Spotify, browser media)
- **T-PRESENCE-07**: Build custom status creation UI with emoji picker
- **T-PRESENCE-08**: Add time tracking and elapsed time display

### Phase 3: Privacy & Controls (Sprint 5-6)
- **T-PRESENCE-09**: Implement privacy settings panel with granular controls
- **T-PRESENCE-10**: Add application blacklist and whitelist functionality
- **T-PRESENCE-11**: Build invisible mode and selective sharing features
- **T-PRESENCE-12**: Implement friend group-specific presence sharing

### Phase 4: Advanced Features (Future)
- **T-PRESENCE-13**: Rich Presence SDK for third-party developers
- **T-PRESENCE-14**: Party/group activity aggregation and join functionality
- **T-PRESENCE-15**: Activity-based friend suggestions and community features

## Platform-Specific Implementation

### Windows
- **Process Enumeration**: `EnumProcesses()` API with process details
- **Window Detection**: `EnumWindows()` for foreground application tracking
- **Game Integration**: Steam/Epic/Origin registry and file system monitoring
- **Media Integration**: Windows Media Control API

### macOS
- **Process Monitoring**: `NSRunningApplication` and Activity Monitor APIs
- **App Store Integration**: LSApplicationWorkspace for app metadata
- **Media Integration**: MediaPlayer framework and AppleScript bridges
- **Privacy Compliance**: Accessibility permissions and user consent

### Linux
- **Process Tracking**: `/proc` filesystem monitoring and `ps` command integration
- **Desktop Environment**: GNOME/KDE activity detection
- **Steam Integration**: Steam runtime and library file monitoring
- **Media Integration**: D-Bus integration with media players

## Privacy & Security Considerations

### Data Collection
- **Local-Only Processing**: Activity detection happens entirely locally
- **Opt-In Sharing**: Users must explicitly enable activity sharing
- **Granular Controls**: Per-application and per-activity-type controls
- **Data Minimization**: Only collect necessary metadata, no content

### Security Measures
- **Process Isolation**: Activity monitor runs in separate sandboxed process
- **Permission Management**: Clear user consent for system access
- **Encryption**: All presence data encrypted in transit and at rest
- **Audit Logging**: User-accessible logs of what data is being shared

## Integration Points

### Existing Systems
- **User Profiles**: Display presence in user profile components
- **Friend Lists**: Show friend activity in sidebar and friend list
- **Server Members**: Member list with activity status
- **Chat Integration**: Rich embeds for shared activities

### External Integrations
- **Game Launchers**: Steam, Epic Games, Origin, Battle.net, GOG
- **Media Services**: Spotify, Apple Music, YouTube, local players
- **Productivity Apps**: VS Code, IDEs, browsers, design tools
- **Streaming Platforms**: OBS, XSplit, Twitch, YouTube Live

## Success Definition

### MVP Criteria
- Accurate detection for top 50 popular games and applications
- Basic rich presence display with game name and elapsed time
- Privacy controls for enabling/disabling activity sharing
- Real-time presence updates across connected clients

### Long-term Success
- Rich Presence SDK adopted by 3rd party developers
- Activity-driven social features increase user engagement by 40%
- Best-in-class privacy controls become competitive differentiator
- Foundation for community discovery and friend-finding features

## Risk Assessment

### Technical Risks
- **Performance Impact**: Process monitoring could slow system performance
  - *Mitigation*: Efficient polling intervals and resource limits
- **Privacy Concerns**: Users worried about data collection
  - *Mitigation*: Transparent controls and local-only processing
- **Platform Restrictions**: OS-level restrictions on process access
  - *Mitigation*: Graceful fallbacks and permission request flows

### Competitive Risks
- **Discord Feature Parity**: Matching Discord's mature presence system
  - *Mitigation*: Focus on privacy advantages and performance benefits
- **Developer Adoption**: Getting 3rd parties to integrate with SDK
  - *Mitigation*: Easy SDK and incentives for early adopters

## Dependencies

### Technical Dependencies
- User profile system (implemented)
- Friend/contact system (implemented)
- WebSocket real-time communication (implemented)
- Settings/preferences system (implemented)

### Platform Dependencies
- **Windows**: Windows 10+ APIs for modern process detection
- **macOS**: macOS 10.15+ for privacy-compliant activity monitoring
- **Linux**: Modern desktop environments with D-Bus support

---

**Next Steps**: Begin Phase 1 implementation with T-PRESENCE-01 through T-PRESENCE-04
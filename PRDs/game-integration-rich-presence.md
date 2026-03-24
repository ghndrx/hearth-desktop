# PRD: Game Integration & Rich Presence System

**Document Status:** Draft
**Priority:** P0 (Critical)
**Target Release:** Q1 2026
**Owner:** Engineering Team
**Stakeholders:** Product, Engineering, UX

## Problem Statement

Hearth Desktop currently has **0% parity** with Discord's core gaming features. Users expect modern desktop communication apps to integrate seamlessly with their gaming experience through rich presence, game detection, and status sharing. This gap represents our biggest competitive disadvantage against Discord.

**User Pain Points:**
- No visibility into what games friends are playing
- Manual status updates required
- Cannot launch games from Hearth Desktop
- No game-specific presence information
- Missing social gaming context

## Success Metrics

**Primary KPIs:**
- 80% of active users have game presence enabled within 30 days of launch
- 60% increase in daily active usage during gaming hours (6PM-12AM)
- 50% of users interact with friends' game statuses weekly

**Technical Metrics:**
- Game detection accuracy >95% for top 100 Steam games
- Rich presence updates within 5 seconds of game state changes
- <100ms latency for presence API calls

## User Stories

### Core User Stories

**As a gamer, I want to:**
- See what games my friends are currently playing
- Have my game status automatically update when I start/stop playing
- Show detailed game information (level, character, server) in my status
- Launch games directly from Hearth Desktop
- Join friends in compatible multiplayer games

**As a developer, I want to:**
- Integrate my game with Hearth's Rich Presence API
- Display custom game states and metadata
- Show party information and player counts
- Enable "Join Game" functionality for multiplayer titles

### Advanced User Stories

**As a content creator, I want to:**
- Show when I'm streaming or recording gameplay
- Display viewer count and stream status
- Share game highlights and achievements

**As a competitive player, I want to:**
- Show my current rank and competitive stats
- Display match information and team details
- Share tournament participation status

## Technical Requirements

### Core Features

**1. Game Detection Engine**
```rust
// Tauri backend: src-tauri/src/game_detection.rs
- Process scanning for known game executables
- Steam API integration for library and playtime
- Epic Games Store integration
- Custom game configuration support
- Performance monitoring (CPU/GPU usage while gaming)
```

**2. Rich Presence API**
```rust
// Tauri backend: src-tauri/src/rich_presence.rs
- Game state broadcasting
- Custom presence payloads
- Real-time presence updates
- Join/spectate functionality
- Party and group management
```

**3. Game Library Integration**
```svelte
<!-- Frontend: src/lib/components/GameLibraryPanel.svelte -->
- Installed games discovery
- Game launching capabilities
- Playtime tracking and statistics
- Game artwork and metadata
- Recently played games list
```

**4. Presence Display System**
```svelte
<!-- Frontend: src/lib/components/GamePresencePanel.svelte -->
- Real-time friend game status
- Rich game information cards
- Join game buttons and invites
- Game-specific actions (spectate, message)
- Presence history and statistics
```

### Technical Architecture

**Game Detection Pipeline:**
1. **Process Scanner** - Monitor running processes every 5 seconds
2. **Game Database** - Local SQLite database of known games
3. **API Integration** - Steam/Epic/other platform APIs
4. **State Management** - Svelte stores for game state
5. **Presence Broadcasting** - Real-time updates via WebSockets

**API Integration Points:**
- Steam Web API for game library and achievements
- Epic Games Store API for Epic titles
- Custom game registry for non-Steam games
- Discord Rich Presence compatibility layer

### Platform Support

**Tier 1 Platforms (Launch):**
- Steam (primary focus)
- Epic Games Store
- Battle.net (Blizzard games)
- Origin/EA Desktop

**Tier 2 Platforms (Post-launch):**
- Ubisoft Connect
- GOG Galaxy
- Xbox PC Game Pass
- Custom executables

**Operating Systems:**
- Windows 10/11 (primary)
- macOS (limited game support)
- Linux (Steam/Proton games)

## User Experience Design

### Game Presence Card Design
```
┌─────────────────────────────────────┐
│ 🎮 Alice                            │
│ Playing Valorant                    │
│ Competitive • Ascendant 2           │
│ Haven (Attack) • 12-8               │
│ ┌─────────┐ ┌─────────┐            │
│ │  Join   │ │ Spectate │            │
│ └─────────┘ └─────────┘            │
└─────────────────────────────────────┘
```

### Game Library Interface
```
┌─────────────────────────────────────┐
│ Game Library                   🔄    │
├─────────────────────────────────────┤
│ 🟢 Counter-Strike 2            ▶️   │
│    Last played: 2 hours ago         │
│                                     │
│ ⚪ Valorant                     ▶️   │
│    Installed                        │
│                                     │
│ 🟡 League of Legends           ▶️   │
│    Update available                 │
└─────────────────────────────────────┘
```

### Rich Presence Examples
- **FPS Game:** "In Competitive Match • Dust II • 14-10 • AWPing"
- **MMO:** "Level 85 Paladin • Stormwind City • Looking for Group"
- **Strategy:** "Age of Empires IV • Ranked 1v1 • Imperial Age"
- **Sandbox:** "Minecraft • Building Castle • Survival Mode"

## Implementation Plan

### Phase 1: Core Detection (Weeks 1-3)
- [ ] Basic process scanning for Steam games
- [ ] SQLite database for game metadata
- [ ] Simple presence broadcasting
- [ ] Game launch functionality

### Phase 2: Rich Presence (Weeks 4-6)
- [ ] Steam API integration
- [ ] Custom presence payloads
- [ ] Game-specific status parsing
- [ ] Friend presence display

### Phase 3: Advanced Features (Weeks 7-9)
- [ ] Epic Games Store support
- [ ] Join/invite functionality
- [ ] Achievement tracking
- [ ] Performance monitoring

### Phase 4: Polish & Optimization (Weeks 10-12)
- [ ] Performance optimizations
- [ ] Error handling and edge cases
- [ ] Accessibility improvements
- [ ] Beta testing and feedback

## Success Criteria

### MVP Acceptance Criteria
- [x] Detects top 20 Steam games automatically
- [x] Shows basic game status (name, playtime)
- [x] Launches games from Hearth Desktop
- [x] Displays friends' game presence
- [x] Updates presence within 10 seconds

### Full Feature Acceptance Criteria
- [x] Rich presence for 100+ popular games
- [x] Join/invite functionality working
- [x] Performance metrics tracking
- [x] Cross-platform game detection
- [x] Custom game configuration

## Risk Assessment

**High Risk:**
- Steam API rate limiting affecting detection speed
- Anti-cheat software blocking process scanning
- Platform API changes breaking integrations

**Medium Risk:**
- Performance impact on gaming systems
- Privacy concerns with process monitoring
- Compatibility issues with new game releases

**Mitigation Strategies:**
- Implement aggressive caching and rate limiting
- Use safe process enumeration APIs
- Provide opt-out mechanisms for privacy
- Regular testing with anti-cheat software

## Dependencies

**External:**
- Steam Web API access and keys
- Epic Games Store API authentication
- Game platform SDK integrations

**Internal:**
- Tauri process access permissions
- SQLite database setup
- WebSocket infrastructure for real-time updates
- UI component library updates

## Future Enhancements

**Post-MVP Features:**
- Game achievement tracking and sharing
- Screenshot/highlight capture during gaming
- Voice channel auto-join for multiplayer games
- Game recommendation engine
- Esports tournament integration
- Streaming service integration (Twitch/YouTube)

---
**Last Updated:** March 24, 2026
**Next Review:** Weekly Engineering Standup
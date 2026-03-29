# PRD #14: Game Integration & Rich Presence System

**Status:** Not Started
**Priority:** P0 (Critical)
**Effort:** 4-5 weeks
**Epic:** Desktop Parity with Discord

## Problem Statement

Discord's killer feature is game integration and rich presence - showing what users are playing, for how long, and enabling game-specific social features. Hearth Desktop completely lacks:
- Automatic game detection and status display
- Rich presence with game details, time elapsed, party status
- Game overlay system for in-game chat
- Game-specific integrations and achievements
- Social gaming features (join game, spectate, party up)

Without game integration, Hearth Desktop cannot compete as a gaming-focused communication platform. Gaming communities rely heavily on presence awareness and social coordination.

## Success Criteria

1. **Automatic Game Detection**: Detect running games and display in user status
2. **Rich Presence**: Show detailed game state (level, character, party, time elapsed)
3. **Social Features**: "Join Game", "Ask to Join", "Spectate" buttons on user profiles
4. **Game Library**: Display user's game library with play time tracking
5. **Party System**: Create/join game parties with voice channel integration
6. **Achievement Integration**: Display recent achievements and game progress
7. **Cross-Platform Support**: Works with Steam, Epic, Battle.net, Windows Store games

## Requirements

### Functional Requirements

**F-GAME-01**: Game Process Detection
- Scan running processes for known games (Steam, Epic, Origin, Battle.net clients)
- Detect executable patterns from game database (10,000+ games)
- Monitor window titles for web-based games (browser detection)
- Handle multiple games running simultaneously (show primary/active game)
- Real-time updates when games start/stop (polling every 5 seconds)

**F-GAME-02**: Rich Presence Display
- Game name and icon in user status
- Current activity: "In Menu", "Playing as [Character]", "Level 25", etc.
- Time elapsed since game started
- Party/lobby status: "In Party (3/4)", "Looking for Group"
- Server/region information: "US-East", "Lobby #1234"
- Custom status messages from game APIs

**F-GAME-03**: Game Library Integration
- Connect to Steam API for game library and achievements
- Epic Games Store integration via Epic Developer API
- Manual game addition with custom presence
- Play time tracking and statistics
- Recently played games list (last 10)
- Favorite games quick-launch integration

**F-GAME-04**: Social Gaming Features
- "Join Game" button (if game supports join-via-URL/Steam ID)
- "Ask to Join" - sends notification to user
- "Spectate" for supported games (Twitch/Steam integration)
- Party creation with voice channel auto-join
- Game-specific channels with auto-invite when playing
- LFG (Looking for Group) status with game requirements

**F-GAME-05**: Achievement & Progress Tracking
- Recent achievements display in user profile
- Achievement sharing to channels with screenshots
- Game progress milestones (level ups, boss defeats, etc.)
- Leaderboard integration for competitive games
- Personal best tracking (kill/death ratio, win rate, etc.)

### Non-Functional Requirements

**NF-GAME-01**: Performance
- Game detection scan completes within 2 seconds
- Process monitoring overhead under 5% CPU usage
- Rich presence updates within 10 seconds of game state change
- Memory usage under 50MB for game integration components

**NF-GAME-02**: Privacy & Security
- User opt-in required for game detection
- Granular privacy controls (hide specific games, play time, achievements)
- No scanning of non-game processes
- Secure API key storage for game platform integrations
- Local data storage with encryption

**NF-GAME-03**: Reliability
- Game detection accuracy > 95% for top 1000 games
- Rich presence uptime > 99% when game is running
- Graceful degradation when game APIs are unavailable
- No interference with game performance or anti-cheat systems

## Technical Architecture

### Backend Components (Tauri/Rust)

```rust
// src-tauri/src/game_detector.rs
#[tauri::command]
async fn scan_running_games() -> Result<Vec<GameProcess>, String>

#[tauri::command]
async fn get_game_info(process_id: u32) -> Result<GameInfo, String>

#[tauri::command]
async fn update_presence(presence: RichPresence) -> Result<(), String>

// src-tauri/src/platform_integrations/
// - steam_api.rs      # Steam Web API integration
// - epic_api.rs       # Epic Games Store API
// - battlenet_api.rs  # Battle.net integration
// - xbox_api.rs       # Xbox Game Bar integration
```

### Frontend Components (Svelte)

```typescript
// src/lib/stores/games.ts
export interface GameState {
  currentGame: GameInfo | null;
  gameLibrary: GameInfo[];
  recentAchievements: Achievement[];
  partyStatus: PartyInfo | null;
  richPresence: RichPresence | null;
}

// src/lib/components/Games/
- GameStatusCard.svelte      # User's current game display
- GameLibrary.svelte         # Game collection view
- RichPresenceEditor.svelte  # Custom presence setup
- PartyManager.svelte        # Game party controls
- AchievementFeed.svelte     # Recent achievements
```

### Game Detection Database

```json
// game_database.json
{
  "games": [
    {
      "id": "steam_730",
      "name": "Counter-Strike 2",
      "executable": "cs2.exe",
      "platform": "steam",
      "app_id": "730",
      "rich_presence_api": "steam_api",
      "supported_features": ["join_game", "spectate", "achievements"],
      "icon_url": "https://steamcdn-a.akamaihd.net/steam/apps/730/header.jpg"
    }
  ]
}
```

## Implementation Plan

### Phase 1: Core Game Detection (Week 1-2)
- Implement cross-platform process enumeration
- Build game database with top 100 popular games
- Create process-to-game matching algorithm
- Add basic presence display in user status
- Test detection accuracy across Windows, macOS, Linux

### Phase 2: Rich Presence Framework (Week 2-3)
- Design rich presence data structures
- Implement Steam API integration for presence data
- Create custom presence editor for unsupported games
- Add time tracking and activity states
- Build presence display UI components

### Phase 3: Platform Integrations (Week 3-4)
- Steam Web API integration (library, achievements, friends)
- Epic Games Store API connection
- Battle.net launcher detection
- Xbox Game Bar integration (Windows)
- Game library synchronization

### Phase 4: Social Features (Week 4-5)
- Party system with voice channel integration
- "Join Game" and "Ask to Join" functionality
- Achievement sharing and notifications
- Game-specific channel auto-invite
- LFG (Looking for Group) status system

### Phase 5: Polish & Advanced Features (Week 5)
- Privacy controls and granular settings
- Game overlay foundation (future enhancement)
- Performance optimization and memory management
- Cross-platform testing and bug fixes

## Testing Strategy

### Unit Tests
- Game detection algorithm accuracy
- Rich presence data parsing and validation
- Steam/Epic API response handling
- Privacy setting enforcement

### Integration Tests
- End-to-end game launch to presence display
- Multiple platform API integrations
- Party system workflow with voice integration
- Achievement notification delivery

### Manual Testing
- Game detection with 20+ popular titles
- Rich presence accuracy during gameplay
- Social feature workflows (join, spectate, party)
- Privacy controls and data isolation

## Platform-Specific Implementations

### Windows
- WMI (Windows Management Instrumentation) for process enumeration
- Windows Registry for installed games detection
- Xbox Game Bar API integration
- Windows Store games support via UWP detection

### macOS
- Activity Monitor API for process scanning
- Steam/Epic launcher folder parsing
- macOS app bundle detection
- Metal Performance Shaders for game identification

### Linux
- /proc filesystem for process enumeration
- Steam Proton compatibility layer detection
- Lutris game manager integration
- WINE/Bottles game detection

## Security Considerations

**Process Scanning Security:**
- Whitelist approach: Only scan known game processes
- No scanning of system or sensitive processes
- Regular expression validation for executable names
- Process privilege checking before access

**API Key Management:**
- Encrypted storage of Steam/Epic API keys
- User consent required for each platform connection
- Token refresh handling with secure storage
- Rate limiting to prevent API abuse

**Privacy Protection:**
- Granular opt-out controls per game
- Anonymous usage statistics (no personal data)
- Local data storage with user control
- Clear data deletion on uninstall

## Dependencies & Blockers

**Internal Dependencies:**
- User profile system - for game library display
- Voice connection manager - for party integration
- Settings system - for privacy controls
- Backend API - for presence synchronization

**External Dependencies:**
- Steam Web API access (requires Steam account)
- Epic Games Developer API approval
- Game platform API rate limits and terms of service
- Anti-cheat system compatibility testing

## Success Metrics

**User Engagement Metrics:**
- Game detection adoption rate > 70% of users
- Rich presence usage > 50% during gaming sessions
- Social feature usage (join/party) > 30% of gaming users

**Technical Metrics:**
- Game detection accuracy > 95% for top 100 games
- Rich presence update latency < 10 seconds
- System performance impact < 5% CPU during gaming

**Competitive Parity Metrics:**
- Feature comparison vs Discord Rich Presence: 90%+
- Gaming community adoption rate > 60% within 3 months

## Future Enhancements

### Game Overlay System (P1)
- In-game chat overlay similar to Discord/Steam
- Hardware-accelerated rendering for minimal performance impact
- Customizable positioning and transparency
- Voice activity indicators during gameplay

### Advanced Integrations (P2)
- Twitch streaming integration with game auto-detection
- Discord Rich Presence compatibility layer
- Game launcher auto-start on party invite
- Tournament bracket integration

### AI-Powered Features (P3)
- Intelligent game recommendation based on friends' activity
- Performance analytics and improvement suggestions
- Smart party matching for competitive games
- Game mood detection via gameplay patterns

---

**Related PRDs:** #12 (File Integration), #13 (System Tray), #15 (Gaming Overlay - Future)
**Technical Dependencies:** Platform APIs, anti-cheat compatibility, game launcher access
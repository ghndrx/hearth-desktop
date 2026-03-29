# PRD: Rich Presence and Gaming Integration System

## Overview

**Priority**: P1 (High)
**Timeline**: 8-10 weeks
**Owner**: Native Integration Team

Implement comprehensive gaming integration and rich presence features to compete directly with Discord's core gaming-focused value proposition and establish Hearth Desktop as the premier gaming communication platform.

## Problem Statement

Discord's dominance in gaming communities stems primarily from its rich presence system and game integration features. Hearth Desktop currently lacks:

- Automatic game detection and status updates
- Rich presence with game artwork and details
- Game overlay for in-game voice controls
- Steam/Epic Games Store integration
- Game invite and activity sharing systems

**Current Gap**: Discord has 90% market share in gaming voice chat due to these features. Without gaming integration, Hearth Desktop cannot compete for gaming communities.

## Success Metrics

- **Gaming Adoption**: 60% of users have game activity detected within 30 days
- **Rich Presence Engagement**: 40% of users enable detailed game status sharing
- **Overlay Usage**: 25% of users activate game overlay during gaming sessions
- **Community Growth**: 200% increase in gaming-focused server creation
- **Retention**: Gaming users have 3x higher DAU retention vs non-gaming users

## User Stories

### Core Game Detection
- **As a gamer**, I want Hearth Desktop to automatically detect when I'm playing games so my friends see my activity
- **As a community member**, I want to see what games my friends are playing to join them or start conversations

### Rich Presence Display
- **As a user**, I want my game status to show detailed information (game title, character level, current activity) like Discord
- **As a friend**, I want to see game artwork and details when viewing someone's profile

### Game Overlay Integration
- **As a competitive gamer**, I want voice controls accessible via overlay without Alt+Tab to maintain focus
- **As a streamer**, I want overlay controls that don't interfere with streaming software

### Game Store Integration
- **As a Steam user**, I want Hearth Desktop to sync with my Steam library and friends list
- **As a console gamer**, I want Xbox Live and PlayStation Network integration for cross-platform status

## Technical Requirements

### Game Detection Engine
```rust
// Tauri command structure
#[tauri::command]
async fn detect_running_games() -> Result<Vec<GameProcess>, String>

#[tauri::command]
async fn get_game_metadata(process_name: String) -> Result<GameMetadata, String>

struct GameProcess {
    name: String,
    exe_path: String,
    process_id: u32,
    start_time: SystemTime,
    window_title: Option<String>,
}

struct GameMetadata {
    display_name: String,
    artwork_url: Option<String>,
    steam_app_id: Option<u32>,
    epic_catalog_id: Option<String>,
    publisher: Option<String>,
    genre: Vec<String>,
}
```

### Rich Presence System
```typescript
interface RichPresence {
  applicationId: string;
  name: string;
  details?: string;        // "In a Match"
  state?: string;          // "Ranked Solo Queue"
  startTimestamp?: number; // Game start time
  endTimestamp?: number;   // Match end time
  largeImageKey?: string;  // Game logo
  largeImageText?: string; // "League of Legends"
  smallImageKey?: string;  // Rank/status icon
  smallImageText?: string; // "Diamond IV"
  partySize?: number;      // Current party size
  partyMax?: number;       // Max party size
  matchSecret?: string;    // For "Join Game" buttons
  spectateSecret?: string; // For "Spectate" buttons
  instance?: boolean;      // Whether this is a game instance
}
```

### Game Overlay Architecture
- **Overlay Process**: Separate Tauri window with `always_on_top: true`
- **Input Handling**: Global hotkeys via `tauri-plugin-global-shortcut`
- **Game Detection**: Hook into Direct3D/OpenGL/Vulkan contexts
- **Performance**: Sub-5ms input latency, <2% CPU overhead
- **Compatibility**: Support for fullscreen exclusive and borderless windowed games

### Platform Integration APIs
- **Steam Integration**: Steam Web API + Steamworks SDK
- **Epic Games**: Epic Online Services SDK
- **Xbox Live**: Xbox Live SDK for cross-platform status
- **PlayStation**: PlayStation Network API (where available)
- **Console Linking**: OAuth flows for account connection

## User Interface Design

### Rich Presence Display
```svelte
<UserCard>
  <Avatar src={user.avatar} status={user.status} />
  <UserInfo>
    <DisplayName>{user.displayName}</DisplayName>
    {#if user.richPresence}
      <GameActivity>
        <GameIcon src={user.richPresence.largeImageKey} />
        <GameDetails>
          <GameTitle>{user.richPresence.name}</GameTitle>
          <GameState>{user.richPresence.details}</GameState>
          <PlayTime>Started {formatDuration(user.richPresence.startTimestamp)}</PlayTime>
        </GameDetails>
        <ActionButtons>
          {#if user.richPresence.matchSecret}
            <JoinButton on:click={() => joinGame(user.richPresence.matchSecret)}>
              Join Game
            </JoinButton>
          {/if}
          {#if user.richPresence.spectateSecret}
            <SpectateButton on:click={() => spectateGame(user.richPresence.spectateSecret)}>
              Spectate
            </SpectateButton>
          {/if}
        </ActionButtons>
      </GameActivity>
    {/if}
  </UserInfo>
</UserCard>
```

### Game Overlay Components
- **Voice Status Indicator**: Visual feedback for mic/speaker state
- **Quick Controls Panel**: Mute, deafen, volume sliders
- **Member List**: Compact voice channel participant list
- **Notification Toasts**: Message previews and join/leave events
- **Hotkey Display**: Show current PTT/mute keybinds

### Settings Integration
```svelte
<SettingsSection title="Gaming">
  <ToggleInput
    label="Enable game detection"
    bind:checked={settings.gaming.enableDetection}
  />
  <ToggleInput
    label="Show rich presence to friends"
    bind:checked={settings.gaming.showRichPresence}
  />
  <ToggleInput
    label="Enable game overlay"
    bind:checked={settings.gaming.enableOverlay}
  />
  <SelectInput
    label="Overlay position"
    bind:value={settings.gaming.overlayPosition}
    options={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
  />
  <PlatformIntegrations>
    <SteamIntegration />
    <EpicGamesIntegration />
    <XboxLiveIntegration />
    <PlayStationIntegration />
  </PlatformIntegrations>
</SettingsSection>
```

## Implementation Phases

### Phase 1: Core Game Detection (3 weeks)
- Process enumeration and executable identification
- Game database integration (IGDB API, Steam API)
- Basic status display in user profiles
- Settings UI for game detection preferences

### Phase 2: Rich Presence System (3 weeks)
- Rich presence data structure and API integration
- Game artwork and metadata display
- Activity timestamps and duration tracking
- Privacy controls for presence sharing

### Phase 3: Platform Integrations (2 weeks)
- Steam Web API integration for library sync
- Epic Games Store integration via EOS
- OAuth flows for platform account linking
- Cross-platform friend discovery

### Phase 4: Game Overlay (2-3 weeks)
- Overlay window management and positioning
- Game injection and hook system
- Voice control integration
- Performance optimization and compatibility testing

## Security and Privacy Considerations

### Process Scanning Security
- Whitelist approach for game detection (known safe executables)
- No memory reading or code injection for detection
- User consent required for process monitoring
- Automatic filtering of sensitive applications (banking, security tools)

### Data Privacy
- Rich presence data never stored permanently
- Platform integration requires explicit user consent
- Game activity can be disabled per-game or globally
- Private/incognito mode hides all gaming activity

### Overlay Security
- Overlay only active during whitelisted game processes
- No capture of game content or screenshots
- Secure input handling to prevent key logging
- Automatic disable for known anti-cheat systems

## Success Metrics and KPIs

### Adoption Metrics
- **Game Detection Rate**: % of gaming sessions successfully detected
- **Rich Presence Opt-in**: % of users who enable detailed status sharing
- **Platform Integration**: % of users who link Steam/Epic/Xbox accounts
- **Overlay Activation**: % of gaming sessions with overlay usage

### Engagement Metrics
- **Gaming Server Growth**: New servers created with gaming focus
- **Friend Discovery**: New connections via gaming activity
- **Session Length**: Average voice chat duration during gaming
- **Feature Usage**: Which rich presence features drive most engagement

### Technical Performance
- **Detection Accuracy**: % of games correctly identified
- **Overlay Performance**: FPS impact measurement across popular games
- **Battery Usage**: Power consumption impact on laptops during gaming
- **Compatibility**: % of top 100 Steam games with working overlay

## Competitive Analysis

### Discord Strengths to Match
- **Rich Game Database**: 15M+ games with artwork and metadata
- **Universal Overlay**: Works across 95%+ of PC games
- **Platform Integration**: Native Steam, Xbox, PlayStation support
- **Social Features**: Game activity drives 40% of new friend connections

### Hearth Desktop Advantages
- **Performance**: Native app with lower resource usage than Discord
- **Privacy**: Local-first approach with optional presence sharing
- **Customization**: More granular control over what games/details to share
- **Innovation**: Opportunity to integrate console gaming better than Discord

## Risk Mitigation

### Technical Risks
- **Anti-cheat Conflicts**: Maintain whitelist of compatible games, automatic disable for flagged titles
- **Performance Impact**: Strict resource usage limits, automatic scaling based on system performance
- **Game Updates**: Automated game database updates, fallback to generic detection

### Business Risks
- **Platform API Limits**: Multiple data sources, graceful degradation if APIs unavailable
- **User Adoption**: Gradual rollout with clear value demonstration
- **Privacy Concerns**: Transparent controls, privacy-first marketing

## Future Roadmap

### Post-Launch Enhancements (3+ months)
- Game invite system with direct server integration
- Tournament and esports integration features
- Console gaming support via mobile companion
- AI-powered game recommendation system
- Streaming integration (Twitch, YouTube Gaming)

This rich presence and gaming integration system will establish Hearth Desktop as a serious Discord competitor in the gaming space while leveraging our performance and privacy advantages.
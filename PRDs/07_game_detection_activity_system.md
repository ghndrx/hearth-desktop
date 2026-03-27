# PRD: Game Detection and Activity Status System

## Overview

**Priority**: P0 (Critical)
**Timeline**: 6-8 weeks
**Owner**: Desktop/Backend Team

Implement automatic game detection and rich presence activity status to match Discord's flagship gaming integration features. This system will display "Currently Playing" status and enable Rich Presence for enhanced social gaming experiences.

## Problem Statement

Gaming communities are Discord's primary use case, and the "Currently Playing" feature is core to the platform's social experience. Without game detection and activity status:
- Users can't share gaming activity with friends
- Communities lose context about member activities
- Hearth Desktop appears as a basic chat app rather than a gaming platform
- Missing Rich Presence integration reduces user engagement

This represents a critical competitive gap that impacts user retention and community building.

## Goals

### Primary Goals
- **Automatic game detection** for 1000+ popular games
- **"Currently Playing" status display** across all user interfaces
- **Rich Presence integration** with game-specific metadata
- **Privacy controls** for activity sharing preferences
- **Custom activity status** support (Spotify, streaming, etc.)

### Success Metrics
- 95% detection accuracy for top 100 games on Steam
- <2 second detection latency from game launch
- 80% user opt-in rate for activity sharing
- 50% increase in voice channel engagement when gaming status visible

## Technical Requirements

### Game Detection Engine
```rust
// Core detection system
#[tauri::command]
async fn detect_running_games() -> Result<Vec<DetectedGame>, String>

#[tauri::command]
async fn get_game_metadata(game_id: String) -> Result<GameMetadata, String>

#[derive(Serialize, Deserialize)]
struct DetectedGame {
    process_name: String,
    window_title: String,
    executable_path: String,
    game_id: Option<String>,    // Steam App ID, etc.
    start_time: SystemTime,
    metadata: Option<GameMetadata>,
}
```

### Game Database Integration
```rust
struct GameMetadata {
    name: String,
    icon_url: Option<String>,
    store_url: Option<String>,     // Steam, Epic, etc.
    genre: Vec<String>,
    developer: String,
    supports_rich_presence: bool,
}
```

### Platform-Specific Detection

**Windows**:
- **Process enumeration**: `EnumProcesses` + `GetModuleFileNameEx`
- **Window detection**: `EnumWindows` + `GetWindowText`
- **Steam integration**: Steam API for Rich Presence
- **Game launcher detection**: Steam, Epic, Battle.net, Origin, Uplay

**macOS**:
- **NSWorkspace**: Running applications monitoring
- **Process monitoring**: via `sysctl` and Activity Monitor APIs
- **App Bundle detection**: CFBundle* APIs for app metadata

**Linux**:
- **Process filesystem**: `/proc/*/exe` and `/proc/*/cmdline`
- **Window managers**: X11 `_NET_WM_NAME`, Wayland compositor APIs
- **Steam on Linux**: Native Steam client integration
- **Lutris/Wine**: Custom detection for Windows games

### Rich Presence System
```typescript
interface RichPresence {
  game: string;
  state?: string;           // "In Main Menu", "Playing as Scout"
  details?: string;         // "Ranked Match", "Level 42"
  startTimestamp?: number;  // When activity started
  endTimestamp?: number;    // When activity will end
  largeImageKey?: string;   // Game icon
  largeImageText?: string;  // Hover text
  smallImageKey?: string;   // Status icon (party, etc.)
  smallImageText?: string;
  partyId?: string;         // Group/party identifier
  partySize?: number;       // Current party size
  partyMax?: number;        // Max party size
  joinSecret?: string;      // For "Join Game" button
  spectateSecret?: string;  // For "Spectate" button
}
```

## User Experience

### Activity Display
- **User profile card**: Shows current activity with game icon and details
- **Voice channel member list**: Activity status for each participant
- **Friends list**: "Currently Playing" with join/spectate options
- **Server member sidebar**: Gaming status indicators

### Privacy Controls
```typescript
interface ActivitySettings {
  showCurrentActivity: boolean;
  showGameTime: boolean;
  allowGameInvites: boolean;
  shareWithFriends: boolean;
  shareInServers: boolean;
  hiddenGames: string[];        // Games to never show
  customStatuses: CustomStatus[];
}
```

### Custom Status System
- **Manual status setting**: "Streaming on Twitch", "Studying", etc.
- **Spotify integration**: "Listening to [Song] by [Artist]"
- **Streaming detection**: OBS, Streamlabs OBS, XSplit
- **Custom emoji and text**: User-defined status messages

## Implementation Plan

### Phase 1: Core Detection (Week 1-3)
- Implement cross-platform process detection
- Build game database and matching algorithms
- Create basic "Currently Playing" display

### Phase 2: Rich Presence (Week 4-5)
- Integrate with Steam, Epic Games, and other launchers
- Implement Rich Presence data parsing and display
- Add game metadata fetching and caching

### Phase 3: Social Features (Week 6-8)
- Build join/spectate invitation system
- Implement privacy controls and settings UI
- Add custom status and streaming detection

## Game Database Strategy

### Detection Methods
1. **Executable matching**: Known game .exe files
2. **Window title patterns**: Game-specific title formats
3. **Steam API integration**: Steam App IDs and metadata
4. **Community database**: IGDB, SteamGridDB for game metadata
5. **User-submitted additions**: Community-driven game additions

### Priority Games List
- **Top 50 Steam games** by concurrent players
- **Popular competitive games**: LoL, Valorant, CS2, Apex Legends, Fortnite
- **MMORPGs**: WoW, FFXIV, Guild Wars 2, Lost Ark
- **Indie favorites**: Among Us, Fall Guys, Phasmophobia
- **Console emulators**: RetroArch, Dolphin, PCSX2

## Privacy and Security

### Data Collection Limits
- **No input monitoring**: Only process names and window titles
- **Local storage**: Game detection data stored locally only
- **Opt-in sharing**: Users control what gets shared with whom
- **No sensitive data**: Avoid capturing passwords, personal info

### Security Considerations
- **Anti-cheat compatibility**: Ensure detection doesn't interfere with game security
- **Process privilege separation**: No elevated permissions required
- **Malware prevention**: Validate game executables against known signatures

## Integration Points

### Voice System Integration
- **Gaming mode**: Optimized audio settings when games detected
- **Automatic noise suppression**: Enhanced during competitive games
- **Background app awareness**: Reduce CPU usage when games running

### Notification System
- **Game launch notifications**: Optional friends notifications
- **Do Not Disturb**: Auto-enable during fullscreen games
- **Achievement sharing**: Optional game milestone sharing

## Competitive Analysis

**Discord Advantages**:
- 8+ years of game detection refinement
- Deep Steam, Epic Games, and console integrations
- Rich Presence SDK adopted by many games
- Large gaming community network effects

**Hearth Opportunities**:
- **Performance**: Tauri's efficiency means lower impact on game performance
- **Privacy**: More granular control over data sharing
- **Cross-platform**: Better Linux gaming support than Discord
- **Modern architecture**: Easier to add new launcher integrations

## Post-Launch Enhancements

- **Machine learning**: Adaptive game detection for unknown games
- **Game overlay integration**: In-game chat and voice controls
- **Achievement tracking**: Personal gaming statistics
- **LFG (Looking for Group)**: Automated party formation based on games played
- **Streaming integration**: Twitch, YouTube Live status detection
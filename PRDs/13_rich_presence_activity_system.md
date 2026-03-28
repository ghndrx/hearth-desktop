# PRD: Rich Presence & Activity Status System

## Overview

**Priority**: P1 (High)
**Timeline**: 6-8 weeks
**Owner**: Native/Backend Team

Implement comprehensive rich presence and activity status system to enhance social features and compete with Discord's activity-based social interactions.

## Problem Statement

Hearth Desktop lacks activity status broadcasting and rich presence integration. Users cannot:
- Show what game/application they're currently using
- Set custom status messages and activities
- See detailed activity information from friends
- Integrate with external applications (Spotify, development tools, etc.)
- Provide social context for availability and current activity

**Current Gap**: Discord has sophisticated rich presence showing games, music, development activity, custom statuses, and application integrations that drive social engagement and community building.

## Success Metrics

- **Activity Detection**: 95% accuracy in detecting active applications/games
- **Social Engagement**: 70% increase in profile views when rich presence is active
- **Integration Adoption**: 60% of users enable at least one external integration
- **Status Usage**: 80% of users set custom status messages
- **Performance Impact**: <1% CPU overhead for activity detection

## User Stories

### Activity Broadcasting
- As a user, I want my current game to be shown to friends so they know what I'm playing
- As a user, I want to show custom status messages so I can communicate availability
- As a developer, I want to show my current IDE/project so teammates know what I'm working on
- As a music listener, I want to show what I'm listening to so friends can discover new music

### Social Discovery
- As a user, I want to see what friends are playing so I can join them
- As a user, I want activity-based suggestions for who to chat with
- As a community manager, I want to see server member activity to understand engagement
- As a user, I want to filter friends by activity type (gaming, working, available)

### Privacy & Control
- As a user, I want to control which activities are shared publicly
- As a user, I want to set invisible mode while still being active
- As a user, I want to customize which applications are detected
- As a user, I want activity history privacy controls

## Technical Requirements

### Activity Detection System (Rust/Tauri)

- **Process Monitoring**
  - Cross-platform process enumeration and monitoring
  - Application window title detection
  - Focus tracking and idle time detection
  - Game/application classification system

- **Rich Presence Integration**
  - Discord Rich Presence SDK compatibility
  - Custom protocol for Hearth-native rich presence
  - Real-time activity updates via WebSocket
  - Activity metadata extraction (game state, music info, etc.)

- **Privacy Controls**
  - Per-application visibility settings
  - Activity filtering and blocking
  - Invisible mode with selective sharing
  - Activity history management

### Status Management System

- **Status Types**
  - Online, Idle, Do Not Disturb, Invisible
  - Custom status messages with emoji support
  - Activity-based automatic status
  - Temporary status with expiration

- **Activity Categories**
  - Gaming (with game detection and Rich Presence)
  - Music/Media (Spotify, Apple Music, etc.)
  - Development (VS Code, IDEs, terminals)
  - Productivity (browsers, document editors)
  - Custom applications and manual activities

## Technical Specifications

### Activity Detection Implementation

```rust
// Cross-platform activity detection
#[derive(Debug, Clone)]
pub struct ActivityDetector {
    pub enabled: bool,
    pub monitored_processes: Vec<MonitoredProcess>,
    pub current_activity: Option<UserActivity>,
    pub detection_interval: Duration,
}

#[derive(Debug, Clone)]
pub struct UserActivity {
    pub id: String,
    pub name: String,
    pub activity_type: ActivityType,
    pub details: Option<String>,
    pub state: Option<String>,
    pub timestamps: ActivityTimestamps,
    pub assets: Option<ActivityAssets>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub enum ActivityType {
    Playing,     // Games
    Listening,   // Music/Audio
    Watching,    // Video/Streaming
    Streaming,   // Live streaming
    Competing,   // Competitive games
    Working,     // Development/Productivity
    Custom,      // User-defined
}

// Platform-specific process monitoring
#[cfg(target_os = "windows")]
mod windows_activity {
    use windows::Win32::System::ProcessStatus::*;
    use windows::Win32::UI::WindowsAndMessaging::*;

    pub fn get_active_window_info() -> Result<WindowInfo> {
        // GetForegroundWindow, GetWindowText, GetWindowThreadProcessId
    }
}

#[cfg(target_os = "macos")]
mod macos_activity {
    use cocoa::appkit::{NSWorkspace, NSRunningApplication};

    pub fn get_active_application() -> Result<ApplicationInfo> {
        // NSWorkspace.frontmostApplication
    }
}

#[cfg(target_os = "linux")]
mod linux_activity {
    use x11::xlib::*;

    pub fn get_active_window() -> Result<WindowInfo> {
        // _NET_ACTIVE_WINDOW, _NET_WM_NAME
    }
}
```

### Rich Presence Protocol

```typescript
// Rich Presence data structure
interface RichPresence {
  clientId: string;
  activity: {
    name: string;
    type: ActivityType;
    details?: string;
    state?: string;
    timestamps?: {
      start?: number;
      end?: number;
    };
    assets?: {
      large_image?: string;
      large_text?: string;
      small_image?: string;
      small_text?: string;
    };
    party?: {
      id?: string;
      size?: [number, number];
    };
    secrets?: {
      join?: string;
      spectate?: string;
      match?: string;
    };
    buttons?: Array<{
      label: string;
      url: string;
    }>;
  };
}

// Activity update WebSocket events
interface ActivityUpdateEvent {
  type: 'activity_update';
  userId: string;
  activity: RichPresence | null;
  timestamp: number;
}
```

### Application Integration Framework

```rust
// Plugin-based integration system
pub trait ActivityIntegration {
    fn name(&self) -> &str;
    fn detect_activity(&self) -> Option<UserActivity>;
    fn start_monitoring(&mut self) -> Result<()>;
    fn stop_monitoring(&mut self) -> Result<()>;
}

// Built-in integrations
pub struct SpotifyIntegration {
    api_client: SpotifyAPI,
    current_track: Option<Track>,
}

pub struct VSCodeIntegration {
    workspace_monitor: FileWatcher,
    current_project: Option<Project>,
}

pub struct GameIntegration {
    game_database: GameDatabase,
    steam_api: Option<SteamAPI>,
}
```

## Implementation Phases

### Phase 1: Core Activity Detection (3 weeks)
- Cross-platform process monitoring system
- Basic application/game detection
- Activity categorization and classification
- Simple status broadcasting to backend
- Privacy controls for activity sharing

### Phase 2: Rich Presence Integration (2 weeks)
- Discord Rich Presence SDK integration
- Custom rich presence protocol
- Real-time activity updates via WebSocket
- Activity metadata extraction and formatting
- Game detection with rich details

### Phase 3: External Integrations (2 weeks)
- Spotify/Apple Music integration
- Development tool integration (VS Code, IDEs)
- Browser activity detection
- Custom application registration system
- Integration marketplace/plugin system

### Phase 4: Advanced Social Features (1 week)
- Activity-based friend suggestions
- Social activity filtering and search
- Activity history and analytics
- Presence-based notifications
- Group activity coordination

## Platform Integration Details

### Windows
- **Process Detection**: WMI queries, Process32First/Next
- **Window Information**: GetWindowText, GetWindowThreadProcessId
- **Game Detection**: Steam API, Windows Gaming features
- **Media Integration**: Windows Media Control API

### macOS
- **Application Detection**: NSWorkspace, NSRunningApplication
- **Window Information**: CGWindowListCopyWindowInfo
- **Media Integration**: MPNowPlayingInfoCenter, MediaPlayer framework
- **Privacy**: Request appropriate permissions for process monitoring

### Linux
- **Process Detection**: /proc filesystem, ps command
- **Window Information**: X11 _NET_WM_NAME, _NET_ACTIVE_WINDOW
- **Media Integration**: MPRIS D-Bus interface
- **Display Server**: X11 and Wayland compatibility

## Privacy and Security

- **Data Minimization**: Only collect necessary activity metadata
- **Local Storage**: Activity data stored locally with optional cloud sync
- **Granular Controls**: Per-application privacy settings
- **Anonymous Mode**: Activity detection without external broadcasting
- **Data Retention**: Configurable activity history retention periods

## Integration Specifications

### Spotify Integration
```rust
pub struct SpotifyActivity {
    track_name: String,
    artist: String,
    album: String,
    duration_ms: u64,
    progress_ms: u64,
    is_playing: bool,
}

impl ActivityIntegration for SpotifyIntegration {
    fn detect_activity(&self) -> Option<UserActivity> {
        if let Some(track) = &self.current_track {
            Some(UserActivity {
                name: "Spotify".to_string(),
                activity_type: ActivityType::Listening,
                details: Some(track.name.clone()),
                state: Some(format!("by {}", track.artist)),
                // ... additional metadata
            })
        } else {
            None
        }
    }
}
```

### Development Tool Integration
```rust
pub struct DevelopmentActivity {
    tool_name: String,
    project_name: Option<String>,
    file_type: Option<String>,
    language: Option<String>,
    git_branch: Option<String>,
}

// VS Code integration via extension API
pub struct VSCodeIntegration {
    extension_port: u16,
    current_workspace: Option<Workspace>,
}
```

## Performance Requirements

- **Detection Interval**: 5-30 second configurable intervals
- **CPU Usage**: <1% CPU overhead during monitoring
- **Memory Usage**: <20MB RAM for activity system
- **Network**: <1KB/minute for activity updates
- **Startup Impact**: <500ms additional startup time

## Dependencies

- **Backend API**: Activity storage and broadcasting endpoints
- **WebSocket**: Real-time activity update events
- **Application Database**: Game/application metadata and icons
- **Image CDN**: Activity icons and rich presence images

## Success Criteria

### MVP Definition
- Automatic game/application detection working on all platforms
- Basic activity broadcasting to other users
- Simple custom status message system
- Privacy controls for activity sharing
- Integration with at least one external service (Spotify)

### Full Feature Success
- 95% accuracy in application detection
- Rich presence integration with detailed game information
- Comprehensive external integrations (music, development, productivity)
- Advanced social features based on activity
- Sub-1% performance impact on system resources

## Competitive Analysis

### vs Discord Rich Presence
- **Matching**: Game detection, custom status, external integrations
- **Exceeding**: Performance (lower overhead), granular privacy controls
- **Missing**: Game store integration, developer SDK ecosystem

### Differentiation Opportunities
- **Performance**: Native efficiency vs. Electron overhead
- **Privacy**: Local-first activity data with optional sharing
- **Customization**: Advanced activity filtering and categorization
- **Developer Tools**: Better development workflow integration

## Future Enhancements

- **AI Activity Recognition**: Machine learning for better app categorization
- **Productivity Analytics**: Personal activity insights and time tracking
- **Social Recommendations**: Activity-based friend and server suggestions
- **Mobile Sync**: Activity status sync across desktop and mobile
- **API Platform**: Third-party integration SDK for custom applications
- **Activity Automation**: Scheduled status changes and activity triggers
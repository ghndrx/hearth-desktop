# PRD #14: Rich Notifications & Status System

**Status**: Competitive Gap Analysis
**Priority**: P1 (Core communication experience gap vs Discord)
**Complexity**: Medium
**Dependencies**: Advanced Tray System (#13), Text Messaging System (#01)

## Problem Statement

Hearth Desktop's current notifications are basic system alerts. Discord provides rich, actionable notifications with reply buttons, message previews, and sophisticated notification management (DND scheduling, per-server sounds, notification grouping). Users expect modern chat applications to provide contextual, actionable notifications that reduce context switching.

## Success Metrics

- [ ] Rich notifications with reply/mark-as-read actions
- [ ] Notification grouping by conversation/server
- [ ] Do Not Disturb scheduling with smart exceptions
- [ ] Per-server/channel notification sound customization
- [ ] Status system with automatic away/idle detection

## User Stories

### Focused Work Scenario
**As a** developer in deep work mode
**I want** to schedule Do Not Disturb with exceptions for urgent mentions
**So that** I can focus while staying reachable for emergencies

### Quick Response Scenario
**As a** user receiving a direct message
**I want** to reply directly from the notification
**So that** I can respond without switching from my current application

### Team Management Scenario
**As a** team lead managing multiple projects
**I want** different notification sounds per server/project
**So that** I can instantly know which team needs attention

## Technical Architecture

### Notification Types
- **Direct Message**: High priority with reply action
- **Mention**: Medium priority with mark-as-read action
- **Channel Message**: Low priority, grouped by channel
- **Voice Activity**: Real-time status (user joined/left voice)
- **System Events**: Updates, friend requests, server invites

### Status System
```rust
#[derive(Serialize, Deserialize)]
pub enum UserStatus {
    Online,
    Away,           // Auto-set after idle timeout
    DoNotDisturb,   // Manual or scheduled
    Invisible,      // Appear offline to others
    CustomStatus(String, Option<String>), // Text + optional emoji
}
```

## Implementation Details

### Phase 1: Rich Notification Foundation
- **T-NOTIFY-01**: Extend notification system for action buttons
- **T-NOTIFY-02**: Implement notification grouping/stacking
- **T-NOTIFY-03**: Add message preview with privacy controls
- **T-NOTIFY-04**: Build notification sound customization system

### Phase 2: Advanced Notification Management
- **T-NOTIFY-05**: Implement Do Not Disturb with scheduling
- **T-NOTIFY-06**: Add smart DND exceptions (keywords, VIPs)
- **T-NOTIFY-07**: Build notification history/center
- **T-NOTIFY-08**: Add cross-platform notification styling

### Phase 3: Status & Presence System
- **T-NOTIFY-09**: Implement automatic idle/away detection
- **T-NOTIFY-10**: Build custom status setting UI
- **T-NOTIFY-11**: Add status sync across devices
- **T-NOTIFY-12**: Implement focus-based auto-DND (gaming, fullscreen)

## User Interface Design

### Rich Notification Example
```
┌─ Hearth Desktop ─────────────────────────────────┐
│ 📱 John Smith in #general                        │
│ "Hey team, can someone review the PR I just..."  │
│                                                   │
│ [💬 Reply] [✓ Mark Read] [🔕 Mute Channel] [×]   │
└───────────────────────────────────────────────────┘
```

### Grouped Notifications
```
┌─ Hearth Desktop ─────────────────────────────────┐
│ 📢 3 messages in Development Server              │
│                                                   │
│ • Alice: "Build is failing on staging..."        │
│ • Bob: "I can take a look"                       │
│ • Alice: "Thanks! Here's the error log..."       │
│                                                   │
│ [💬 Open Channel] [✓ Mark All Read] [×]          │
└───────────────────────────────────────────────────┘
```

### Settings Panel
```
┌─ Notifications & Status ──────────────────────────┐
│                                                    │
│ Notification Settings                              │
│ ☑ Enable desktop notifications                    │
│ ☑ Show message previews                           │
│ ☑ Group notifications by conversation             │
│ ☑ Play sound for notifications                    │
│                                                    │
│ Do Not Disturb                                     │
│ Status: 🟢 Online                    [Change ▼]   │
│                                                    │
│ Schedule DND:                                      │
│ Weekdays: [9:00 AM] to [5:00 PM]  ☑ Enabled      │
│ Weekends: [10:00 AM] to [2:00 PM] ☐ Enabled      │
│                                                    │
│ DND Exceptions:                                    │
│ ☑ Direct messages from friends                    │
│ ☑ Messages containing: [urgent, emergency]        │
│ ☑ Voice channel invitations                       │
│                                                    │
│ Sound Settings                                     │
│ Default sound: [Soft Chime ▼]       [🔊 Preview] │
│                                                    │
│ Per-server sounds:                                 │
│ • Work Team: [Professional Ping ▼]               │
│ • Gaming Squad: [Epic Horn ▼]                    │
│ • Family: [Gentle Bell ▼]                        │
│                                                    │
│ Status Settings                                    │
│ Auto-away after: [10 minutes] ▼                  │
│ ☑ Set DND when in fullscreen applications        │
│ ☑ Sync status across all devices                 │
│                                                    │
│ Custom Status:                                     │
│ 🎯 [Working on quarterly planning] [Clear]        │
│ Clear after: [4 hours ▼]                         │
└────────────────────────────────────────────────────┘
```

## Advanced Features

### Smart Notification Filtering
```rust
// Notification intelligence system
pub struct NotificationFilter {
    pub priority_keywords: Vec<String>,  // "urgent", "help", "@channel"
    pub vip_users: Vec<UserId>,          // Always notify
    pub quiet_hours: Vec<TimeRange>,     // Suppress non-critical
    pub focus_detection: bool,           // Auto-DND during games
}
```

### Notification Actions
- **Reply**: Inline text input for quick responses
- **Mark as Read**: Clear unread state without opening
- **Mute Channel**: Temporarily silence notifications
- **Open**: Navigate to message in app
- **Remind Later**: Snooze notification for 1hr/4hr/tomorrow

### Platform-Specific Enhancements
- **Windows**: Action Center integration, toast styling
- **macOS**: Notification Center grouping, banner vs alert styles
- **Linux**: libnotify with action support, desktop-specific styling

## Technical Implementation

### Enhanced Notification Service
```rust
// src-tauri/src/notifications.rs
use tauri_plugin_notification::{NotificationExt, Permission};

pub struct RichNotification {
    pub id: String,
    pub title: String,
    pub body: String,
    pub actions: Vec<NotificationAction>,
    pub group_id: Option<String>,
    pub priority: NotificationPriority,
    pub sound: Option<String>,
    pub image: Option<String>,
}

pub enum NotificationAction {
    Reply { placeholder: String },
    MarkRead,
    Mute { duration: Duration },
    Open { target: String },
}
```

### Status Management
```rust
// src-tauri/src/status.rs
use tokio::time::{interval, Duration};

pub struct StatusManager {
    current_status: UserStatus,
    idle_tracker: IdleTracker,
    dnd_schedule: Vec<DndRule>,
    focus_detector: FocusDetector,
}

impl StatusManager {
    pub async fn auto_update_status(&mut self) {
        // Check idle time, scheduled DND, focus state
        // Update status accordingly
    }
}
```

### Cross-Platform Idle Detection
- **Windows**: GetLastInputInfo API
- **macOS**: CGEventSourceSecondsSinceLastEventType
- **Linux**: XScreenSaver extension or logind D-Bus

## Testing Strategy

### Notification Testing
- [ ] Actions work correctly on all platforms
- [ ] Grouping reduces notification spam effectively
- [ ] Sound customization persists across app restarts
- [ ] DND scheduling activates/deactivates correctly

### Status System Testing
- [ ] Idle detection accurate within 30 seconds
- [ ] Status syncs across multiple devices
- [ ] Focus detection works with major games/apps
- [ ] Custom status displays correctly to other users

### Cross-Platform Testing
- [ ] Rich notifications render properly on Windows 10/11
- [ ] macOS notification center integration works
- [ ] Linux notifications work across desktop environments
- [ ] High DPI scaling handled correctly

## Performance Considerations

### Resource Usage
- **Memory**: Additional 5MB for notification history
- **CPU**: <1% for status monitoring and idle detection
- **Network**: Minimal overhead for status sync
- **Battery**: Optimized polling intervals to preserve battery

### Scalability
- **Notification History**: LRU cache with 100 notification limit
- **Sound Files**: Lazy loading and caching
- **Status Updates**: Debounced to prevent spam

## Privacy & Security

### Data Protection
- **Message Previews**: Configurable, can be disabled entirely
- **Notification History**: Encrypted local storage only
- **Sound Files**: Validate audio files to prevent exploits
- **Status Sharing**: User controls who can see custom status

### Cross-Device Considerations
- **Status Sync**: End-to-end encrypted status updates
- **Notification Routing**: Intelligent delivery to active device
- **Privacy Controls**: Per-device notification preferences

## Integration Points

### Existing Systems
- **Text Messaging**: Rich notifications for DMs and mentions
- **Voice Channels**: Status updates for voice activity
- **Server Management**: Notification settings per server
- **Tray System**: Unread count and quick status changes

### Future Enhancements
- **Mobile Companion**: Cross-platform notification sync
- **Calendar Integration**: Auto-DND based on calendar events
- **Productivity Apps**: Status sync with Slack, Teams, etc.

## Migration Strategy

### Backward Compatibility
- **Existing Settings**: Migrate basic notification preferences
- **Sound Files**: Provide default sound pack
- **Status**: Default to Online status for existing users

### Feature Rollout
- **Phase 1**: Enhanced notifications with actions (2 weeks)
- **Phase 2**: Status system and DND (3 weeks)
- **Phase 3**: Sound customization and grouping (2 weeks)

## Success Metrics & KPIs

### User Engagement
- **Notification Interaction**: % of notifications that receive actions
- **Status Usage**: % of users setting custom status
- **DND Adoption**: % of users configuring scheduled DND
- **Sound Customization**: % of users changing default sounds

### Technical Performance
- **Notification Latency**: <3 seconds from server to display
- **Action Responsiveness**: Actions execute in <500ms
- **Status Accuracy**: Idle detection within 30 seconds of actual idle

### User Satisfaction
- **Notification Fatigue**: Reduction in users disabling notifications
- **Response Time**: Improved average response times to messages
- **User Feedback**: Positive reviews mentioning notification experience

---

**Estimated Development Time**: 5-6 weeks
**Required Team**: 2 engineers (Notifications + Status systems)
**Risk Level**: Medium (platform notification API variations)
**User Impact**: High for daily communication workflow
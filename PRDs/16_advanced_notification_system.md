# PRD-16: Advanced Notification System

**Epic**: Desktop Platform Parity
**Priority**: P0 (Critical)
**Timeline**: 6 weeks
**Owner**: Desktop Platform Team

## Problem Statement

Hearth Desktop's current notification system is basic compared to Discord's sophisticated notification experience. Users expect rich, actionable notifications that integrate deeply with their OS notification center, provide quick actions, smart filtering, and context-aware grouping. Without advanced notifications, users miss important messages and lose engagement with the platform.

**Current Pain Points:**
- Basic toast notifications with no actions or rich content
- No notification grouping or smart prioritization
- Missing OS notification center integration and persistence
- Lack of inline reply and quick action capabilities
- Poor notification filtering and user control options

## Objectives

### Primary Goals
- Implement rich, actionable notifications with inline responses
- Build intelligent notification grouping and prioritization system
- Create comprehensive notification management and filtering
- Establish seamless OS notification center integration

### Success Metrics
- 40% increase in notification engagement (clicks + actions)
- 25% reduction in notification fatigue (user-reported)
- 90% of notifications include relevant quick actions
- <500ms notification delivery latency for real-time events

## Detailed Requirements

### 1. Rich Notification Content

#### 1.1 Enhanced Notification Format
```rust
// Rich notification data structure
#[derive(Serialize, Deserialize, Debug)]
pub struct RichNotification {
    pub id: String,
    pub title: String,
    pub body: String,
    pub avatar: Option<String>,
    pub server_icon: Option<String>,
    pub channel_name: String,
    pub message_preview: String,
    pub timestamp: i64,
    pub actions: Vec<NotificationAction>,
    pub priority: NotificationPriority,
    pub group_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NotificationAction {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
    pub action_type: ActionType,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum ActionType {
    Reply,
    React(String), // emoji
    Join,
    Mute,
    MarkRead,
    ViewChannel,
}
```

**Rich Content Features:**
- **User Avatars**: Display sender profile pictures in notifications
- **Server Icons**: Show server/channel icons for context
- **Message Preview**: Truncated message content with smart ellipsis
- **Media Previews**: Image thumbnails and file type indicators
- **Inline Reactions**: Quick emoji response buttons

#### 1.2 Cross-Platform Notification Rendering
```rust
// Platform-specific notification implementations
#[cfg(target_os = "windows")]
async fn send_windows_notification(notification: RichNotification) -> Result<(), Error> {
    // Windows Toast Notification with custom XML
    // Action buttons and inline reply fields
    // Hero images and attribution text
}

#[cfg(target_os = "macos")]
async fn send_macos_notification(notification: RichNotification) -> Result<(), Error> {
    // NSUserNotification with reply field
    // Action buttons in notification banner
    // Notification center persistence
}

#[cfg(target_os = "linux")]
async fn send_linux_notification(notification: RichNotification) -> Result<(), Error> {
    // libnotify with action buttons
    // Desktop environment specific features
    // D-Bus notification interface
}
```

### 2. Intelligent Notification Management

#### 2.1 Smart Grouping System
```rust
// Notification grouping engine
pub struct NotificationGroup {
    pub group_id: String,
    pub group_type: GroupType,
    pub notifications: Vec<RichNotification>,
    pub summary_title: String,
    pub summary_body: String,
    pub priority: NotificationPriority,
}

pub enum GroupType {
    ChannelMessages(String), // channel_id
    DirectMessages(String),  // user_id
    ServerActivity(String),  // server_id
    VoiceEvents,
    System,
}

impl NotificationGrouper {
    async fn group_notifications(&self, notifications: Vec<RichNotification>) -> Vec<NotificationGroup> {
        // Group by channel/server with time window
        // Combine similar events (user joined, multiple messages)
        // Create smart summaries ("3 messages in #general")
    }
}
```

**Grouping Logic:**
- **Channel Grouping**: Multiple messages from same channel within 5 minutes
- **User Grouping**: DMs from same user within time window
- **Event Grouping**: Similar events (joins, reactions) combined
- **Summary Generation**: "5 new messages in #general" with most recent preview
- **Dynamic Updates**: Existing groups update instead of new notifications

#### 2.2 Priority and Filtering System
```rust
// Smart notification prioritization
#[derive(Debug, PartialEq, PartialOrd)]
pub enum NotificationPriority {
    Critical,   // Direct mentions, DMs
    High,       // Server mentions, friend activity
    Normal,     // Channel messages, general activity
    Low,        // Presence updates, minor events
}

pub struct NotificationFilter {
    pub user_preferences: UserNotificationSettings,
    pub context_filters: Vec<ContextFilter>,
    pub time_filters: Vec<TimeFilter>,
}

pub struct ContextFilter {
    pub condition: FilterCondition,
    pub action: FilterAction,
}

pub enum FilterCondition {
    UserMentioned,
    KeywordMatched(String),
    ChannelType(ChannelType),
    UserStatus(UserStatus),
    GameActivity(String),
}

pub enum FilterAction {
    Promote(NotificationPriority),
    Suppress,
    DelayUntil(Duration),
    RouteToGroup(String),
}
```

**Smart Filtering Features:**
- **Context Awareness**: Suppress notifications when user is active in channel
- **Gaming Mode**: Minimal notifications during detected gaming sessions
- **Do Not Disturb**: Respect OS DND with emergency override for critical notifications
- **Keyword Filtering**: Custom keywords trigger high priority notifications
- **Social Filtering**: Friend messages get priority over stranger messages

### 3. Advanced Notification Actions

#### 3.1 Inline Response System
```typescript
// Frontend notification action handlers
class NotificationActionHandler {
  async handleInlineReply(notificationId: string, message: string) {
    // Send message without opening main app window
    // Show confirmation toast with "undo" option
    // Update notification to show reply sent
  }

  async handleQuickReaction(notificationId: string, emoji: string) {
    // Add reaction to message via API
    // Animate notification to show reaction added
    // Remove notification after successful reaction
  }

  async handleJoinChannel(channelId: string) {
    // Join voice/video channel directly from notification
    // Show mini voice controls in system tray
    // Dismiss notification after successful join
  }
}
```

**Action Types:**
- **Inline Reply**: Text input field within notification for quick responses
- **Quick Reactions**: Emoji buttons for rapid message reactions
- **Join Voice/Video**: One-click join for voice channel invitations
- **Mute/Unmute**: Channel-specific or server-wide muting options
- **Mark as Read**: Dismiss notification and mark conversation as read
- **View in App**: Open specific channel/conversation in main window

#### 3.2 Action Result Feedback
```rust
// Action result notifications
pub struct ActionResult {
    pub original_notification_id: String,
    pub action_performed: ActionType,
    pub result_status: ResultStatus,
    pub undo_available: bool,
    pub feedback_message: String,
}

pub enum ResultStatus {
    Success,
    Failed(String),
    Pending,
    Unauthorized,
}
```

**Feedback System:**
- **Success Confirmation**: "Reply sent to #general" with undo option
- **Error Handling**: "Failed to join voice channel - try again"
- **Undo Capability**: 10-second undo window for accidental actions
- **Visual Feedback**: Notification morphs to show action result

### 4. OS Integration and Persistence

#### 4.1 Notification Center Integration
```rust
// Platform notification center features
#[cfg(target_os = "windows")]
impl WindowsNotificationCenter {
    async fn register_notification_listener(&self) -> Result<(), Error> {
        // Listen for notification dismissal events
        // Handle notification center clearing
        // Respond to action button clicks
    }

    async fn update_live_tile(&self, unread_count: u32) -> Result<(), Error> {
        // Update Windows Live Tile with unread count
        // Show recent message preview in tile
    }
}

#[cfg(target_os = "macos")]
impl MacOSNotificationCenter {
    async fn setup_notification_categories(&self) -> Result<(), Error> {
        // Register notification categories with actions
        // Handle Notification Center interactions
        // Manage notification persistence
    }
}
```

**Platform Features:**
- **Windows**: Notification center persistence, Live Tile updates, Action Center integration
- **macOS**: Notification Center categories, banner/alert styles, Notification scheduling
- **Linux**: Desktop notification daemon integration, custom action support

#### 4.2 Notification History and Management
```rust
// Notification history system
pub struct NotificationHistory {
    pub notifications: HashMap<String, RichNotification>,
    pub dismissed: Vec<String>,
    pub read_receipts: HashMap<String, i64>,
}

impl NotificationHistory {
    async fn cleanup_old_notifications(&mut self) {
        // Remove notifications older than 7 days
        // Archive important notifications (mentions, DMs)
        // Maintain unread state across app restarts
    }

    async fn sync_with_remote(&self) -> Result<(), Error> {
        // Sync read receipts with server
        // Handle cross-device notification dismissal
        // Maintain consistency across devices
    }
}
```

## User Experience Design

### Notification Flow
1. **Event Occurs**: New message, mention, voice invite, etc.
2. **Smart Processing**: Filter, prioritize, group with existing notifications
3. **Rich Rendering**: Display with appropriate actions and content
4. **User Interaction**: Quick actions without opening main app
5. **Result Feedback**: Confirm action with undo option
6. **Cleanup**: Auto-dismiss or move to notification center

### Settings and Customization
```typescript
// User notification preferences
interface NotificationSettings {
  globalEnabled: boolean;

  // Channel-specific settings
  channelSettings: Map<string, ChannelNotificationSetting>;

  // Smart filtering options
  gaming: {
    enabled: boolean;
    detectGames: boolean;
    allowCritical: boolean;
  };

  // Quiet hours
  quietHours: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string;   // "08:00"
    allowEmergency: boolean;
  };

  // Action preferences
  actions: {
    inlineReply: boolean;
    quickReactions: string[]; // preferred emoji
    autoJoinVoice: boolean;
  };
}
```

## Technical Architecture

### Dependencies
```toml
# Cargo.toml additions
tauri-plugin-notification = "2"
notify-rust = "4"
winrt-notification = "0.5" # Windows-specific
mac-notification-sys = "0.5" # macOS-specific

# For Linux notification daemon support
dbus = "0.9"
libnotify-sys = "0.7"
```

### Notification Pipeline
```rust
// Core notification system
pub struct NotificationManager {
    grouper: NotificationGrouper,
    filter: NotificationFilter,
    history: NotificationHistory,
    platform_sender: Box<dyn PlatformNotificationSender>,
}

impl NotificationManager {
    pub async fn send_notification(&mut self, event: ChatEvent) -> Result<(), Error> {
        // 1. Create rich notification from event
        let notification = self.create_notification(event).await?;

        // 2. Apply filters and prioritization
        let filtered = self.filter.apply(notification).await?;

        // 3. Group with existing notifications
        let grouped = self.grouper.process(filtered).await?;

        // 4. Send via platform-specific implementation
        self.platform_sender.send(grouped).await?;

        // 5. Store in history for management
        self.history.add(grouped).await?;

        Ok(())
    }
}
```

## Implementation Plan

### Phase 1: Rich Notification Foundation (2 weeks)
- Rich notification data structures and rendering
- Basic platform-specific notification implementations
- Action button integration and handling

### Phase 2: Smart Management System (2 weeks)
- Notification grouping and prioritization logic
- Smart filtering with context awareness
- Settings UI for user customization

### Phase 3: Advanced Features (2 weeks)
- Inline reply and quick action implementations
- Notification center integration and persistence
- Cross-platform testing and optimization

## Success Criteria

### Functional Requirements
- [ ] Rich notifications with avatars, previews, and actions work on all platforms
- [ ] Smart grouping reduces notification count by 60% without losing information
- [ ] Inline reply and quick actions work without opening main app
- [ ] Notification center integration provides persistent history
- [ ] Gaming mode and DND integration respects user context

### Performance Requirements
- [ ] Notification delivery latency <500ms from server event
- [ ] UI response time for actions <200ms
- [ ] Memory usage <10MB for notification history and management
- [ ] Battery impact negligible during normal notification volume

### Quality Requirements
- [ ] Zero notification delivery failures on stable network
- [ ] Consistent behavior across Windows, macOS, and Linux
- [ ] Accessibility compliance for screen readers and assistive tech
- [ ] Graceful degradation when OS notification features unavailable

## Competitive Analysis

**Discord Advantages:**
- Mature notification system with excellent grouping
- Rich quick actions and inline reply functionality
- Strong OS integration across all platforms
- Smart filtering and context awareness

**Hearth Desktop Opportunities:**
- **Performance**: Faster notification processing with Rust backend
- **Privacy**: Local-first notification history and management
- **Customization**: More granular filtering and action customization
- **Innovation**: AI-powered notification prioritization and smart summaries

This PRD positions Hearth Desktop's notification system as best-in-class, exceeding Discord's capabilities while maintaining the performance advantages of the native Tauri architecture.
# PRD #16: Rich Notifications System

**Status**: Draft
**Priority**: P0 — Critical
**Assignee**: TBD
**Estimated effort**: 2-3 sprints
**Depends on**: Text Messaging (#01), Tray Integration (#14)

## Problem Statement

Hearth Desktop's notification system is basic compared to Discord's rich notification experience. Discord provides interactive notifications with reply buttons, rich message previews, avatar integration, and direct reply functionality without opening the main app. This significantly impacts user engagement and communication efficiency, especially when users are working in other applications or gaming.

## Success Criteria

- [ ] Rich notifications with message previews, avatars, and metadata
- [ ] Direct reply functionality from notifications without opening main window
- [ ] Interactive notification buttons (Reply, Mark as Read, Mute)
- [ ] Notification grouping and conversation threading
- [ ] Per-server/channel notification customization
- [ ] Cross-platform native notification integration
- [ ] Sound customization per notification type
- [ ] Do Not Disturb mode with smart filtering

## Requirements

### Functional Requirements

**Rich Notification Display**
- Message preview with rich text formatting and emoji support
- User avatar and username display in notifications
- Server/channel context information
- Timestamp and message metadata
- Attachment previews (images, files, links)
- Reaction and mention highlighting
- Thread context for threaded messages

**Interactive Actions**
- **Reply Button**: Open quick reply input directly from notification
- **Mark as Read Button**: Dismiss notification and mark channel as read
- **Mute Button**: Temporarily mute notifications from sender/channel
- **View Context**: Open main app to specific message location
- **Join Voice**: Quick join voice channel for voice call notifications

**Direct Reply System**
- Inline text input field in notification popup
- Send messages without opening main application
- Emoji picker access in quick reply
- Mention autocomplete in reply field
- File attachment support in quick replies
- Reply confirmation and error handling

**Notification Management**
- Notification grouping by conversation/channel
- Smart notification bundling (multiple messages from same user)
- Notification persistence across system restarts
- Notification history and replay
- Bulk notification actions (mark all as read, clear all)
- Notification priority levels (urgent, normal, low)

**Customization & Settings**
- Per-server notification settings (all, mentions only, none)
- Per-channel override settings
- Custom notification sounds per server/channel/user
- Notification timing controls (instant, delayed, scheduled)
- Rich vs simple notification mode toggle
- Notification position and display duration settings

### Non-Functional Requirements

**Performance**
- Notification rendering < 200ms from message receipt
- Minimal memory footprint for notification history
- Efficient notification queuing and display management
- Background processing without blocking main UI thread
- Battery-efficient notification polling and display

**User Experience**
- Native OS notification integration and theming
- Smooth animations for notification appearance/dismissal
- Keyboard shortcuts for notification actions
- Screen reader accessibility for all notification elements
- Consistent behavior across all supported platforms

**Platform Integration**
- Windows: Toast notifications with action buttons and inline replies
- macOS: Native Notification Center integration with reply actions
- Linux: libnotify/DBus notifications with desktop environment integration
- Proper theming and appearance matching system preferences

## Technical Specification

### Architecture Overview

```
Message Pipeline ←→ Notification Manager ←→ Platform Handlers ←→ OS Notifications
       ↓                     ↓                      ↓                ↓
Rule Engine ←→ Notification Builder ←→ Action Dispatcher ←→ Quick Reply System
       ↓                     ↓                      ↓                ↓
User Prefs ←→ Template System ←→ Sound Manager ←→ Message Sender
```

### Core Components

**1. Notification Manager**
```rust
pub struct NotificationManager {
    platform_handler: Box<dyn PlatformNotificationHandler>,
    rule_engine: NotificationRuleEngine,
    template_system: NotificationTemplateSystem,
    quick_reply_manager: QuickReplyManager,
}

impl NotificationManager {
    pub fn process_message(&self, message: &Message) -> Result<(), NotificationError>
    pub fn show_notification(&self, notification: &RichNotification) -> Result<String, Error>
    pub fn handle_notification_action(&self, action: NotificationAction) -> Result<(), Error>
    pub fn update_notification_settings(&self, settings: NotificationSettings)
}
```

**2. Rich Notification Builder**
```rust
pub struct RichNotificationBuilder {
    template_engine: TemplateEngine,
    avatar_cache: AvatarCache,
    preview_generator: MessagePreviewGenerator,
}

impl RichNotificationBuilder {
    pub fn build_message_notification(&self, message: &Message) -> RichNotification
    pub fn build_call_notification(&self, call: &VoiceCall) -> RichNotification
    pub fn build_mention_notification(&self, mention: &Mention) -> RichNotification
    pub fn apply_user_preferences(&self, notification: &mut RichNotification, prefs: &UserPrefs)
}
```

**3. Quick Reply System**
```rust
pub struct QuickReplyManager {
    active_sessions: HashMap<String, ReplySession>,
    message_sender: MessageSender,
    emoji_cache: EmojiCache,
}

impl QuickReplyManager {
    pub fn create_reply_session(&mut self, notification_id: &str, channel_id: &str) -> ReplySession
    pub fn send_quick_reply(&self, session: &ReplySession, text: &str) -> Result<(), SendError>
    pub fn handle_reply_input(&self, session_id: &str, input: &str)
    pub fn close_reply_session(&mut self, session_id: &str)
}
```

### Data Models

```typescript
interface RichNotification {
  id: string;
  type: 'message' | 'mention' | 'call' | 'system';
  title: string;
  body: string;
  imageUrl?: string;
  avatarUrl?: string;
  actions: NotificationAction[];
  metadata: NotificationMetadata;
  priority: 'urgent' | 'normal' | 'low';
  groupId?: string;
  soundId?: string;
  expiryTime?: Date;
}

interface NotificationAction {
  id: string;
  label: string;
  type: 'reply' | 'mark_read' | 'mute' | 'join_voice' | 'view_context';
  icon?: string;
  shortcut?: string;
}

interface NotificationMetadata {
  serverId: string;
  channelId: string;
  messageId: string;
  senderId: string;
  timestamp: Date;
  isThread: boolean;
  threadId?: string;
  mentionsUser: boolean;
  hasAttachments: boolean;
}

interface ReplySession {
  id: string;
  channelId: string;
  messageId?: string;  // For threaded replies
  isThread: boolean;
  expiresAt: Date;
}

interface NotificationSettings {
  globalEnabled: boolean;
  showPreviews: boolean;
  playSound: boolean;
  serverSettings: Map<string, ServerNotificationSettings>;
  doNotDisturbSchedule?: DoNotDisturbSchedule;
  priorityOverrides: Map<string, NotificationPriority>;
}
```

### Platform Implementation

**Windows Toast Notifications**
```rust
use windows::ApplicationModel::Background::*;
use windows::UI::Notifications::*;

pub struct WindowsNotificationHandler {
    toast_notifier: ToastNotifier,
    action_handler: ToastActionHandler,
}

impl WindowsNotificationHandler {
    pub fn show_rich_notification(&self, notification: &RichNotification) -> Result<(), Error> {
        let toast_xml = self.build_toast_xml(notification)?;
        let toast = ToastNotification::create_toast_notification(&toast_xml)?;

        // Add action buttons
        for action in &notification.actions {
            toast.add_action_button(&action.id, &action.label)?;
        }

        // Add quick reply input if applicable
        if notification.type == NotificationType::Message {
            toast.add_text_input("reply_input", "Type a message...")?;
        }

        self.toast_notifier.show(&toast)?;
        Ok(())
    }

    pub fn handle_toast_action(&self, action_id: &str, input_data: &str) -> Result<(), Error> {
        match action_id {
            "reply" => self.handle_quick_reply(input_data),
            "mark_read" => self.handle_mark_read(),
            "mute" => self.handle_mute(),
            _ => Ok(())
        }
    }
}
```

**macOS User Notifications**
```rust
use cocoa::appkit::*;
use objc::runtime::*;

pub struct MacOSNotificationHandler {
    notification_center: UNUserNotificationCenter,
    delegate: NotificationDelegate,
}

impl MacOSNotificationHandler {
    pub fn show_rich_notification(&self, notification: &RichNotification) -> Result<(), Error> {
        let content = UNMutableNotificationContent::new();
        content.set_title(&notification.title);
        content.set_body(&notification.body);

        // Add rich attachments
        if let Some(image_url) = &notification.image_url {
            let attachment = self.create_image_attachment(image_url)?;
            content.add_attachment(attachment);
        }

        // Add action buttons
        let mut actions = Vec::new();
        for action in &notification.actions {
            let un_action = UNNotificationAction::action_with_identifier_title_options(
                &action.id, &action.label, UNNotificationActionOptions::None
            );
            actions.push(un_action);
        }

        // Add text input action for replies
        if notification.type == NotificationType::Message {
            let reply_action = UNTextInputNotificationAction::action_with_identifier_title_options_text_input_button_title_text_input_placeholder(
                "reply", "Reply", UNNotificationActionOptions::None, "Send", "Type a message..."
            );
            actions.push(reply_action);
        }

        let category = UNNotificationCategory::category_with_identifier_actions_intent_identifiers_options(
            &notification.type.to_string(), &actions, &[], UNNotificationCategoryOptions::None
        );

        self.notification_center.add_notification_categories(&[category]);
        self.notification_center.add_notification_request(content)?;
        Ok(())
    }
}
```

**Linux Notifications (libnotify/DBus)**
```rust
use dbus::blocking::Connection;
use notify_rust::*;

pub struct LinuxNotificationHandler {
    connection: Connection,
    notification_server: NotificationServer,
}

impl LinuxNotificationHandler {
    pub fn show_rich_notification(&self, notification: &RichNotification) -> Result<(), Error> {
        let mut notify = Notification::new()
            .summary(&notification.title)
            .body(&notification.body)
            .icon(&notification.avatar_url.unwrap_or_default())
            .urgency(self.map_priority_to_urgency(notification.priority))
            .timeout(Timeout::Milliseconds(8000));

        // Add action buttons (desktop environment dependent)
        for action in &notification.actions {
            notify = notify.action(&action.id, &action.label);
        }

        // Handle different desktop environments
        match self.get_desktop_environment() {
            DesktopEnvironment::Gnome => self.show_gnome_notification(notify),
            DesktopEnvironment::KDE => self.show_kde_notification(notify),
            DesktopEnvironment::XFCE => self.show_xfce_notification(notify),
            _ => self.show_generic_notification(notify),
        }
    }
}
```

### Notification Rule Engine

```rust
pub struct NotificationRuleEngine {
    rules: Vec<NotificationRule>,
    user_preferences: UserNotificationPreferences,
    do_not_disturb: DoNotDisturbManager,
}

impl NotificationRuleEngine {
    pub fn should_notify(&self, message: &Message, context: &NotificationContext) -> bool {
        // Check global DND state
        if self.do_not_disturb.is_active() {
            return self.is_urgent_message(message);
        }

        // Apply user preference rules
        for rule in &self.rules {
            if rule.matches(message, context) {
                return rule.action == RuleAction::Allow;
            }
        }

        // Default behavior
        true
    }

    pub fn get_notification_priority(&self, message: &Message) -> NotificationPriority {
        if message.mentions_user {
            NotificationPriority::Urgent
        } else if message.is_dm {
            NotificationPriority::Normal
        } else {
            NotificationPriority::Low
        }
    }
}
```

## Implementation Plan

### Phase 1: Core Rich Notifications (Sprint 1)
- Build notification manager and rule engine infrastructure
- Implement rich notification builder with templates
- Add platform-specific notification handlers for Windows/macOS/Linux
- Create basic notification customization UI
- Integrate with existing message pipeline

### Phase 2: Interactive Actions (Sprint 1-2)
- Implement notification action system (Reply, Mark as Read, Mute)
- Add platform-specific action handling
- Build quick reply input system
- Add notification grouping and conversation threading
- Integrate with voice call notifications

### Phase 3: Direct Reply System (Sprint 2)
- Build inline reply functionality with text input
- Add emoji picker integration for quick replies
- Implement mention autocomplete in reply fields
- Add file attachment support for quick replies
- Error handling and retry logic for failed sends

### Phase 4: Advanced Features (Sprint 2-3)
- Per-server/channel notification customization
- Custom notification sounds and sound management
- Do Not Disturb mode with scheduling
- Notification history and replay functionality
- Smart notification bundling and priority management

### Phase 5: Polish & Testing (Sprint 3)
- Cross-platform testing and platform-specific optimizations
- Performance optimization for notification rendering
- Accessibility improvements and screen reader support
- User onboarding and notification setup wizard
- Integration testing with existing Hearth features

## Testing Strategy

**Functional Testing**
- Test rich notification display across all platforms
- Verify interactive actions work correctly (Reply, Mark as Read, etc.)
- Test quick reply functionality with various message types
- Validate notification grouping and conversation threading
- Test notification customization per server/channel

**Platform Testing**
- Windows: Toast notification integration, action buttons, inline replies
- macOS: Notification Center integration, rich attachments, action handling
- Linux: Various desktop environments (GNOME, KDE, XFCE), DBus integration
- High DPI displays and multiple monitor setups

**Performance Testing**
- Notification rendering latency (target < 200ms)
- Memory usage with large notification history
- Battery impact of notification background processing
- Notification queue handling under high message volume

**User Experience Testing**
- Notification discoverability and intuitiveness
- Quick reply usability and error handling
- Notification sound and visual feedback effectiveness
- Accessibility with screen readers and keyboard navigation

## Success Metrics

- **Feature Adoption**: 70%+ of users enable rich notifications
- **Quick Reply Usage**: 40%+ of replies sent via notification quick reply
- **Performance**: < 200ms notification rendering latency
- **User Satisfaction**: 4.4+ rating for notification experience
- **Platform Coverage**: Full feature parity across Windows/macOS/Linux

## Risks & Mitigations

**Technical Risks**
- *Platform API Limitations*: Graceful fallback to simpler notifications
- *Notification Permission Denied*: Clear permission request flow, fallback strategies
- *Performance Impact*: Efficient notification queuing, background optimization
- *Cross-Platform Consistency*: Platform-specific testing, unified abstraction layer

**User Experience Risks**
- *Notification Overload*: Smart bundling, customizable notification levels
- *Quick Reply Confusion*: Clear UI design, user onboarding
- *Privacy Concerns*: Transparent data handling, privacy-focused defaults

## Related Work

- Discord: Comprehensive rich notifications with direct reply and interactive actions
- Slack: Rich message previews, quick actions, thread notifications
- Microsoft Teams: Toast notifications, quick reply, call notifications
- Telegram: Rich media previews, inline actions, notification grouping

## Future Considerations

- Smart notification filtering using ML for relevance detection
- Voice-to-text quick replies for hands-free operation
- Integration with system focus modes and productivity tools
- Advanced notification analytics and optimization suggestions
- Cross-device notification synchronization and handoff
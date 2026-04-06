# PRD #01: Rich Notification System with Customization

**Status:** Draft  
**Priority:** P0 - Critical  
**Owner:** Desktop Team  
**Created:** 2026-04-06  

## Problem Statement

Hearth Desktop currently has basic system notifications that lack the sophisticated customization and intelligence that users expect from a modern chat application. Discord's notification system allows granular control, intelligent grouping, and contextual awareness that significantly improves user engagement and reduces notification fatigue.

## Success Criteria

- [ ] Users can customize notification settings per-channel, per-server, and per-user
- [ ] Notifications are intelligently grouped and batched to prevent spam
- [ ] Users can set quiet hours and notification scheduling
- [ ] Unread message counts are visible in system tray/dock badges
- [ ] Notification sounds are customizable per event type
- [ ] @mentions and DMs have higher priority than general messages

## User Stories

### As a power user, I want...
- Fine-grained notification controls so I only get alerted for important messages
- Custom notification sounds for different servers/channels
- Quiet hours so I'm not disturbed during work/sleep

### As a casual user, I want...
- Smart defaults that work well without configuration
- Clear visual indicators for unread messages
- Notifications that don't overwhelm me with noise

### As a mobile user (future), I want...
- Consistent notification behavior across desktop and mobile
- Push notification scheduling that respects my timezone

## Technical Requirements

### Core Features
1. **Granular Notification Preferences**
   - Per-server notification levels (all, mentions only, nothing)
   - Per-channel overrides
   - Per-user DM preferences
   - Keyword notification triggers

2. **Notification Batching & Grouping**
   - Group multiple messages from same channel
   - Batch notifications during high-activity periods
   - Collapse older notifications when new ones arrive

3. **Quiet Hours & Scheduling**
   - User-configurable quiet hours
   - Timezone-aware scheduling
   - "Do Not Disturb" mode override

4. **Visual Indicators**
   - Unread badge counts in system tray (cross-platform)
   - Dock badge integration (macOS)
   - Taskbar badge (Windows 10/11)
   - Different colors/styles for mentions vs. general messages

5. **Audio Customization**
   - Custom notification sounds per event type
   - Volume controls for notification audio
   - Sound preview in settings
   - System-default vs. custom sound options

### Technical Implementation

**Backend (Rust/Tauri):**
```rust
// Notification preference data structure
#[derive(Serialize, Deserialize)]
struct NotificationPreferences {
    global_enabled: bool,
    quiet_hours: Option<QuietHours>,
    server_preferences: HashMap<ServerId, ServerNotificationLevel>,
    channel_overrides: HashMap<ChannelId, ChannelNotificationLevel>,
    user_dm_preferences: HashMap<UserId, DmNotificationLevel>,
    keyword_triggers: Vec<String>,
    sounds: SoundPreferences,
}

#[derive(Serialize, Deserialize)]
struct QuietHours {
    enabled: bool,
    start_time: String, // "22:00"
    end_time: String,   // "08:00"
    timezone: String,   // "America/New_York"
    allow_mentions: bool,
    allow_dms: bool,
}
```

**Frontend (Svelte):**
- Settings panel with notification preferences UI
- Real-time preference updates via Tauri commands
- Preview functionality for notification sounds

**Dependencies:**
- `tauri-plugin-notification` (already in use)
- `chrono` for timezone handling
- `rodio` or `cpal` for custom audio playback
- Platform-specific badge APIs (Windows Toast, macOS NSUserNotificationCenter)

### Data Storage
- Notification preferences stored in local SQLite database
- Sync preferences to Hearth backend for cross-device consistency
- Cache recent notification state for smart batching

### Performance Considerations
- Debounce rapid notification triggers (max 1 notification per 3 seconds per channel)
- Efficient unread count calculations
- Background processing for notification scheduling

## Testing Strategy

### Unit Tests
- Notification preference serialization/deserialization
- Quiet hours timezone calculations
- Notification batching logic

### Integration Tests
- Cross-platform notification display
- Badge count accuracy
- Sound playback functionality
- Preference persistence

### Manual Testing
- Test notification behavior during high message volume
- Verify quiet hours work across timezones
- Test all customization options
- Verify accessibility compliance

## Rollout Plan

### Phase 1 (MVP)
- Basic per-channel notification levels
- Quiet hours functionality
- Custom notification sounds
- Unread badge counts

### Phase 2 (Enhanced)
- Keyword triggers
- Advanced batching/grouping
- Rich notification previews
- Cross-device preference sync

### Phase 3 (Advanced)
- Smart notification timing based on user activity
- Machine learning for notification importance
- Integration with OS focus/Do Not Disturb modes

## Success Metrics

- **User Engagement:** 40% reduction in notification-related user complaints
- **Adoption:** 80% of users customize at least one notification setting
- **Retention:** 15% improvement in daily active users (attributed to better notification experience)
- **Performance:** Notification delivery within 500ms of message receipt
- **Cross-platform:** Feature parity across Windows, macOS, Linux

## Dependencies & Risks

### Dependencies
- Hearth backend API for real-time message events
- OS-specific notification and badge APIs
- Timezone database for quiet hours

### Risks
- **OS API limitations:** Some platforms may not support all badge/notification features
- **Performance impact:** Complex notification logic could slow message processing
- **User confusion:** Too many options might overwhelm casual users

### Mitigation
- Graceful degradation for unsupported OS features
- Performance profiling during development
- Smart defaults with progressive disclosure UI

## Open Questions

1. Should notification preferences sync across devices immediately or eventually?
2. How should we handle notification permissions on different OS platforms?
3. Should we support notification scheduling for future messages?
4. How granular should keyword triggers be (regex support, case sensitivity, etc.)?

## References

- Discord notification system behavior analysis
- Slack notification preferences for enterprise features
- Telegram notification customization as mobile-first example
- OS notification guidelines (Windows, macOS, Linux)
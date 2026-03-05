# Desktop Notification Patterns Research

**Research Date:** March 5, 2026  
**Focus Area:** Desktop notification patterns for messaging apps  
**Applications Studied:** Discord, Slack, Element (via Tauri/Electron patterns)  
**Target Platform:** Tauri 2.x

---

## Executive Summary

Desktop notifications are **critical** for a messaging app like Hearth. Users expect:
1. Real-time notification delivery when messages arrive
2. Notification grouping/threading for high-volume channels
3. Per-channel/per-conversation mute controls
4. Badge counts on dock/taskbar icons (unread messages)
5. Interactive notifications (reply directly, mark as read)
6. Sound customization and DND (Do Not Disturb) modes
7. Focus Assist/Focus Mode integration (Windows/macOS)

**Key Challenge:** Tauri 2.x has excellent notification support but **no native badge count API** (unlike Electron's `app.badgeCount`). This is a known limitation ([#6571](https://github.com/tauri-apps/tauri/issues/6571)).

---

## Tauri 2.x Notification API

### Plugin: `tauri-plugin-notification`

**Documentation:** https://v2.tauri.app/plugin/notification/

**Platform Support:**
- ✅ Windows (requires installed app; shows PowerShell icon in dev)
- ✅ macOS
- ✅ Linux
- ✅ Android
- ✅ iOS

### Core Features

#### 1. Permission Management
```typescript
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

// Check permission first
let permissionGranted = await isPermissionGranted();

if (!permissionGranted) {
  const permission = await requestPermission();
  permissionGranted = permission === 'granted';
}
```

**Implementation Note:** Request permissions on first app launch or when user enables notifications in settings.

#### 2. Basic Notifications
```typescript
sendNotification({
  title: 'New Message from Alice',
  body: 'Hey, are you free for lunch?',
  icon: 'asset:///icons/user-alice.png', // Optional
});
```

**Best Practice:** Include sender name/avatar in notification for quick identification.

#### 3. Interactive Notifications (Actions)

**Excellent for messaging apps** - users can reply, mark as read, or delete without opening the app.

```typescript
import { registerActionTypes, onAction } from '@tauri-apps/plugin-notification';

// Register action types (do this once at app startup)
await registerActionTypes([
  {
    id: 'message',
    actions: [
      {
        id: 'reply',
        title: 'Reply',
        input: true,
        inputButtonTitle: 'Send',
        inputPlaceholder: 'Type your reply...',
        foreground: false, // Don't bring app to foreground
      },
      {
        id: 'mark-read',
        title: 'Mark as Read',
        foreground: false,
      },
      {
        id: 'view',
        title: 'View',
        foreground: true, // Bring app to foreground
      },
    ],
  },
]);

// Listen for action callbacks
await onAction(async (notification) => {
  console.log('User action:', notification);
  
  if (notification.actionId === 'reply' && notification.input) {
    // Send reply via WebSocket
    await sendMessage(notification.channelId, notification.input);
  } else if (notification.actionId === 'mark-read') {
    await markChannelAsRead(notification.channelId);
  }
});
```

**Action Properties:**
- `requiresAuthentication`: Requires device unlock (iOS/Android)
- `foreground`: Brings app to foreground when triggered
- `destructive`: Shows action in red (iOS)
- `input`: Enables inline text input
- `inputButtonTitle`: Button text for input submit
- `inputPlaceholder`: Placeholder text

**Hearth Implementation:**
- **Reply**: Inline text input, sends message via WebSocket, stays in background
- **Mark as Read**: Marks conversation read, updates badge count
- **View**: Opens app to specific conversation

#### 4. Attachments

Add images/avatars to notifications for richer context.

```typescript
sendNotification({
  title: 'Alice sent a photo',
  body: 'Check out this picture',
  attachments: [
    {
      id: 'photo-1',
      url: 'asset:///cache/photo-123.jpg', // or file://
    },
  ],
});
```

**Platform Notes:** Test on each OS - support varies. macOS/iOS have best support.

#### 5. Channels (Android-first, but useful for organization)

Group notifications by type with different behaviors.

```typescript
import { createChannel, Importance, Visibility } from '@tauri-apps/plugin-notification';

// Create channel for DMs
await createChannel({
  id: 'direct-messages',
  name: 'Direct Messages',
  description: 'Notifications for direct messages',
  importance: Importance.High,
  visibility: Visibility.Private,
  lights: true,
  lightColor: '#5865F2',
  vibration: true,
  sound: 'dm_sound.wav',
});

// Create channel for mentions
await createChannel({
  id: 'mentions',
  name: 'Mentions & Replies',
  description: 'When someone mentions you',
  importance: Importance.High,
  visibility: Visibility.Public,
  sound: 'mention_sound.wav',
});

// Create channel for other messages (lower priority)
await createChannel({
  id: 'messages',
  name: 'Messages',
  description: 'Regular channel messages',
  importance: Importance.Default,
  sound: 'message_sound.wav',
});

// Send notification to channel
sendNotification({
  title: '@alice mentioned you',
  body: '@Bob check this out',
  channelId: 'mentions',
});
```

**Hearth Channel Strategy:**
1. **Direct Messages**: High importance, private, custom sound
2. **Mentions & Replies**: High importance, public, custom sound
3. **Channel Messages**: Default importance, public, optional sound
4. **System Notifications**: Low importance, no sound

#### 6. Sound Support

**Platform-specific sound handling:**

```typescript
import { platform } from '@tauri-apps/api/os';

async function sendNotificationWithSound(title: string, body: string) {
  const platformName = await platform();
  
  let sound: string;
  if (platformName === 'darwin') {
    sound = 'Ping'; // macOS system sound
  } else if (platformName === 'linux') {
    sound = 'message-new-instant'; // XDG theme sound
  } else {
    sound = 'notification.wav'; // Windows: custom file
  }
  
  sendNotification({
    title,
    body,
    sound,
  });
}
```

**Sound Locations:**
- **macOS:** System sounds (Ping, Glass, Hero, etc.) or app bundle
- **Linux:** XDG theme sounds or file paths
- **Windows:** File paths to `.wav` files

**Hearth Implementation:**
- Bundle custom sounds (DM, mention, message) in `src-tauri/resources/`
- Let users customize sounds in settings
- Respect system DND/Focus modes

---

## Notification Best Practices (Discord/Slack Patterns)

### 1. Notification Grouping & Throttling

**Problem:** High-volume channels flood users with notifications.

**Discord/Slack Solution:**
- Group multiple messages from same channel within 5-10 seconds
- Show "Alice sent 5 messages in #general" instead of 5 separate notifications
- Collapse notifications when app is in foreground

**Hearth Implementation:**
```typescript
class NotificationManager {
  private pendingNotifications = new Map<string, PendingNotification[]>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  
  async queueNotification(channelId: string, message: Message) {
    // Don't notify if app is focused and channel is open
    if (await isAppFocused() && currentChannel === channelId) {
      return;
    }
    
    // Group notifications by channel
    if (!this.pendingNotifications.has(channelId)) {
      this.pendingNotifications.set(channelId, []);
    }
    
    this.pendingNotifications.get(channelId)!.push(message);
    
    // Debounce: wait 5 seconds for more messages
    if (this.debounceTimers.has(channelId)) {
      clearTimeout(this.debounceTimers.get(channelId)!);
    }
    
    this.debounceTimers.set(channelId, setTimeout(() => {
      this.flushNotifications(channelId);
    }, 5000));
  }
  
  async flushNotifications(channelId: string) {
    const messages = this.pendingNotifications.get(channelId) || [];
    if (messages.length === 0) return;
    
    const channel = await getChannel(channelId);
    
    if (messages.length === 1) {
      // Single message: show detailed notification
      const msg = messages[0];
      sendNotification({
        title: `${msg.author.name} in #${channel.name}`,
        body: msg.content,
        channelId,
        actionTypeId: 'message',
      });
    } else {
      // Multiple messages: show grouped notification
      sendNotification({
        title: `${messages.length} new messages in #${channel.name}`,
        body: messages.map(m => `${m.author.name}: ${m.content.substring(0, 50)}`).join('\n'),
        channelId,
        actionTypeId: 'message',
      });
    }
    
    this.pendingNotifications.delete(channelId);
    this.debounceTimers.delete(channelId);
  }
}
```

### 2. Mute Controls

**Discord/Slack Patterns:**
- Per-channel mute (indefinite or timed)
- Per-server/workspace mute
- Suppress @everyone/@channel by default (opt-in)
- "Only notify for mentions" mode

**Hearth Implementation:**
```typescript
interface NotificationSettings {
  // Global
  enabled: boolean;
  focusMode: boolean; // DND mode
  
  // Per-channel overrides
  channelMutes: {
    [channelId: string]: {
      muted: boolean;
      muteUntil?: Date; // null = indefinite
      onlyMentions?: boolean;
    };
  };
  
  // Per-server overrides (if Hearth has servers)
  serverMutes: {
    [serverId: string]: {
      muted: boolean;
      onlyMentions?: boolean;
    };
  };
}

function shouldNotify(message: Message, settings: NotificationSettings): boolean {
  if (!settings.enabled || settings.focusMode) return false;
  
  // Check channel mute
  const channelMute = settings.channelMutes[message.channel_id];
  if (channelMute) {
    if (channelMute.muted) {
      if (channelMute.muteUntil && new Date() > channelMute.muteUntil) {
        // Mute expired, clear it
        delete settings.channelMutes[message.channel_id];
      } else {
        return false;
      }
    }
    
    if (channelMute.onlyMentions && !message.mentions.includes(currentUserId)) {
      return false;
    }
  }
  
  // Check server mute (if applicable)
  // ...
  
  return true;
}
```

### 3. Badge Count (Dock/Taskbar Icon)

**Electron apps use:** `app.setBadgeCount(count)`

**Tauri 2.x:** ❌ No native API ([#6571](https://github.com/tauri-apps/tauri/issues/6571))

**Workaround Options:**
1. **macOS:** Use `NSUserNotificationCenter` via Rust bindings
2. **Windows:** Custom taskbar overlay icon (complex)
3. **Linux:** Desktop entry badge (depends on DE)

**Recommendation for Hearth:**
- Track unread count in app state
- Show unread count in window title: `(5) Hearth - #general`
- File feature request for native Tauri badge support
- Consider Electron for v2 if badge counts are critical

### 4. Focus Assist / Focus Mode Integration

**macOS:** Check `NSUserNotificationCenter` focus status  
**Windows:** Check Focus Assist state via Windows API  
**Linux:** Check DND status via D-Bus

**Tauri Implementation (macOS example):**
```rust
use cocoa::appkit::NSWorkspace;
use objc::{runtime::Object, msg_send, sel, sel_impl};

#[tauri::command]
fn is_focus_mode_enabled() -> bool {
    unsafe {
        let workspace: *mut Object = msg_send![class!(NSWorkspace), sharedWorkspace];
        let notification_center: *mut Object = msg_send![workspace, notificationCenter];
        let focus_mode: bool = msg_send![notification_center, focusModeEnabled];
        focus_mode
    }
}
```

**Respect system focus modes:**
- Don't send notifications when Focus Assist/DND is active
- OR: only send high-priority notifications (DMs, mentions)

---

## Recommended Notification Architecture for Hearth

```
WebSocket Event (new message)
          ↓
   NotificationManager.queue(message)
          ↓
  Check: shouldNotify(message, settings)
    - Is app focused on this channel? → Skip
    - Is channel muted? → Skip
    - Is focus mode active? → Skip (or high-priority only)
    - Is user mentioned? → High priority
          ↓
   Debounce & Group (5-second window)
          ↓
  Flush: sendNotification()
    - Attach actions (Reply, Mark Read, View)
    - Include sender avatar (attachment)
    - Use appropriate channel (DM vs mention vs message)
    - Play sound (if not muted)
          ↓
   Listen: onAction()
    - Reply → send via WebSocket
    - Mark Read → update state, sync server
    - View → focus app window, navigate to channel
```

### State Management

Store notification settings in:
1. **Local:** `~/.local/share/hearth/notification_settings.json` (Tauri store plugin)
2. **Server:** Sync preferences across devices via API

### WebSocket Integration

```typescript
// In WebSocket message handler
socket.on('message.create', async (message: Message) => {
  // Update local state
  store.addMessage(message);
  
  // Queue notification
  await notificationManager.queueNotification(message.channel_id, message);
  
  // Update unread count
  if (message.author.id !== currentUserId) {
    store.incrementUnreadCount(message.channel_id);
    updateBadgeCount(); // Title bar workaround for now
  }
});
```

---

## Implementation Checklist

### Phase 1: Basic Notifications ✅ (Target: Sprint 1)
- [ ] Install `tauri-plugin-notification`
- [ ] Request permission on first launch
- [ ] Send basic notification on new message (title + body)
- [ ] Test on macOS, Windows, Linux

### Phase 2: Interactive Notifications (Target: Sprint 2)
- [ ] Register action types (Reply, Mark Read, View)
- [ ] Implement `onAction` handler
- [ ] Wire up Reply → WebSocket send
- [ ] Wire up Mark Read → state update
- [ ] Wire up View → focus window + navigate

### Phase 3: Grouping & Throttling (Target: Sprint 3)
- [ ] Implement NotificationManager with debouncing
- [ ] Group notifications per channel (5-second window)
- [ ] Suppress notifications when app is focused on channel
- [ ] Test high-volume channels

### Phase 4: Mute Controls (Target: Sprint 4)
- [ ] Add notification settings UI
- [ ] Per-channel mute (indefinite + timed)
- [ ] "Only mentions" mode
- [ ] Global DND mode
- [ ] Persist settings to Tauri store

### Phase 5: Advanced Features (Target: Sprint 5+)
- [ ] Custom sounds (DM, mention, message)
- [ ] Sender avatars in notifications (attachments)
- [ ] Channels (DM, Mention, Message priorities)
- [ ] Focus mode detection (macOS/Windows/Linux)
- [ ] Badge count workaround (title bar)

### Phase 6: Polish (Target: Sprint 6+)
- [ ] Notification preview in settings
- [ ] Sound picker UI
- [ ] Notification history/log
- [ ] Analytics: notification engagement rates

---

## Known Limitations

1. **No native badge count API** - Workaround: title bar `(5) Hearth`
2. **Windows dev mode shows PowerShell** - Only affects dev, production OK
3. **Attachment support varies by platform** - Test thoroughly
4. **Sound paths are platform-specific** - Abstract with helper function

---

## References

- [Tauri Notification Plugin Docs](https://v2.tauri.app/plugin/notification/)
- [Tauri Plugin GitHub](https://github.com/tauri-apps/tauri-plugin-notification)
- [Badge Count Issue #6571](https://github.com/tauri-apps/tauri/issues/6571)
- [Slack Notification Strategy](https://dispatch.m.io/slack-notification-strategy/)
- [Discord Notification Patterns](https://support.discord.com/hc/en-us/articles/215253258-Notifications-Settings-101) (from experience)

---

## Next Steps

1. **Prototype Phase 1** (basic notifications) in next sprint
2. **User testing:** Get feedback on notification frequency/noise
3. **Research badge count solutions:** File Tauri feature request or consider custom native module
4. **Monitor Tauri updates:** Badge count API may be added in future releases

**Estimated Effort:**
- Phase 1-2: 2-3 days
- Phase 3-4: 3-4 days
- Phase 5-6: 5-7 days
- **Total:** ~2 weeks for full notification system

---

**Compiled by:** Data (Research Agent)  
**Next Research Topic:** System Tray UX and Menus (for background running + quick actions)

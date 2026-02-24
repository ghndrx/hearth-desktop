# Desktop Notification Patterns for Hearth

**Research Date:** February 24, 2026  
**Focus:** Desktop notification UX patterns from Discord, Slack, and Tauri 2.x capabilities

---

## Executive Summary

Desktop notifications are the primary way Hearth will keep users informed about new messages, mentions, and reminders while they're away from the app. This research covers:
- Tauri 2.x notification plugin capabilities
- Patterns from Slack and Discord
- UX best practices to avoid notification fatigue

---

## 1. Tauri 2.x Notification Plugin

### Installation
```bash
npm run tauri add notification
```

### Core API

```typescript
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

// Permission flow
let permissionGranted = await isPermissionGranted();
if (!permissionGranted) {
  const permission = await requestPermission();
  permissionGranted = permission === 'granted';
}

// Send notification
if (permissionGranted) {
  sendNotification({ title: 'Hearth', body: 'New message from @greg' });
}
```

### Platform Notes
| Platform | Notes |
|----------|-------|
| Windows | Only works for installed apps. Shows PowerShell name & icon in development |
| macOS | Full support, use system sounds like `'Ping'` |
| Linux | Uses XDG theme sounds like `'message-new-instant'` |

### Actions (Interactive Buttons)
```typescript
import { registerActionTypes, onAction } from '@tauri-apps/plugin-notification';

await registerActionTypes([
  {
    id: 'messages',
    actions: [
      {
        id: 'reply',
        title: 'Reply',
        input: true,
        inputButtonTitle: 'Send',
        inputPlaceholder: 'Type your reply...',
      },
      {
        id: 'mark-read',
        title: 'Mark as Read',
        foreground: false,  // Doesn't bring app to foreground
      },
    ],
  },
]);

// Listen for action responses
await onAction((notification) => {
  console.log('User action:', notification);
});
```

### Action Properties
| Property | Description |
|----------|-------------|
| `requiresAuthentication` | Requires device auth (Face ID, etc.) |
| `foreground` | Brings app to foreground when triggered |
| `destructive` | Shows action in red (iOS) |
| `input` | Enables inline text input |

### Attachments (Images/Media)
```typescript
sendNotification({
  title: 'New Image',
  body: 'Check out this picture',
  attachments: [
    {
      id: 'image-1',
      url: 'asset:///notification-image.jpg',  // or file://
    },
  ],
});
```

### Channels (Android + Cross-Platform)
```typescript
import { createChannel, Importance, Visibility } from '@tauri-apps/plugin-notification';

await createChannel({
  id: 'messages',
  name: 'Messages',
  description: 'Notifications for new messages',
  importance: Importance.High,
  visibility: Visibility.Private,
  vibration: true,
  sound: 'notification_sound',
});

// Use channel
sendNotification({
  title: 'New Message',
  body: 'You have a new message',
  channelId: 'messages',
});
```

### Permission Set (capabilities.json)
```json
{
  "permissions": [
    "notification:default"
  ]
}
```

The default permission grants all notification features.

---

## 2. Slack Notification Patterns

### Notification Triggers (Default)
1. **Direct messages** - Always notify
2. **Thread replies** (when following) - Always notify
3. **@mentions** - Always notify
4. **Channel mentions** (@channel, @here) - Notify
5. **Keywords** - User-configurable words to watch for

### Visual Indicators

#### Banner Notifications
- Show sender + conversation name
- Configurable sound
- Message preview toggle (privacy)

#### Sidebar Indicators
- **Bold text** = Unread activity
- **Numbered badge** = Direct mention/DM

#### App Icon Badges
| Platform | Unread | Mention/DM |
|----------|--------|------------|
| macOS | Red dot | Red number |
| Windows Taskbar | - | Red badge |
| Windows Tray | Blue badge | Red badge |
| Linux Tray | Blue badge | Red badge |

### Key UX Features

#### Do Not Disturb (DND)
- Quick snooze: 30min, 1hr, 2hr, custom
- Scheduled quiet hours
- DND respects "urgent" override

#### Notification Modes
- **All new messages** (default for quiet channels)
- **@mentions only** (recommended for busy channels)
- **Nothing** (mute)

#### Adaptive Frequency
Slack adapts notification level based on channel activity:
- New/quiet channels: Notify on all messages
- Active channels: Recommend switching to @mentions only

#### Mobile vs Desktop
- Different notification settings per device
- Configurable delay before mobile notifications fire
- "When inactive on desktop" option

---

## 3. Discord Notification Patterns

### Tray Icon States
| Badge Color | Meaning |
|-------------|---------|
| **Red** | Mentions, DMs, keywords, thread replies |
| **Blue/Grey** | Unread channel messages |
| **None** | All caught up |

### User Feedback (Pain Points)
- Users want differentiation between "someone's chatting" vs "someone needs me"
- Red badge for all unreads causes notification fatigue
- Request: Grey for unread, Red for mentions/DMs

### Per-Server Settings
- All messages
- @mentions only
- Nothing (mute server)
- Suppress @everyone and @here
- Suppress role mentions

### Smart Notifications
- DMs always trigger
- Server @mentions configurable
- Role-specific notification control

---

## 4. UX Best Practices

### Severity Levels (Sara Vilas / Toptal)

#### High Attention
- **Alerts** - Immediate attention required
- **Errors** - Immediate action required
- **Confirmations** - Destructive actions needing confirmation

#### Medium Attention
- **Warnings** - No immediate action
- **Acknowledgments** - Feedback on user actions
- **Success messages**

#### Low Attention
- **Informational** - Something ready to view
- **Badges** - New since last interaction
- **Status indicators**

### Notification Fatigue Prevention

1. **Less is more** - Facebook study showed reducing notifications improved user satisfaction AND long-term usage
2. **Start slow** - Default to low frequency, increase based on user engagement
3. **Group notifications** - "John and 4 others liked..." rather than individual notifications
4. **Notification modes** - Calm / Regular / Power User presets
5. **Summary mode** - Daily/weekly digest instead of real-time

### Onboarding Best Practice (Basecamp)
Ask during onboarding:
- "Always On" - Notifications as they occur
- "Work Can Wait" - Specific hours/days only

### Snooze/Pause Options
- Quick snooze: 30min, 1hr, 2hr
- "Until tomorrow"
- Custom schedule
- Consider auto-suggesting mute during high-volume events

---

## 5. Hearth Implementation Recommendations

### Notification Categories

```typescript
enum HearthNotificationChannel {
  DIRECT_MESSAGE = 'direct_message',    // High priority
  MENTION = 'mention',                   // High priority  
  THREAD_REPLY = 'thread_reply',         // Medium priority
  ROOM_MESSAGE = 'room_message',         // Low priority (opt-in)
  REMINDER = 'reminder',                 // High priority
  SYSTEM = 'system',                     // Low priority
}
```

### Badge Strategy

| Indicator | Trigger |
|-----------|---------|
| **Red badge + number** | DMs, @mentions |
| **Blue dot** | Unread channel messages |
| **Tray icon change** | Same rules |

### Default Settings (Conservative)

```typescript
const defaultNotificationSettings = {
  dm: 'all',           // Always notify
  mention: 'all',      // Always notify
  threadReply: 'all',  // Always notify (following)
  roomMessage: 'none', // Opt-in per room
  reminder: 'all',     // Always notify
  system: 'badge',     // Badge only, no push
  
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
  
  sound: true,
  showPreview: true,   // Privacy toggle
};
```

### Inline Actions for Desktop

```typescript
const hearthNotificationActions = [
  {
    id: 'dm_reply',
    actions: [
      { id: 'reply', title: 'Reply', input: true, inputPlaceholder: 'Type reply...' },
      { id: 'mark-read', title: 'Mark Read', foreground: false },
    ],
  },
  {
    id: 'reminder',
    actions: [
      { id: 'complete', title: 'Complete', foreground: false },
      { id: 'snooze', title: 'Snooze 1hr', foreground: false },
    ],
  },
];
```

### Sounds (Platform-Specific)

```typescript
async function getNotificationSound(type: 'dm' | 'mention' | 'reminder') {
  const platform = await tauriPlatform();
  
  const sounds = {
    darwin: { dm: 'Ping', mention: 'Glass', reminder: 'Purr' },
    linux: { dm: 'message-new-instant', mention: 'bell', reminder: 'alarm-clock-elapsed' },
    win32: { dm: 'notification.wav', mention: 'mention.wav', reminder: 'reminder.wav' },
  };
  
  return sounds[platform][type];
}
```

### Settings UI Structure

```
Notifications
├── Direct Messages
│   └── [All / Badge only / None]
├── Mentions
│   └── [All / Badge only / None]
├── Thread Replies
│   └── [Following / All / None]
├── Room Messages
│   └── Per-room settings...
├── Reminders
│   └── [All / None]
├── Quiet Hours
│   ├── [Enabled/Disabled]
│   ├── Start time
│   └── End time
├── Sound
│   └── [Enabled/Disabled]
└── Show Message Preview
    └── [Enabled/Disabled]
```

---

## 6. Implementation Checklist

### Phase 1: Core
- [ ] Add tauri-plugin-notification
- [ ] Request permission on first DM/mention
- [ ] Basic notification for DMs and mentions
- [ ] Badge on app icon (unread count)

### Phase 2: Polish
- [ ] Notification actions (Reply, Mark Read)
- [ ] Platform-specific sounds
- [ ] Message preview toggle
- [ ] Quiet hours

### Phase 3: Advanced
- [ ] Per-room notification settings
- [ ] Notification channels (Android)
- [ ] Adaptive frequency (like Slack)
- [ ] Notification grouping/summary

---

## References

- [Tauri 2.x Notification Plugin](https://v2.tauri.app/plugin/notification/)
- [Slack Notification Guide](https://slack.com/help/articles/360025446073-Guide-to-Slack-notifications)
- [Design Guidelines for Better Notifications UX - Smashing Magazine](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/)
- [How Slack Decides to Send a Notification](https://whimsical.com/how-slack-decides-to-send-a-notification-P53PjXCBWEi2fdMjP2Hti)
- [Facebook: Why Less is More](https://medium.com/@AnalyticsAtMeta/notifications-why-less-is-more-how-facebook-has-been-increasing-both-user-satisfaction-and-app-9463f7325e7d)

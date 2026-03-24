# PRD: Advanced Notifications with Inline Actions

## Overview

Upgrade Hearth Desktop notifications from basic alerts to Discord-grade rich notifications: inline reply, action buttons (Mute, Join Call), mention highlighting, and notification grouping per channel/server.

## Problem Statement

Discord notifications are action-first: you can reply inline without opening the app, click "Join Call" to enter a voice channel, and dismiss notifications per-channel. Hearth currently has `show_notification` which fires plain text alerts. For a chat app, notification UX is a **top-3 differentiator** — users decide whether to keep an app based on how it handles interruptions.

## Goals

- Inline reply directly from the notification (macOS Notification Center, Windows Action Center)
- Action buttons: "Mute Channel", "Mark Read", "Join" (context-aware)
- Notification grouping: thread parent + replies collapsed
- @mention and @here/@all visual markers in notification body
- Per-channel notification settings (all messages, mentions only, nothing)
- "Do Not Disturb" / focus mode sync across desktop

## User Stories

| As a user | I want to | so that |
|-----------|-----------|---------|
| Mobile user (replying on desktop) | Reply to a message from notification | I don't need to open the app |
| Busy professional | Click "Mute #engineering" from a notification | I can silence a channel without hunting for settings |
| Active caller | Click "Join Call" from a notification | I can enter voice immediately |
| Power user | @mention highlights in notification preview | I know if I'm directly addressed |

## Technical Approach

### Platform-Specific Implementation

**macOS (Notification Center)**
- Use `tauri-plugin-notification` with `notification::Notification` and action buttons
- Register notification category with actions via Tauri command
- Handle `on_notification_action` event to dispatch reply/mute/join

**Windows (Action Center)**
- Windows notifications support up to 3 buttons via `toast` XML
- Use `set_app_user_model_id` for proper grouping
- Inline reply via `textBox` input element in toast XML

**Linux**
- Desktop notifications via `libnotify` (freedesktop.org spec)
- Action buttons supported by most DEs (GNOME, KDE, XFCE)
- Inline reply less broadly supported; implement as action button + quick compose

### Notification Payload
```json
{
  "title": "#engineering — @alice mentioned you",
  "body": "alice: Can someone review the Tauri PR?",
  "icon": "channel-icon.png",
  "channelId": "ch_eng_01",
  "serverId": "srv_hearth",
  "messageId": "msg_abc123",
  "actions": [
    { "id": "reply", "label": "Reply" },
    { "id": "mute", "label": "Mute Channel" },
    { "id": "markread", "label": "Mark Read" }
  ],
  "replyPlaceholder": "Reply to #engineering…"
}
```

### Per-Channel Notification Settings (Store Schema)
```json
{
  "notificationPrefs": {
    "default": "mentions",  // "all" | "mentions" | "nothing"
    "channels": {
      "ch_eng_01": "all",
      "ch_random": "mentions",
      "ch_announce": "nothing"
    }
  }
}
```

## Milestones

| Milestone | Deliverable |
|-----------|-------------|
| M1 | Basic rich notification (title, body, icon, channel tag) |
| M2 | Action buttons (mute, mark read) — all platforms |
| M3 | Inline reply via notification (macOS + Windows) |
| M4 | Per-channel notification settings UI |
| M5 | DND / focus mode integration |

## Dependencies

- `tauri-plugin-notification` (already present)
- `tauri-plugin-store` (already present)
- No new plugins; use platform notification APIs

## Priority: P1
**Estimated Effort**: 3 sprints (6 weeks)
**Owner**: Desktop Team

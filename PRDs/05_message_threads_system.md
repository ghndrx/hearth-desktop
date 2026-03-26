# PRD: Message Threads

## Overview

**Priority**: P1 (High)
**Timeline**: 3-5 weeks
**Owner**: Frontend Team

Implement threaded messaging to allow side conversations within channels without disrupting the main channel flow — a core Discord feature Hearth Desktop lacks.

## Problem Statement

Threads are essential for keeping long channels organized. Discord's thread feature allows users to start a thread from any message, creating a dedicated sub-conversation. Without threads, Hearth Desktop channels become cluttered and hard to follow.

**Current Gap**: Discord supports thread creation, thread archives, thread members, and thread notifications. Hearth Desktop has no thread concept in its text messaging system.

## User Stories

- As a user, I want to start a thread from any message so I can discuss a specific topic without derailing the channel
- As a user, I want to see active threads in a channel so I can join conversations I care about
- As a user, I want to archive threads when they're done so the channel stays clean
- As a user, I want to receive thread-specific notifications so I don't miss replies

## Technical Approach

### Thread Architecture

Threads are a first-class resource in the Hearth API. Each thread belongs to a parent channel and has its own message list.

### API Design

```
POST   /channels/:channelId/threads          — create thread from message
GET    /channels/:channelId/threads          — list active threads in channel
GET    /threads/:threadId/messages           — get thread messages
POST   /threads/:threadId/messages           — send message to thread
PATCH  /threads/:threadId                    — update thread (name, archive)
DELETE /threads/:threadId                    — delete thread
POST   /threads/:threadId/join               — join thread
POST   /threads/:threadId/leave              — leave thread
```

### Data Model

```typescript
interface Thread {
  id: string;
  channelId: string;           // parent channel
  parentMessageId: string;     // message that started the thread
  name: string;                // thread name (auto-generated or user-set)
  createdAt: string;
  createdBy: string;
  isArchived: boolean;
  autoArchiveAfter?: number;   // minutes until auto-archive (Discord: 60, 1440, 4320, 10080)
  messageCount: number;
  memberCount: number;
}

interface ThreadMember {
  threadId: string;
  odId: string;
  joinedAt: string;
  notificationPreference: 'all' | 'mentions' | 'none';
}
```

### UI Components

1. **Thread Pillar** — Right sidebar (or dedicated panel) listing active threads in current channel
2. **Thread Header** — When inside a thread: shows thread name, members, archive button
3. **Thread Message List** — Separate scrollable message list for the thread
4. **Start Thread Button** — Appears on hover of any message (reply icon → "Start thread")
5. **Thread Notification Badge** — Badge on thread in pillar indicating unread activity

### Thread Layout

```
┌─────────────────────────────────────────┬──────────────┐
│ #channel-name                           │ Thread Pillar │
│ ─────────────────────────────────────── │ ───────────── │
│ [message]                               │ Active Threads│
│ [message]        ← "Start thread" btn   │ ─────────────  │
│ [message]                               │ 📌 Off-topic  │
│                                         │    12 msgs    │
│ ┌── Thread: Off-topic ──────────────┐   │ 📌 API design │
│ │  [thread message]                 │   │    8 msgs     │
│ │  [thread message]                 │   │               │
│ │  [thread reply input]             │   │               │
│ └───────────────────────────────────┘   │               │
└─────────────────────────────────────────┴──────────────┘
```

### Auto-Archive Logic

- Default: 60 minutes of inactivity → auto-archive
- Configurable: 1 hour, 24 hours, 3 days, 7 days
- Archived threads: moved to "Archived" section in pillar, read-only

## Feature Scope

### In Scope
- Create thread from any message
- Thread pillar showing active threads per channel
- Thread message list (separate from channel)
- Reply to thread (same as channel messages)
- Thread name editing
- Manual archive/unarchive
- Auto-archive after inactivity
- Join/leave thread
- Thread notification preferences
- Unread indicators for threads

### Out of Scope (v1)
- Threaded messages (replies within a thread, nested)
- Public threads in private channels
- Thread slow mode

## Dependencies

- PRD #1 (Text Messaging System) — threads build on the message system
- Hearth API must support thread endpoints (coordinate with backend team)

## Testing Plan

- Unit: thread creation mutates correct channel state
- Integration: thread messages sync in real-time via WebSocket
- Manual: 50+ messages in a thread, auto-archive timer fires correctly

## Open Questions

- Should threads persist in the Hearth API or be client-side-only summaries?
- Do we need a separate WebSocket event type for thread activity?
- What's the max thread name length? (Discord: 100 chars)
- How do we handle thread mentions in push notifications?

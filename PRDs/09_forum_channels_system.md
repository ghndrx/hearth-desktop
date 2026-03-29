# PRD: Forum Channels System

## Overview

**Priority**: P1
**Timeline**: 4-6 weeks
**Owner**: Frontend / Backend / Design

Implement Forum Channels — structured discussion spaces where members create Posts organized by Tags, replacing chaotic message streams with curated, searchable conversations. Forum Channels are the single highest-value community-engagement feature missing from Hearth Desktop.

## Problem Statement

Hearth Desktop has Message Threads (#05) for ephemeral side conversations, but lacks **Forum Channels** — permanent, structured discussion spaces distinct from linear chat channels. Discord Forum Channels generate 3× more engagement than standard text channels (source: Discord 2024 community report). Without forums, Hearth communities fall back to chaotic scrolling through thousands of messages to find relevant discussions.

## Goals

### Primary Goals
- Create Forum Channels that persist as permanent fixtures in a server's channel list
- Allow members to create **Posts** (topic-starters) within a forum
- Organize Posts via **Tags** (e.g., #help, #announcements, #showcase, #off-topic)
- Enable **Post Pins**, sorting (Latest, Oldest, Most Active), and tag filtering
- Build a **Post Feed UI** — distinct from channel message list
- Support post reactions, replies count, and seen/unseen tracking per post
- Moderation tools: lock posts, delete posts, manage tags

### Secondary Goals
- Unread indicator per post (not yet read = bold dot)
- Post search within a forum
- Rich post formatting (title + body, image embeds)
- "Solved" / "Answered" marker toggle for support forums

## Technical Approach

### Data Model (TypeScript)
```typescript
interface ForumChannel {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  tags: ForumTag[];
  createdAt: string;
  position: number;
}

interface ForumTag {
  id: string;
  name: string;        // e.g. "Help", "Bug Report"
  emoji: string | null;
  forumId: string;
}

interface ForumPost {
  id: string;
  forumId: string;
  authorId: string;
  title: string;
  body: string | null;
  tags: string[];      // tag IDs
  isPinned: boolean;
  isLocked: boolean;
  isSolved: boolean;
  replyCount: number;
  reactionCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}
```

### Tauri Commands
- `create_forum_channel(serverId, name, description, tags[])`
- `list_forum_posts(forumId, filter?: { tagId?, sort?, page? })`
- `create_forum_post(forumId, title, body, tags[])`
- `pin_forum_post(postId)`, `lock_forum_post(postId)`, `mark_solved(postId)`
- `list_forum_tags(forumId)`, `create_forum_tag(forumId, name, emoji)`

### UI Components
- **ForumFeedView**: Post list with tag filter chips, sort dropdown, new-post FAB
- **PostCard**: Compact preview card (author avatar, title, tags, reply count, time)
- **PostThreadView**: Full post body + threaded replies (reuses Thread UI from PRD #05)
- **CreatePostModal**: Title input, body editor, tag multi-select, post button
- **TagPill**: Colored tag chip used in filter bar and post cards

### API Integration
- Extend existing Hearth API client with forum-specific methods
- WebSocket events: `forum_post_created`, `forum_post_updated`, `forum_post_deleted`
- Pagination: cursor-based, 20 posts per page

## Out of Scope
- Direct messages forums (PMs)
- Nested sub-forums
- Custom forum layouts (v1 is single-level only)

## Dependencies
- PRD #05 (Message Threads) — Forum posts reuse the thread reply system
- Hearth API must expose forum endpoints (coordinate with backend team)

## Success Metrics
- Forum channel creation rate > 1 per new server on average
- > 40% of forum posts receive at least one reply within 24h
- Zero crashes on post creation or tag filtering

# PRD: Rich Presence — Discord Game SDK Parity

## Overview

Extend Hearth Desktop's rich presence implementation to full Discord Game SDK parity: join/spectate/invite actions, party matchmaking, and real-time "Currently Playing Hearth" status with voice channel context.

## Problem Statement

Discord's "Join" button is one of its most compelling social features — friends can click to instantly enter the same voice channel. Hearth has basic rich presence (Epic Games + Battle.net integration just merged) but lacks the **join/spectate/party** layer that enables spontaneous social grouping. For gaming communities, this is a key retention feature.

## Current State

Hearth already has:
- `src-tauri/src/rich_presence.rs` — base presence layer
- `src-tauri/src/game_detection.rs` — Epic Games + Battle.net detection
- `src/lib/stores/richPresence.ts` — frontend store
- `src/lib/stores/gameStore.ts` — game state store

Gap: No **join flow**, **party data**, or **voice channel presence**.

## Goals

- **Join**: User sees "Join" button on a friend's profile/card → enters the same voice channel
- **Spectate**: Watch a friend's game stream (future; stub for now)
- **Invite**: Send a party invite to a friend
- **Party sync**: Show party size (3/5) in presence, not just game name
- **Voice context**: "In #general on Hearth" shown alongside game name
- **Join Request queue**: Accept/deny incoming join requests

## Discord Game SDK Reference

Discord's SDK exposes:
```
discord-sdk-sdk:
  - activity (update rich presence)
  - overlay (open game overlay)
  - party (party size, ID, join/spectate)
  - join (join flow authorization)
  - store (list app in Discord store)
  - input mode (push-to-talk vs voice activity)
```

Hearth needs: `activity` + `party` + `join` (subset).

## Technical Approach

### Presence Data Schema
```json
{
  "details": "In #engineering",
  "state": "Hearth Chat",
  "partyId": "party_abc123",
  "partySize": [3, 5],
  "partyPrivacy": "public",
  "joinSecret": "hearth_join_abc123",
  "spectateSecret": null,
  "startTimestamp": 1742810400,
  "largeImageKey": "hearth_logo",
  "smallImageKey": null,
  "largeImageText": "Hearth Desktop",
  "instance": false
}
```

### Join Flow
1. User A shares a "Join" link or button click
2. Hearth backend receives join intent, checks voice channel capacity
3. Backend sends `join_request` event to User B's client
4. User B accepts → backend returns voice channel details
5. Both clients connect to voice channel

### Tauri Commands to Add
- `update_presence(presence: PresencePayload)` — update rich presence
- `set_party_size(current: u32, max: u32)` — update party context
- `on_join_request(callback)` — handle incoming join requests
- `accept_join_request(user_id: String)` — accept and connect

## Milestones

| Milestone | Deliverable |
|-----------|-------------|
| M1 | Voice channel presence in rich presence (shows "In #general") |
| M2 | Party data sync (party ID, size) |
| M3 | Join flow (send/receive join requests) |
| M4 | Join button on friend cards (frontend) |

## Dependencies

- Backend: voice channel infrastructure (out of scope for desktop)
- Frontend: friend list / user cards (out of scope for desktop)
- Tauri: no new plugins needed

## Priority: P1
**Estimated Effort**: 4 sprints (8 weeks)
**Owner**: Desktop Team + Backend Team

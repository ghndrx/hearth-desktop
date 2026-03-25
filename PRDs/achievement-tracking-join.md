# PRD: Achievement Tracking & Game Join

**Document Status:** Active
**Priority:** P0 (Critical)
**Target Release:** Q2 2026
**Owner:** Platform Team

## Problem Statement

Hearth Desktop has game detection, rich presence, and library management (GAME-001 through GAME-004) but lacks achievement tracking and "Join Game" functionality — two features that drive Discord's social gaming engagement.

## Feature Gap vs Discord

| Feature | Discord | Hearth Desktop |
|---------|---------|----------------|
| Game Achievement Display | ✅ In-chat + profile | ❌ None |
| Achievement Unlocks | ✅ Real-time notifications | ❌ None |
| Join Game (One-Click) | ✅ From rich presence | ❌ None |
| Game Invites via Presence | ✅ Deep link integration | ❌ None |

## Technical Requirements

### Achievement Tracking
- Hook into Steam/Epic/Battlenet achievement APIs
- Parse achievement unlock events from game processes
- Display in-app achievement notifications (toast + voice channel)
- Profile badge system for unlocked achievements
- Privacy controls for achievement visibility

### Join Game Functionality
- Parse rich presence "Join" button data from Steam/Epic
- Automatic game launch via hearth:// protocol handler
- Friend invite acceptance via presence data
- Handle games that require launchers (Epic, Battlenet)

## Acceptance Criteria
- [ ] Steam achievements appear in real-time during gameplay
- [ ] "Join Game" button launches the correct game
- [ ] Cross-launcher support (Steam, Epic, Battlenet)
- [ ] Achievement notifications configurable (on/off per game)

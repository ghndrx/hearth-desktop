# Hearth Desktop — Feature Gap Report

**Date**: 2026-03-24  
**Analyst**: Competitive Intelligence Pipeline  
**Competitive Baseline**: Discord Desktop (latest)  
**Scope**: Tauri/SvelteKit desktop client

---

## Executive Summary

Hearth Desktop v0.1.0 is a functioning scaffold with basic rich presence (Epic Games + Battle.net). Against Discord Desktop, it achieves approximately **18% feature parity** across the 11 dimensions analyzed. The three highest-priority gaps — system tray depth, advanced notifications, and global shortcuts — are fully documented in PRDs 01–04 and reflected in `TASK_QUEUE.md`.

---

## Feature Parity Matrix

| # | Feature Dimension | Discord Desktop | Hearth Desktop | Status | Priority |
|---|-------------------|-----------------|----------------|--------|----------|
| 1 | Basic scaffold (window, tray, menus) | ✅ | ✅ (v0.1.0) | Complete | — |
| 2 | Notifications (plain) | ✅ | ⚠️ Basic only | Partial | P0 |
| 3 | System tray (context menu) | ✅ Full | ⚠️ Stub (click-to-show only) | Gap | P0 |
| 4 | Global shortcuts | ✅ Extensive | ❌ PRD exists, not built | Gap | P0 |
| 5 | Rich presence (game status) | ✅ Game SDK + Join | ⚠️ Basic only (Epic/Bnet) | Partial | P1 |
| 6 | Window management (min-to-tray, always-on-top, compact) | ✅ | ❌ Not implemented | Gap | P1 |
| 7 | Autostart + session persistence | ✅ Full | ⚠️ Plugin present, no UI | Gap | P1 |
| 8 | Inline notification reply | ✅ | ❌ Not implemented | Gap | P1 |
| 9 | Notification action buttons | ✅ | ❌ Not implemented | Gap | P0 |
| 10 | Join/spectate/party presence | ✅ | ❌ Not implemented | Gap | P1 |
| 11 | Desktop overlay (in-game) | ✅ | ❌ Not implemented | P2 | P2 |
| 12 | Deep links (`hearth://`) | ✅ | ❌ Not implemented | P2 | P2 |
| 13 | Keyboard-driven channel navigation (Ctrl+K) | ✅ | ❌ Not implemented | P2 | P2 |

**Overall Parity: ~18% (2 complete, 2 partial, 9 gaps)**

---

## Gap Analysis — Top 3

### Gap 1: System Tray Depth
**Parity: ~20%**  
Discord's tray is a full control surface. Hearth's tray is a stub.

| Discord Tray | Hearth Tray |
|--------------|-------------|
| Right-click menu: mute, deafen, servers, channels, show, quit | Click → show window only |
| Unread badge count on icon | ❌ |
| Dynamic tooltip (status, unread count) | Static tooltip "Hearth" |
| Minimize-to-tray on close | ❌ |
| Quick toggle server/channel | ❌ |

**Impact**: Users expect background operation. Without tray depth, Hearth feels like a web tab, not a native app.

---

### Gap 2: Advanced Notifications
**Parity: ~25%**  
Discord notifications are actionable. Hearth fires plain alerts.

| Discord Notifications | Hearth Notifications |
|-----------------------|----------------------|
| Inline reply without opening app | ❌ |
| Action buttons (Mute, Mark Read) | ❌ |
| @mention highlight in body | ❌ |
| Per-channel settings (all/mentions/nothing) | ❌ |
| Notification grouping per channel | ❌ |
| "Do Not Disturb" mode | ❌ |

**Impact**: For a chat app, notification UX is how users experience the product when they're not in it. This is the #1 retention driver.

---

### Gap 3: Global Shortcuts
**Parity: 0% (documented, not built)**  
PRD-01 exists in `PRDs/01_global_shortcuts_system.md`. Implementation has not begun.

| Discord Shortcuts | Hearth Shortcuts |
|-------------------|------------------|
| Ctrl+Shift+H — toggle app | ❌ |
| Ctrl+Shift+M — mute | ❌ |
| Ctrl+Space — push-to-talk | ❌ |
| Ctrl+K — channel jump | ❌ |
| Fully customizable | ❌ |
| Conflict detection | ❌ |

**Impact**: Power users and gamers are the primary target for a Discord alternative. Without shortcuts, Hearth requires constant mouse navigation.

---

## Competitive Recommendations

### Immediate (v0.2.0)
1. **Implement system tray depth** (PRD-02) — 2 sprints
2. **Implement notification actions** (PRD-03 M2) — 1 sprint
3. **Implement global shortcuts** (PRD-01) — 2 sprints

### Short-term (v0.3.0)
4. **Rich presence join flow** (PRD-04) — 4 sprints
5. **Window management** (min-to-tray, always-on-top) — 1 sprint
6. **Autostart UI** — 0.5 sprints

### Medium-term (v1.0)
7. Deep links (`hearth://`)
8. Desktop overlay
9. Keyboard-driven command palette (Ctrl+K)

---

## Appendix

- `PRDs/01_global_shortcuts_system.md` — existing
- `PRDs/02_system_tray_depth.md` — new
- `PRDs/03_advanced_notifications.md` — new
- `PRDs/04_rich_presence_join_flow.md` — new
- `TASK_QUEUE.md` — prioritized task list

---

*Pipeline run: 2026-03-24T11:13:00Z | Competitive baseline: Discord Desktop*

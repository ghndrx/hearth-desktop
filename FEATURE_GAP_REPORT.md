# Hearth Desktop — Feature Gap Report

**Date**: 2026-03-24
**Analyst**: Competitive Intelligence Pipeline (automated)
**Competitive Baseline**: Discord Desktop (latest)
**Scope**: Tauri/SvelteKit desktop client
**Hearth Version**: v0.1.0 (scaffold) → v0.1.x (tray-enhanced)

---

## Executive Summary

Hearth Desktop v0.1.x now ships with a significantly enhanced system tray (context menu with mute/deafen/show/quit, dynamic unread tooltip, minimize-to-tray, macOS dock badge). Against Discord Desktop, Hearth achieves approximately **25% feature parity** across 16 dimensions (up from 18%). The remaining P0 gaps are global shortcuts (documented but unimplemented), advanced notifications, and file upload system. The newest PRD additions — voice/video calling, screen sharing, file upload, and advanced audio engine — represent a comprehensive Discord parity roadmap.

---

## Feature Parity Matrix

| # | Feature Dimension | Discord Desktop | Hearth Desktop | Status | Priority |
|---|-------------------|-----------------|----------------|--------|----------|
| 1 | Basic scaffold (window, tray, menus) | ✅ | ✅ (v0.1.0) | Complete | — |
| 2 | Notifications (plain) | ✅ | ⚠️ Basic only | Partial | P0 |
| 3 | System tray (context menu) | ✅ Full | ✅ Enhanced (v0.1.x) | Near-complete | P1 |
| 4 | Global shortcuts | ✅ Extensive | ❌ PRD exists, not built | Gap | P0 |
| 5 | Rich presence (game status) | ✅ Game SDK + Join | ⚠️ Epic/Bnet only | Partial | P1 |
| 6 | Window management (min-to-tray, always-on-top, compact) | ✅ | ⚠️ Min-to-tray done, rest not | Partial | P1 |
| 7 | Autostart + session persistence | ✅ Full | ⚠️ Plugin present, no UI | Gap | P1 |
| 8 | Inline notification reply | ✅ | ❌ Not implemented | Gap | P1 |
| 9 | Notification action buttons | ✅ | ❌ Not implemented | Gap | P0 |
| 10 | Join/spectate/party presence | ✅ | ❌ Not implemented | Gap | P1 |
| 11 | File upload & media sharing | ✅ | ❌ Not implemented | Gap | P0 |
| 12 | Screen sharing & remote control | ✅ | ❌ Not implemented | Gap | P1 |
| 13 | Advanced audio processing (noise suppression, AEC) | ✅ | ❌ Not implemented | Gap | P1 |
| 14 | Desktop overlay (in-game) | ✅ | ❌ Not implemented | P2 | P2 |
| 15 | Deep links (`hearth://`) | ✅ | ❌ Not implemented | Gap | P2 |
| 16 | Keyboard-driven channel navigation (Ctrl+K) | ✅ | ❌ Not implemented | P2 | P2 |

**Overall Parity: ~25% (4 complete/partial, 12 gaps)**

---

## Gap Analysis — Top 3

### Gap 1: System Tray Depth
**Parity: ~75%** *(was ~20% — improved)*
Hearth's tray is now a solid native control surface, not a stub.

| Discord Tray | Hearth Tray (v0.1.x) |
|--------------|----------------------|
| Right-click menu: mute, deafen, servers, channels, show, quit | ✅ Mute/Unmute, Deafen/Undeafen, Show, Quit |
| Unread badge count on icon | ✅ Dynamic tooltip + macOS dock badge |
| Dynamic tooltip (status, unread count) | ✅ "Hearth — N unread" / "Hearth" |
| Minimize-to-tray on close | ✅ Implemented, setting-gated |
| Quick toggle server/channel | ❌ Not implemented |
| Server/channel submenus | ❌ Not implemented |

**Remaining work**: Server/channel navigation in tray (P2).

---

### Gap 2: Advanced Notifications
**Parity: ~25%** *(unchanged)*
Discord notifications are fully actionable. Hearth fires plain alerts.

| Discord Notifications | Hearth Notifications |
|-----------------------|----------------------|
| Inline reply without opening app | ❌ |
| Action buttons (Mute Channel, Mark Read) | ❌ |
| @mention highlight in body | ❌ |
| Per-channel settings (all/mentions/nothing) | ❌ |
| Notification grouping per channel | ❌ |
| "Do Not Disturb" mode | ❌ |
| Rich embeds (image previews, file cards) | ❌ |

**Impact**: For a chat app, notification UX is how users experience the product when they're not in it. This is the #1 retention driver. PRD-03 covers this.

---

### Gap 3: Global Shortcuts
**Parity: 0% (documented in PRD-01, not built)**
Power users and gamers are the primary target for a Discord alternative. Without shortcuts, Hearth requires constant mouse navigation.

| Discord Shortcuts | Hearth Shortcuts |
|-------------------|------------------|
| Ctrl+Shift+H — toggle app | ❌ |
| Ctrl+Shift+M — mute | ❌ |
| Ctrl+Space — push-to-talk | ❌ |
| Ctrl+K — channel jump | ❌ |
| Fully customizable | ❌ |
| Conflict detection | ❌ |

---

## New PRD Coverage (Added Since Last Analysis)

Four new PRDs were added to `PRDs/` this cycle:

| PRD | Title | Priority Justification |
|-----|-------|------------------------|
| PRD-05 | File Upload & Media System | Media sharing is table-stakes for any chat platform |
| PRD-06 | Screen Sharing & Collaboration | Key differentiator and power-user magnet for gaming |
| PRD-07 | Advanced Audio Engine | Audio quality foundation — noise suppression, echo cancellation |

These expand the scope well beyond the initial 4-PRD baseline and represent a comprehensive Discord parity roadmap covering core communication, media sharing, and advanced collaboration features.

---

## Competitive Recommendations

### Immediate (v0.2.0)
1. **Implement global shortcuts** (PRD-01) — `tauri-plugin-global-shortcut` is not yet in Cargo.toml; add it and wire up defaults (Ctrl+Shift+H toggle, Ctrl+Shift+M mute) — 2 sprints
2. **Implement notification action buttons** (PRD-03 M2) — Register notification actions (Mute Channel, Mark Read) on macOS + Windows — 1 sprint
3. **Autostart UI** — Frontend toggle in settings (plugin already present) — 0.5 sprints

### Short-term (v0.3.0)
4. **Rich presence join flow** (PRD-04) — Party ID, party size, join request events — 4 sprints
5. **Always-on-top + compact mode** (PRD-03 alt) — 1 sprint
6. **Per-channel notification settings** — Schema + UI — 1 sprint
7. **Voice/video calling foundation** (PRD-02 alt) — Signaling only at this stage — 4 sprints

### Medium-term (v1.0)
8. Screen sharing (PRD-06)
9. File upload/media system (PRD-05)
10. Deep links (`hearth://`)
11. Keyboard-driven command palette (Ctrl+K)
12. Desktop overlay for in-game voice status

---

## Appendix

- `PRDs/01_global_shortcuts_system.md` — documented, not implemented
- `PRDs/02_system_tray_depth.md` — largely implemented (v0.1.x)
- `PRDs/02_voice_video_calling.md` — new, not implemented
- `PRDs/03_advanced_notifications.md` — documented, not implemented
- `PRDs/03_advanced_window_management.md` — partially implemented (min-to-tray done)
- `PRDs/04_rich_presence_join_flow.md` — Epic/Bnet done, party/join not
- `PRDs/05_file_upload_media_system.md` — new, not implemented
- `PRDs/06_screen_sharing_collaboration.md` — new, not implemented
- `PRDs/07_advanced_audio_engine.md` — new, not implemented
- `TASK_QUEUE.md` — prioritized task list

---

*Pipeline run: 2026-03-24T17:15:00Z | Competitive baseline: Discord Desktop*

# Feature Gap Report — Hearth Desktop vs Discord

**Generated**: 2026-03-27
**Analyst**: Competitive Intelligence Pipeline (Updated)
**Comparator**: Discord Desktop App (latest)
**Baseline**: Hearth Desktop v0.1.0 + New PRDs (#06-08)

---

## Summary

Hearth Desktop v0.1.0 is a native Tauri/Svelte scaffold with real-time transcription (Whisper WASM) and WebRTC voice infrastructure. With new desktop-focused PRDs (#06-08), the roadmap now addresses critical native OS integration gaps.

**Overall Feature Parity: ~28%** (↑6% with new desktop integration PRDs)
**Projected Parity (Post P1 Implementation): ~55%**

---

## Feature Gap Matrix

| Feature Area | Discord Desktop | Hearth Desktop | Gap | Severity | PRD |
|---|---|---|---|---|---|
| **Text Messaging** | ✅ Complete | 🟡 In Progress (PRD #1, #2) | Partial | P0 | #01, #02 |
| **Voice Calls** | ✅ Complete | ✅ Implemented (#17) | None | — | — |
| **Screen Sharing** | ✅ Go Live, window/screen/tab select | ❌ None | Full gap | P1 | #03 |
| **Video Calls** | ✅ Per-user webcam in voice | ❌ None | Full gap | P1 | #04 |
| **Threads** | ✅ Full thread system | ❌ None | Full gap | P1 | #05 |
| **System Tray** | ✅ Tray + tray menu | ✅ Implemented | None | — | — |
| **System Notifications** | ✅ Native OS notifications | ✅ Implemented | None | — | — |
| **Always-On-Top Overlay** | ✅ Voice overlay stays on top | ❌ None | Full gap | P1 | #06 |
| **Global Shortcuts** | ✅ Customizable hotkeys | ❌ Basic only (no global) | Partial gap | P1 | #07 |
| **Advanced Notifications** | ✅ Rich notifications + actions | ❌ Basic OS notifications | Partial gap | P1 | #08 |
| **Auto Updates** | ✅ Built-in updater | ✅ Tauri updater | None | — | — |
| **Rich Presence** | ✅ Game + status + Spotify | ❌ None | Full gap | P2 | — |
| **Screenshots** | ✅ In-app screenshot capture | ❌ None | Full gap | P2 | — |
| **Forum Channels** | ✅ Dedicated forum channels | ❌ None | Full gap | P2 | — |
| **Stage Channels** | ✅ Webinars/podcasts | ❌ None | Full gap | P2 | — |
| **Custom Status** | ✅ Custom emoji + text status | ❌ None | Full gap | P2 | — |
| **Notification Sounds** | ✅ Per-channel sounds | ❌ None (generic only) | Partial gap | P2 | — |
| **Message Search** | ✅ Advanced filters (from:, has:) | ❌ None | Full gap | P2 | — |
| **Keyboard Shortcuts** | ✅ Customizable + UI to edit | ✅ Defaults only | Partial gap | P2 | — |
| **App Themes** | ✅ Dark/light + Nitro themes | ❌ None | Full gap | P2 | — |
| **Background Blur (video)** | ❌ No (third-party only) | ❌ None | N/A | P2 | #04 stretch |
| **Activities / Games** | ✅ 100+ integrated apps | ❌ None | Full gap | P3 | — |
| **Emoji Picker** | ✅ Searchable + GIF picker | ❌ None (needs text msg) | Partial gap | P2 | #01 |
| **Reactions** | ✅ Unicode + custom emoji | ❌ None (needs text msg) | Partial gap | P2 | #01 |

---

## Parity Breakdown by Category

| Category | Current Parity | Projected Parity (Post-P1) | Notes |
|---|---|---|---|
| Core Infrastructure | 60% | 85% | Missing always-on-top, global shortcuts, advanced notifications |
| Voice Communication | 60% | 90% | WebRTC solid, needs push-to-talk global shortcuts (PRD #07) |
| Desktop Integration | 20% | 80% | PRDs #06-08 address major gaps (overlay, shortcuts, notifications) |
| Text Messaging | 40% | 70% | PRDs #1 and #2 in progress, but not shipped |
| Video + Sharing | 0% | 60% | Screen share (PRD #03) + video calls (PRD #04) planned |
| Threading + Organization | 0% | 40% | Threads (PRD #05) planned, forums/stages future |
| Presence + Status | 10% | 15% | Basic presence, rich presence in future roadmap |
| Search + Discoverability | 0% | 10% | Message search not prioritized yet |
| Customization | 20% | 45% | Global shortcuts (PRD #07), notifications (PRD #08) improve this |

---

## Top 3 Critical Gaps (P1)

### 1. Global Shortcuts — Gap: 85% (PRD #07)
No global shortcuts for voice controls. Discord's global push-to-talk and mute shortcuts are essential for gaming and productivity. This is a desktop-specific feature that mobile apps cannot provide.

**Effort estimate**: 3-4 weeks
**Impact**: High — blocks gaming and professional use cases
**Status**: PRD #07 created, addresses platform-specific implementation

### 2. Screen Sharing — Gap: 100% (PRD #03 existing)
No screen share capability. This is one of Discord's most-used features for remote work, gaming, and demos. Hearth Desktop has the WebRTC voice infrastructure to build on top of (PR #17), but no screen capture layer.

**Effort estimate**: 4-6 weeks
**Impact**: High — blocks professional/remote use cases
**Status**: PRD #03 already exists

### 3. Always-On-Top Overlay — Gap: 100% (PRD #06)
No always-on-top voice overlay. Discord's overlay allows voice control during gaming and fullscreen applications. Critical for desktop competitive advantage over web clients.

**Effort estimate**: 2-3 weeks
**Impact**: High — blocks gaming and multitasking use cases
**Status**: PRD #06 created, leverages existing overlay component

## Top 3 Secondary Gaps (P1-P2)

### 4. Video Calls — Gap: 100% (PRD #04 existing)
No webcam video in voice channels. Discord video is a primary differentiator for small-group calls. WebRTC voice infrastructure is ready — video tracks just need to be added.

**Effort estimate**: 5-7 weeks
**Impact**: High — blocks face-to-face social and meeting use cases

### 5. Advanced Notifications — Gap: 70% (PRD #08)
Basic OS notifications exist but missing rich content, priority levels, per-channel settings, and actionable notifications. Desktop apps should provide superior notification experiences.

**Effort estimate**: 2-3 weeks
**Impact**: Medium — affects user engagement and productivity

### 6. Message Threads — Gap: 100% (PRD #05 existing)
No threading. Large channels become unusable without threads to organize sub-conversations. This PRD is largely a frontend + API task.

**Effort estimate**: 3-5 weeks
**Impact**: Medium — degrades channel usability at scale

---

## Recommendations

### Immediate (Sprint 1-2) — Desktop Competitive Advantage
1. **Ship PRD #07 (Global Shortcuts)** — Critical desktop differentiator, enables gaming use cases
2. **Ship PRD #06 (Always-On-Top Overlay)** — Desktop-specific feature, quick win with existing overlay
3. **Ship PRD #1 + #2 (Text Messaging)** — Foundation for all other features

### Medium-term (Sprint 3-4) — Core Feature Parity
4. **Ship PRD #08 (Advanced Notifications)** — Desktop notification experience improvement
5. **Ship PRD #3 (Screen Sharing)** — High-impact professional feature
6. **Ship PRD #4 (Video Calls)** — Social and meeting feature completion

### Next Phase (Sprint 5-6) — Organization & Discovery
7. **Ship PRD #5 (Message Threads)** — Channel scalability and organization
8. **Implement Message Search** — Content discoverability (no PRD yet)
9. **Rich Presence System** — Gaming and productivity integrations

### Long-term — Polish & Advanced Features
- App theme system and customization
- Advanced gaming integrations (overlay improvements)
- Hardware-specific optimizations (gaming peripherals)
- Cross-platform feature parity refinements

### Strategic Priority Shift

**Previous Focus**: Catch up to basic Discord features
**New Focus**: Leverage desktop-native advantages first, then fill feature gaps

**Rationale**: PRDs #06-08 provide competitive advantages that web and mobile clients cannot match, establishing differentiation before achieving feature parity.

---

## Appendix: Competitor Version Notes

- **Discord**: v0.0.300+ (constantly updating, mature 10+ year codebase)
- **Hearth Desktop**: v0.1.0 (initial scaffold, ~5 months old)
- **Hearth Backend** (hearth): https://github.com/greghendrickson/hearth
- **Hearth Mobile** (hearth-mobile): https://github.com/greghendrickson/hearth-mobile

---

*This report is auto-generated by the Hearth Desktop PRD Pipeline. Update after each major feature release.*

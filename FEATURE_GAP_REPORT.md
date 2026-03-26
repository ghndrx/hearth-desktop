# Feature Gap Report — Hearth Desktop vs Discord

**Generated**: 2026-03-26  
**Analyst**: Competitive Intelligence Pipeline  
**Comparator**: Discord Desktop App (latest)  
**Baseline**: Hearth Desktop v0.1.0

---

## Summary

Hearth Desktop v0.1.0 is a native Tauri/Svelte scaffold with real-time transcription (Whisper WASM) and WebRTC voice infrastructure. It is **early-stage** compared to Discord, which is a mature 10+ year old product.

**Overall Feature Parity: ~22%**

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
| **Global Shortcuts** | ✅ Customizable hotkeys | ✅ Implemented | None | — | — |
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

| Category | Parity Score | Notes |
|---|---|---|
| Core Infrastructure | 80% | Tray, notifications, shortcuts, auto-update all solid |
| Voice Communication | 60% | WebRTC in place (PR #17), missing push-to-talk, voice activity detection tuning |
| Text Messaging | 40% | PRDs #1 and #2 in progress, but not shipped |
| Video + Sharing | 0% | No screen share or video — full gap |
| Threading + Organization | 0% | No threads, forums, or stage channels |
| Presence + Status | 10% | Online/idle/dnd basic, no rich presence |
| Search + Discoverability | 0% | No message search implemented |
| Customization | 20% | Limited to defaults, no theme or shortcut customization |

---

## Top 3 Critical Gaps (P1)

### 1. Screen Sharing — Gap: 100%
No screen share capability. This is one of Discord's most-used features for remote work, gaming, and demos. Hearth Desktop has the WebRTC voice infrastructure to build on top of (PR #17), but no screen capture layer.

**Effort estimate**: 4-6 weeks  
**Impact**: High — blocks professional/remote use cases

### 2. Video Calls — Gap: 100%
No webcam video in voice channels. Discord video is a primary differentiator for small-group calls. Again, WebRTC voice infrastructure is ready — video tracks just need to be added.

**Effort estimate**: 5-7 weeks  
**Impact**: High — blocks face-to-face social and meeting use cases

### 3. Message Threads — Gap: 100%
No threading. Large channels become unusable without threads to organize sub-conversations. This PRD is largely a frontend + API task, less complex than screen/video.

**Effort estimate**: 3-5 weeks  
**Impact**: Medium — degrades channel usability at scale

---

## Recommendations

### Immediate (Sprint 1-2)
1. Ship PRD #1 + #2 (text messaging) to establish base feature parity
2. Start PRD #3 (screen sharing) in parallel — leverages existing WebRTC voice code
3. Add video tracks to the WebRTC pipeline from PR #17 as a preparatory step for PRD #4

### Medium-term (Sprint 3-4)
4. Ship PRD #3 screen sharing
5. Ship PRD #4 video calls
6. Ship PRD #5 message threads

### Long-term
- Rich presence integration (game + music status)
- Message search with filters
- Customizable keyboard shortcuts UI
- App theme system

---

## Appendix: Competitor Version Notes

- **Discord**: v0.0.300+ (constantly updating, mature 10+ year codebase)
- **Hearth Desktop**: v0.1.0 (initial scaffold, ~5 months old)
- **Hearth Backend** (hearth): https://github.com/greghendrickson/hearth
- **Hearth Mobile** (hearth-mobile): https://github.com/greghendrickson/hearth-mobile

---

*This report is auto-generated by the Hearth Desktop PRD Pipeline. Update after each major feature release.*

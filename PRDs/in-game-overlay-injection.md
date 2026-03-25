# PRD: In-Game Overlay Injection

**Document Status:** Active
**Priority:** P0 (Critical)
**Target Release:** Q2 2026
**Owner:** Platform Team

## Problem Statement

Hearth Desktop has basic always-on-top and mini player modes, but lacks true **in-game overlay injection** — the ability to render Hearth voice controls and notifications inside fullscreen games. This is a core Discord feature that gamers depend on for voice communication without alt-tabbing.

## Feature Gap vs Discord

| Feature | Discord | Hearth Desktop |
|---------|---------|----------------|
| In-Game Overlay (DirectX/Vulkan) | ✅ Full support | ❌ None |
| Overlay Hotkeys (in-game) | ✅ Configurable | ❌ None |
| Overlay Positioning (in-game) | ✅ Free placement | ❌ None |
| Performance (<5% CPU) | ✅ Achieved | ❌ N/A |

## Technical Requirements

### Overlay Injection
- DirectX 11/12 and Vulkan overlay hook via `dxgkrnl`/`vulkan` layer
- Cross-process rendering into game window
- Respect game anti-cheat compatibility (EasyAntiCheat, BattlEye)
- Opacity, scale, and position configuration

### Rendering Constraints
- Target: <5% CPU overhead, <16ms frame time impact
- Use hardware-accelerated rendering (WGPU/Vulkan)
- Graceful degradation when injection blocked by anti-cheat

## Acceptance Criteria
- [ ] Overlay renders inside top 50 most-played games
- [ ] Anti-cheat compatibility with EasyAntiCheat and BattlEye
- [ ] Configurable opacity (10%-100%) and scale
- [ ] Voice controls (mute/deafen) accessible via overlay
- [ ] <16ms render latency impact

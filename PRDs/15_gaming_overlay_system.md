# PRD #15: Gaming Overlay System

**Status**: Draft
**Priority**: P0 — Critical
**Assignee**: TBD
**Estimated effort**: 3-4 sprints
**Depends on**: Global Hotkeys (#12), Voice Infrastructure

## Problem Statement

Hearth Desktop lacks a gaming overlay system, which is Discord's primary competitive advantage for gamers. Without an in-game overlay for voice controls, chat, and screen sharing, Hearth cannot compete effectively in the gaming communication market. Gamers need seamless access to communication features without alt-tabbing out of games, especially in competitive and streaming scenarios.

## Success Criteria

- [ ] In-game overlay accessible via global hotkey (even in exclusive fullscreen)
- [ ] Voice channel controls (mute, deafen, volume) within games
- [ ] Text chat overlay with message history and sending
- [ ] Screen sharing controls accessible from overlay
- [ ] Game detection and rich presence integration
- [ ] Low-latency overlay rendering (< 16ms) for 60fps games
- [ ] Support for major game engines (Unity, Unreal, DirectX, OpenGL, Vulkan)
- [ ] Cross-platform overlay (Windows DirectX/OpenGL, Linux X11/Wayland, macOS Metal)

## Requirements

### Functional Requirements

**Overlay Rendering**
- Hardware-accelerated overlay rendering using GPU APIs
- Support for DirectX 11/12, OpenGL, Vulkan, Metal graphics APIs
- Transparent overlay window that doesn't block game input
- Scalable UI that adapts to different game resolutions
- High DPI awareness for 4K/ultrawide displays

**Voice Controls in Overlay**
- Visual voice channel participant list with speaking indicators
- Mute/unmute toggle buttons with visual feedback
- Deafen toggle with clear audio isolation
- Per-user volume sliders (0-200% range)
- Push-to-talk activation indicator
- Voice channel switch/leave functionality

**Text Chat Integration**
- Overlay chat window with message history (last 50 messages)
- Text input field with send functionality
- Emoji picker and mention autocomplete
- Server/channel switching within overlay
- Notification badges for unread messages
- Chat transparency and size controls

**Game Integration Features**
- Automatic game detection via process monitoring
- Rich presence API integration showing game status
- Game-specific overlay positioning and scaling
- FPS counter with performance metrics
- Screenshot capture hotkey (integrated with game)
- Game audio mixing controls

**Screen Sharing Controls**
- Start/stop screen sharing from overlay
- Application/window/screen selection
- Quality controls (resolution, FPS, bitrate)
- Annotation tools during screen sharing
- "Go Live" streaming to voice channels

### Non-Functional Requirements

**Performance**
- Overlay rendering latency < 16ms for smooth 60fps gaming
- CPU overhead < 5% during active overlay usage
- GPU memory usage < 100MB for overlay textures
- No impact on game FPS when overlay is hidden
- Efficient event handling without blocking game threads

**Compatibility**
- Support for exclusive fullscreen games
- Windowed and borderless windowed game modes
- Anti-cheat compatibility (EasyAntiCheat, BattlEye, VAC)
- Integration with popular game engines and frameworks
- Graceful fallback for unsupported rendering APIs

**User Experience**
- Customizable overlay positioning (corners, edges, custom)
- Transparent background with adjustable opacity
- Smooth show/hide animations (fade in/out)
- Keyboard shortcut customization
- Per-game overlay settings and positioning

## Technical Specification

### Architecture Overview

```
Game Process ←→ Overlay Injector ←→ Overlay Renderer ←→ Hearth Desktop
     ↓                ↓                    ↓                 ↓
Graphics API    Hook Manager     Overlay UI           Voice/Chat APIs
     ↓                ↓                    ↓                 ↓
DirectX/OpenGL  Input Handler    React/WebGL         WebRTC Pipeline
```

### Core Components

**1. Graphics API Injection**
```rust
pub struct OverlayInjector {
    target_process: Process,
    graphics_api: GraphicsAPI,
    hook_manager: HookManager,
}

impl OverlayInjector {
    pub fn inject_into_game(process_id: u32) -> Result<Self, InjectionError>
    pub fn create_overlay_surface() -> Result<OverlaySurface, RenderError>
    pub fn hook_graphics_calls() -> Result<(), HookError>
}
```

**2. Overlay Renderer**
```rust
pub struct OverlayRenderer {
    context: RenderContext,
    ui_elements: Vec<UIElement>,
    texture_cache: TextureCache,
}

impl OverlayRenderer {
    pub fn render_frame(&mut self, frame_data: &FrameData) -> Result<(), RenderError>
    pub fn update_ui_state(&mut self, state: UIState)
    pub fn handle_input_events(&mut self, events: &[InputEvent])
}
```

**3. Game Detection**
```rust
pub struct GameDetector {
    known_games: HashMap<String, GameMetadata>,
    process_monitor: ProcessMonitor,
}

impl GameDetector {
    pub fn scan_for_games() -> Vec<DetectedGame>
    pub fn get_game_metadata(process: &Process) -> Option<GameMetadata>
    pub fn update_rich_presence(game: &DetectedGame, status: &GameStatus)
}
```

### Platform Implementation

**Windows Implementation (DirectX/OpenGL)**
```rust
// DirectX 11/12 hook implementation
use windows::Win32::Graphics::{Direct3D11::*, Dxgi::*};

pub struct WindowsOverlay {
    d3d_device: ID3D11Device,
    swap_chain: IDXGISwapChain,
    overlay_texture: ID3D11Texture2D,
}

impl WindowsOverlay {
    pub fn hook_present_call() -> Result<(), HookError>
    pub fn render_overlay_frame(&self, frame: &Frame)
    pub fn inject_into_dx_game(process: &Process) -> Result<Self, Error>
}
```

**Linux Implementation (OpenGL/Vulkan)**
```rust
// OpenGL/Vulkan overlay via LD_PRELOAD
use x11::xlib::*;
use gl::types::*;

pub struct LinuxOverlay {
    display: *mut Display,
    context: GLXContext,
    overlay_window: Window,
}

impl LinuxOverlay {
    pub fn hook_glx_swap_buffers() -> Result<(), HookError>
    pub fn create_overlay_window(&self) -> Result<Window, X11Error>
    pub fn inject_via_ld_preload(game_path: &str) -> Result<(), Error>
}
```

**macOS Implementation (Metal)**
```rust
// Metal overlay implementation
use metal::*;
use core_graphics::*;

pub struct MacOSOverlay {
    device: Device,
    layer: MetalLayer,
    command_queue: CommandQueue,
}

impl MacOSOverlay {
    pub fn hook_metal_present() -> Result<(), HookError>
    pub fn create_metal_overlay(&self) -> Result<MetalLayer, MetalError>
}
```

### UI Components

**Overlay Interface (React/Svelte)**
```typescript
interface OverlayState {
  visible: boolean;
  position: OverlayPosition;
  opacity: number;
  activeView: 'voice' | 'chat' | 'settings' | 'screenshare';
  gameInfo: DetectedGame;
}

interface VoiceOverlayProps {
  participants: VoiceParticipant[];
  currentUser: CurrentUserState;
  channelInfo: VoiceChannel;
}

interface ChatOverlayProps {
  messages: Message[];
  currentChannel: TextChannel;
  inputValue: string;
  onSendMessage: (text: string) => void;
}
```

**Overlay Positioning System**
```typescript
interface OverlayPosition {
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'custom';
  offsetX: number;
  offsetY: number;
  scale: number;  // 0.5 - 2.0
}
```

### Anti-Cheat Compatibility

**Safe Injection Methods**
- Use documented Windows overlay APIs where possible
- Avoid memory patching in favor of graphics API hooks
- Implement overlay as separate process communicating via IPC
- Whitelist approach for known anti-cheat systems
- Graceful disable for incompatible games

## Implementation Plan

### Phase 1: Core Overlay Infrastructure (Sprint 1-2)
- Implement basic graphics API detection and hooking
- Create overlay renderer for DirectX 11/OpenGL
- Build basic overlay window management
- Add game process detection and monitoring
- Implement overlay show/hide with global hotkey

### Phase 2: Voice Controls Integration (Sprint 2)
- Integrate voice channel controls into overlay UI
- Add speaking indicators and participant list
- Implement mute/unmute/deafen controls from overlay
- Add per-user volume controls
- Connect with existing WebRTC voice infrastructure

### Phase 3: Chat Integration (Sprint 2-3)
- Build text chat interface within overlay
- Add message history and real-time updates
- Implement chat input with emoji and mentions
- Add server/channel switching capabilities
- Integrate with existing text messaging system

### Phase 4: Advanced Features (Sprint 3-4)
- Add screen sharing controls to overlay
- Implement game detection and rich presence
- Build FPS counter and performance metrics
- Add screenshot capture functionality
- Implement per-game overlay settings

### Phase 5: Cross-Platform & Polish (Sprint 4)
- Extend to Linux (OpenGL/Vulkan) and macOS (Metal)
- Anti-cheat compatibility testing and fixes
- Performance optimization and latency reduction
- Comprehensive game compatibility testing
- User documentation and onboarding

## Testing Strategy

**Game Compatibility Testing**
- Test with top 50 games on Steam/Epic Games
- Verify overlay works in exclusive fullscreen mode
- Test with various graphics APIs (DX11, DX12, OpenGL, Vulkan)
- Validate anti-cheat compatibility (EAC, BattlEye, VAC)
- Performance impact measurement across game genres

**Performance Testing**
- Measure overlay rendering latency (target < 16ms)
- Monitor FPS impact when overlay is active/hidden
- Test GPU memory usage and leak detection
- CPU overhead measurement during gaming
- Battery impact testing on gaming laptops

**Platform Testing**
- Windows: DirectX 11/12, different Windows versions
- Linux: X11/Wayland, various distributions, OpenGL/Vulkan
- macOS: Metal support, different macOS versions
- Multiple monitor setups and resolution scaling

## Success Metrics

- **Game Compatibility**: 80%+ of top 100 Steam games support overlay
- **Performance**: < 5% FPS impact when overlay is hidden, < 10% when active
- **Adoption**: 60%+ of voice users enable gaming overlay
- **Latency**: < 16ms overlay rendering latency for smooth 60fps gaming
- **User Satisfaction**: 4.2+ rating for gaming overlay functionality

## Risks & Mitigations

**Technical Risks**
- *Anti-Cheat Detection*: Whitelist approach, safe injection methods
- *Graphics API Complexity*: Incremental support, fallback rendering
- *Performance Impact*: Efficient rendering, hardware acceleration
- *Game Compatibility*: Extensive testing matrix, graceful fallbacks

**User Experience Risks**
- *Overlay Positioning*: Smart defaults, easy customization
- *Input Conflicts*: Configurable hotkeys, conflict detection
- *Visual Intrusion*: Transparent design, hide-on-demand

## Related Work

- Discord: Comprehensive gaming overlay with voice/chat/screenshare
- Steam Overlay: Basic overlay with browser and chat
- NVIDIA GeForce Experience: Game capture and basic overlay
- TeamSpeak: Simple voice overlay for games

## Future Considerations

- Voice commands for hands-free overlay control
- Game-specific automation and integration
- Streaming overlay integration (OBS, Streamlabs)
- Advanced game detection with API integrations
- Machine learning for optimal overlay positioning
- Integration with game stores and launchers
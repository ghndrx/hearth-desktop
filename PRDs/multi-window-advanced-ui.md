# PRD: Multi-Window Management & Advanced Desktop UI

**Document Status:** Draft
**Priority:** P0 (Critical)
**Target Release:** Q2 2026
**Owner:** Desktop UI Team
**Stakeholders:** Product, Engineering, UX, Platform

## Problem Statement

Hearth Desktop currently uses a single-window architecture, representing **0% parity** with Discord's advanced multi-window capabilities. Discord's flexible window management - including server pop-outs, picture-in-picture mode, multi-monitor support, and tabbed interfaces - is a major differentiator for power users and productivity workflows. This architectural limitation restricts user workflow flexibility and multi-tasking capabilities.

**Current Limitations:**
- Single monolithic window architecture
- No window pop-out or detachment capabilities
- Missing picture-in-picture mode for voice/video
- Limited multi-monitor workspace utilization
- No tabbed interface for managing multiple servers
- Cannot run multiple instances simultaneously

**Competitive Gap:**
Discord supports 5+ simultaneous windows, flexible layouts, and advanced workspace management. Hearth has 1 fixed window.

## Success Metrics

**Primary KPIs:**
- 60% of desktop users utilize multi-window features within 30 days of launch
- 45% increase in session duration for users with multiple windows
- 80% of users with multi-monitor setups use window distribution features
- 40% of power users adopt picture-in-picture mode for voice channels

**Technical Metrics:**
- Window creation time <300ms
- Memory overhead per additional window <50MB
- Cross-window state synchronization <100ms
- Support for 10+ simultaneous windows without performance degradation

## User Stories

### Power User Workflows

**As a power user, I want to:**
- Pop out individual server channels into separate windows
- Have voice channels in picture-in-picture mode while working
- Distribute Hearth windows across multiple monitors
- Open multiple server windows simultaneously
- Create custom window layouts and save them
- Quick-switch between window configurations

**As a community manager, I want to:**
- Monitor multiple servers in separate windows
- Keep moderation channels always visible in floating windows
- Use picture-in-picture for voice channel oversight
- Create dashboard-style layouts with key metrics
- Pop out administrative interfaces for multi-tasking

### Gaming & Streaming Workflows

**As a gamer, I want to:**
- Keep voice channel controls in a small overlay window
- Pop out game-specific channels during gameplay
- Use picture-in-picture for watching friends' streams while gaming
- Have minimal floating windows that don't interfere with games

**As a content creator, I want to:**
- Monitor chat in separate windows while streaming
- Create picture-in-picture views for audience engagement
- Use floating windows for stream controls and monitoring
- Maintain persistent voice controls in overlay mode

## Technical Requirements

### Core Architecture

**1. Multi-Window Runtime**
```rust
// src-tauri/src/window_manager.rs
pub struct WindowManager {
    primary_window: WebviewWindow,
    secondary_windows: HashMap<String, WindowInstance>,
    pip_windows: HashMap<String, PipWindow>,
    window_configs: WindowConfigManager,
}

pub enum WindowType {
    ServerChannel(ServerId, ChannelId),
    VoiceChannel(ChannelId),
    PictureInPicture(ContentType),
    FloatingPanel(PanelType),
    PopoutWidget(WidgetId),
}
```

**2. Window State Synchronization**
```typescript
// src/lib/stores/windowSync.ts
interface WindowState {
  windowId: string;
  type: WindowType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: ContentState;
  parentWindow?: string;
}

// Real-time state sync across all windows
class WindowSynchronizer {
  broadcastStateChange(windowId: string, state: Partial<WindowState>): void;
  subscribeToStateChanges(callback: StateChangeHandler): void;
  requestFullStateSync(): Promise<WindowState[]>;
}
```

**3. Picture-in-Picture Implementation**
```svelte
<!-- src/lib/components/PictureInPicture.svelte -->
<script>
  export let contentType: 'voice' | 'video' | 'stream';
  export let alwaysOnTop: boolean = true;
  export let snapToEdges: boolean = true;
  export let minimalUI: boolean = true;
</script>

<div class="pip-container" class:voice={contentType === 'voice'}>
  <slot />
  <div class="pip-controls">
    <button on:click={toggleAlwaysOnTop}>📌</button>
    <button on:click={expandToFullWindow}>⛶</button>
    <button on:click={closeWindow}>✕</button>
  </div>
</div>
```

**4. Tabbed Server Interface**
```svelte
<!-- src/lib/components/TabbedServerInterface.svelte -->
<script>
  export let servers: Server[];
  export let activeServerId: string;
  export let allowReordering: boolean = true;
  export let enablePopouts: boolean = true;
</script>

<div class="server-tabs">
  {#each servers as server (server.id)}
    <ServerTab
      {server}
      active={server.id === activeServerId}
      on:select={() => switchToServer(server.id)}
      on:popout={() => popoutServer(server.id)}
      on:close={() => closeServerTab(server.id)}
    />
  {/each}
  <button class="add-server-tab" on:click={addServerTab}>+</button>
</div>
```

### Window Management Features

**Multi-Window Layouts:**
- Server pop-outs with independent navigation
- Floating voice channel controls
- Picture-in-picture video streams
- Detachable settings and configuration panels
- Multi-monitor workspace distribution

**Window Persistence:**
- Save and restore window layouts
- Remember window positions across sessions
- Custom layout presets (work, gaming, streaming)
- Export/import workspace configurations

**Advanced Interactions:**
- Drag-and-drop between windows
- Cross-window content sharing
- Unified search across all windows
- Global shortcuts for window management

## Implementation Plan

### Phase 1: Core Multi-Window Architecture (Weeks 1-4)
- [ ] Implement Tauri multi-window runtime
- [ ] Create window instance management system
- [ ] Basic pop-out functionality for channels
- [ ] Cross-window state synchronization
- [ ] Window positioning and persistence

### Phase 2: Picture-in-Picture Mode (Weeks 5-8)
- [ ] Voice channel PiP implementation
- [ ] Video stream PiP support
- [ ] Always-on-top and snapping behavior
- [ ] Minimal UI controls for PiP windows
- [ ] Gaming overlay compatibility

### Phase 3: Advanced Window Management (Weeks 9-12)
- [ ] Tabbed server interface
- [ ] Custom layout designer
- [ ] Multi-monitor workspace distribution
- [ ] Window layout presets and templates
- [ ] Drag-and-drop window organization

### Phase 4: Power User Features (Weeks 13-16)
- [ ] Advanced window snapping and docking
- [ ] Global hotkeys for window management
- [ ] Window grouping and workspaces
- [ ] Performance optimization for multiple windows
- [ ] Accessibility features for window navigation

### Phase 5: Polish & Integration (Weeks 17-20)
- [ ] Integration with existing features (voice, gaming, etc.)
- [ ] Advanced customization options
- [ ] Window management analytics
- [ ] User onboarding and tutorials
- [ ] Performance monitoring and optimization

## Window Types & Use Cases

### Core Window Types
1. **Primary Window** - Main application interface
2. **Server Pop-outs** - Individual server interfaces
3. **Channel Windows** - Dedicated channel views
4. **Voice PiP** - Floating voice controls
5. **Settings Panels** - Configuration interfaces

### Gaming-Focused Windows
1. **Voice Overlay** - Minimal voice controls for gaming
2. **Game PiP** - Friend game status and chat
3. **Stream Viewer** - Picture-in-picture stream watching
4. **Quick Controls** - Essential gaming shortcuts

### Productivity Windows
1. **Multi-Server Dashboard** - Combined server monitoring
2. **Notification Center** - Centralized alerts
3. **Search Interface** - Global search across servers
4. **Analytics Panels** - Community insights

## Success Criteria

### MVP Acceptance Criteria
- [ ] Can pop out individual server channels into separate windows
- [ ] Picture-in-picture mode works for voice channels
- [ ] Window state persists across application restarts
- [ ] Basic multi-monitor support with window distribution
- [ ] Cross-window drag-and-drop functionality

### Full Feature Acceptance Criteria
- [ ] Support for 10+ simultaneous windows without performance issues
- [ ] Advanced layout management with custom presets
- [ ] Gaming overlay mode with minimal performance impact
- [ ] Accessibility compliance for window navigation
- [ ] Advanced window snapping and docking behaviors

## Risk Assessment

**High Risk:**
- Performance degradation with multiple windows
- Memory leaks in window lifecycle management
- Cross-window state synchronization complexity

**Medium Risk:**
- Platform-specific window behavior differences
- Gaming overlay compatibility issues
- User confusion with complex window management

**Mitigation Strategies:**
- Extensive performance testing with multiple window scenarios
- Platform-specific testing and optimization
- Progressive disclosure of advanced features
- Comprehensive user onboarding and tutorials
- Memory monitoring and automatic window cleanup

## Platform Considerations

### Windows
- Native window snapping integration
- Taskbar grouping for multiple windows
- Windows 11 snap layouts compatibility
- High DPI multi-monitor support

### macOS
- Mission Control integration
- Stage Manager compatibility
- Native window management APIs
- Retina display optimization

### Linux
- Multiple window manager compatibility
- Wayland and X11 support
- Desktop environment integration
- Virtual desktop awareness

## Dependencies

**External:**
- Tauri multi-window APIs
- Platform-specific window management libraries
- Graphics acceleration for multiple windows
- Accessibility frameworks

**Internal:**
- State management system refactoring
- IPC optimization for cross-window communication
- Performance monitoring infrastructure
- UI component architecture updates

## Competitive Analysis

**Discord Advantages:**
- Mature multi-window implementation
- Extensive user familiarity with window workflows
- Well-tested picture-in-picture modes
- Advanced gaming overlay integration

**Hearth Opportunities:**
- Modern Tauri architecture allows better window performance
- Native OS integration advantages
- Opportunity for superior multi-monitor support
- Better customization and workspace management

## Future Enhancements

**Post-MVP Features:**
- Window clustering and grouping
- Advanced window animations and transitions
- AI-powered layout recommendations
- Virtual desktop integration
- Remote window sharing and collaboration
- Advanced window scripting and automation

---
**Last Updated:** March 24, 2026
**Next Review:** Weekly Engineering Review
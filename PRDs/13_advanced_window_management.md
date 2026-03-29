# PRD #13: Advanced Window Management System

**Status**: Draft
**Priority**: P0 — Critical
**Assignee**: TBD
**Estimated effort**: 3-4 sprints
**Depends on**: Core desktop infrastructure

## Problem Statement

Hearth Desktop currently only supports a single main window, making it inferior to Discord for multitasking and professional use. Users need multi-window support, picture-in-picture video calls, always-on-top modes for gaming, and persistent window state. This is essential for productivity workflows and competitive gaming scenarios.

## Success Criteria

- [ ] Multi-window support for different conversations/servers
- [ ] Picture-in-picture (PiP) mode for video calls
- [ ] Always-on-top mode for overlay functionality
- [ ] Window state persistence (size, position, layout)
- [ ] Minimize to system tray while maintaining background operation
- [ ] Transparent window effects for gaming overlays
- [ ] Cross-platform window management (Windows, macOS, Linux)

## Requirements

### Functional Requirements

**Multi-Window Support**
- Create separate windows for different servers/conversations
- Independent window management (resize, move, close)
- Window identifier system for proper routing
- Window session persistence across app restarts
- Maximum 10 concurrent windows (performance limit)

**Picture-in-Picture (PiP) Mode**
- Detach video calls to floating window
- Resizable PiP window with aspect ratio preservation
- Always-on-top PiP by default
- Minimal UI controls (mute, camera, hang up)
- Snap-to-edge behavior for easy positioning
- Return to main window functionality

**Always-on-Top Mode**
- Toggle any window to stay above all other applications
- Persistent setting per window type
- Visual indicator when always-on-top is active
- Gaming overlay mode with transparent background
- Hotkey support for quick toggle

**Window State Management**
- Remember window size, position for each type
- Restore window layout on app restart
- Multi-monitor support with monitor-specific positioning
- Window snapping and docking behaviors
- Fullscreen and maximized state handling

**Advanced Window Features**
- Transparent/semi-transparent window modes
- Borderless window option for clean overlay
- Custom window decorations and title bars
- Window opacity controls
- Click-through mode for passive overlays

### Non-Functional Requirements

**Performance**
- Each window should have minimal performance impact
- Efficient memory management for multiple windows
- Smooth window animations and transitions
- 60 FPS rendering for video PiP windows

**User Experience**
- Intuitive window management controls
- Clear visual feedback for window states
- Consistent behavior across platforms
- Accessibility compliance for window features

**Platform Compatibility**
- Windows: Full feature support including transparency
- macOS: Native window behavior with proper decorations
- Linux: X11 and Wayland support with fallbacks

## Technical Specification

### Architecture Overview

```
Window Manager (Rust) ←→ Tauri Window API ←→ OS Window System
        ↓                                            ↓
Window Registry      ←→ Frontend Components ←→ Platform Handlers
        ↓                                            ↓
State Persistence   ←→ Event Bus            ←→ Window Controls
```

### Tauri Commands

```rust
// Create a new window
#[tauri::command]
async fn create_window(
    app: tauri::AppHandle,
    window_type: WindowType,
    config: WindowConfig
) -> Result<String, String>

// Update window properties
#[tauri::command]
async fn update_window_properties(
    window_id: String,
    properties: WindowProperties
) -> Result<(), String>

// Set always-on-top for window
#[tauri::command]
async fn set_always_on_top(
    window_id: String,
    always_on_top: bool
) -> Result<(), String>

// Create picture-in-picture window
#[tauri::command]
async fn create_pip_window(
    call_id: String,
    initial_position: Position
) -> Result<String, String>

// Get all active windows
#[tauri::command]
async fn get_active_windows() -> Result<Vec<WindowInfo>, String>

// Save window layout
#[tauri::command]
async fn save_window_layout() -> Result<(), String>

// Restore window layout
#[tauri::command]
async fn restore_window_layout() -> Result<(), String>
```

### Data Models

```typescript
interface WindowConfig {
  title: string;
  width: number;
  height: number;
  position?: Position;
  alwaysOnTop?: boolean;
  transparent?: boolean;
  decorations?: boolean;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
}

interface WindowType {
  type: 'main' | 'server' | 'dm' | 'pip' | 'overlay';
  identifier: string; // server_id, user_id, call_id, etc.
}

interface WindowProperties {
  opacity?: number;
  transparent?: boolean;
  alwaysOnTop?: boolean;
  clickThrough?: boolean;
  decorations?: boolean;
}

interface Position {
  x: number;
  y: number;
}

interface WindowInfo {
  id: string;
  type: WindowType;
  title: string;
  position: Position;
  size: { width: number; height: number };
  properties: WindowProperties;
  isVisible: boolean;
  isFocused: boolean;
}

interface WindowLayout {
  version: string;
  windows: Array<{
    type: WindowType;
    config: WindowConfig;
    properties: WindowProperties;
  }>;
  lastSaved: Date;
}
```

### Window Management System

**Window Registry**
```rust
pub struct WindowManager {
    windows: HashMap<String, WindowInfo>,
    layouts: HashMap<String, WindowLayout>,
    active_layout: Option<String>,
}

impl WindowManager {
    pub fn create_window(&mut self, config: WindowConfig) -> Result<String, Error>
    pub fn destroy_window(&mut self, window_id: &str) -> Result<(), Error>
    pub fn update_window(&mut self, window_id: &str, properties: WindowProperties) -> Result<(), Error>
    pub fn save_layout(&self, name: &str) -> Result<(), Error>
    pub fn restore_layout(&mut self, name: &str) -> Result<(), Error>
}
```

**Picture-in-Picture Implementation**
- Detach video component to separate window
- Maintain WebRTC connection in new window context
- Minimal UI with essential controls only
- Auto-resize based on video aspect ratio
- Snap-to-screen-edge behavior

**Always-on-Top Implementation**
- Use Tauri's `set_always_on_top()` method
- Platform-specific optimizations for performance
- Gaming overlay mode with transparency
- Hotkey integration for quick toggle

### Platform-Specific Features

**Windows Implementation**
- DirectComposition for hardware-accelerated transparency
- Windows 10+ snap assist integration
- Taskbar thumbnail previews for multiple windows
- Window animations via Windows Animation Manager

**macOS Implementation**
- Native window shadow and blur effects
- Mission Control and Spaces integration
- Proper window level management
- Retina display optimization

**Linux Implementation**
- X11 window manager hints for proper behavior
- Wayland protocol extensions where available
- Compositor-specific optimizations (GNOME, KDE, etc.)
- Fallback modes for older systems

### State Persistence

**Window Layout Storage**
```json
{
  "version": "1.0.0",
  "layouts": {
    "default": {
      "windows": [
        {
          "type": { "type": "main", "identifier": "main" },
          "config": {
            "title": "Hearth",
            "width": 1200,
            "height": 800,
            "position": { "x": 100, "y": 100 }
          },
          "properties": {
            "alwaysOnTop": false,
            "transparent": false,
            "decorations": true
          }
        }
      ]
    }
  },
  "preferences": {
    "autoRestoreLayout": true,
    "pipDefaultSize": { "width": 320, "height": 240 },
    "maxConcurrentWindows": 10
  }
}
```

## Implementation Plan

### Phase 1: Core Multi-Window (Sprint 1)
- Implement window manager infrastructure
- Add basic multi-window creation/destruction
- Window identifier and routing system
- Basic state persistence

### Phase 2: Advanced Window Features (Sprint 2)
- Always-on-top functionality
- Window transparency and opacity controls
- Custom window decorations
- Cross-platform compatibility testing

### Phase 3: Picture-in-Picture (Sprint 2-3)
- PiP window creation for video calls
- Video component detachment/reattachment
- PiP-specific UI controls
- Snap-to-edge behavior

### Phase 4: Window State Management (Sprint 3)
- Window layout save/restore system
- Multi-monitor support
- Window session persistence
- Layout import/export functionality

### Phase 5: Polish & Gaming Features (Sprint 3-4)
- Gaming overlay optimizations
- Click-through mode implementation
- Performance optimization for multiple windows
- Accessibility compliance
- Comprehensive testing

### Phase 6: Advanced Features (Sprint 4)
- Window snapping and docking
- Custom window layouts
- Window grouping and tabbing
- Advanced transparency effects

## Testing Strategy

**Functional Testing**
- Multi-window creation and management across platforms
- PiP functionality with active video calls
- Always-on-top behavior in various scenarios
- Window state persistence across app restarts
- Gaming overlay performance and compatibility

**Performance Testing**
- Memory usage with multiple windows
- CPU usage for window management operations
- GPU usage for transparency and effects
- Battery impact on laptops

**Compatibility Testing**
- Cross-platform window behavior consistency
- Multiple monitor configurations
- Various window managers (Linux)
- Gaming environment compatibility

## Success Metrics

- **User Adoption**: 40%+ of users use multi-window features
- **Performance**: < 5% additional memory per extra window
- **Gaming Compatibility**: Works with top 20 games without interference
- **User Satisfaction**: 4.5+ rating for window management features

## Risks & Mitigations

**Technical Risks**
- *Platform Incompatibilities*: Comprehensive testing matrix, graceful fallbacks
- *Performance Issues*: Efficient window management, resource limits
- *Gaming Conflicts*: Thorough game compatibility testing, opt-out options

**User Experience Risks**
- *Window Management Complexity*: Intuitive defaults, optional advanced features
- *Resource Usage*: Clear limits, automatic cleanup of unused windows

## Related Work

- Discord: Multi-window support, PiP voice calls, overlay mode
- Slack: Multi-workspace windows, floating message windows
- Microsoft Teams: PiP calls, multi-monitor support

## Future Considerations

- Window grouping and tabbing system
- Virtual desktop integration
- Advanced window animations
- Window sharing between users
- Custom window themes and styling
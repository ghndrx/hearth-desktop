# PRD #14: Rich Tray Integration System

**Status**: Draft
**Priority**: P1 — High
**Assignee**: TBD
**Estimated effort**: 2-3 sprints
**Depends on**: Core desktop infrastructure

## Problem Statement

Hearth Desktop's current system tray implementation is basic, only supporting click-to-show functionality. Discord offers rich tray integration with status indicators, context menus, notification badges, and quick actions. This limits Hearth's effectiveness as a background communication app and reduces user engagement when the app is minimized.

## Success Criteria

- [ ] Rich context menu with quick actions and status
- [ ] Visual status indicators on tray icon (online, away, DND, in call)
- [ ] Notification badges showing unread message count
- [ ] Tray icon animations for incoming calls/messages
- [ ] Quick access to key functions without opening main window
- [ ] Cross-platform tray behavior (Windows, macOS, Linux)
- [ ] Proper tray icon theming for light/dark system themes

## Requirements

### Functional Requirements

**Rich Context Menu**
- Right-click context menu with quick actions
- Status selection (Online, Away, Do Not Disturb, Invisible)
- Quick server/channel navigation
- Mute/unmute toggle
- Join last voice channel
- Show/hide main window
- Quit application

**Status Indicators**
- Visual tray icon changes based on user status
- Call indicator (different icon when in voice/video call)
- Connection status indicator (connected/disconnected/reconnecting)
- Do Not Disturb visual indicator
- Away/idle status visualization

**Notification Integration**
- Unread message count badge on tray icon
- Animated icon for incoming calls
- Flash/pulse animation for high-priority notifications
- Different animations for different notification types
- Respect system notification preferences

**Quick Actions**
- Join/leave voice channels from tray
- Set status without opening app
- Quick reply to recent messages
- Snooze notifications
- Toggle microphone/camera globally

**Platform-Specific Features**
- Windows: Taskbar integration with notification badges
- macOS: Menu bar icon with system theme adaptation
- Linux: System tray with desktop environment integration

### Non-Functional Requirements

**Performance**
- Minimal CPU usage for tray operations (< 1%)
- Smooth animations without blocking main thread
- Fast context menu rendering (< 100ms)
- Efficient icon updates for status changes

**User Experience**
- Intuitive right-click vs left-click behavior
- Clear visual feedback for all actions
- Consistent behavior across platforms
- Accessibility support for tray interactions

**System Integration**
- Proper theming with system light/dark modes
- High DPI display support
- Multiple monitor awareness
- Graceful handling of missing tray support

## Technical Specification

### Architecture Overview

```
Tray Manager (Rust) ←→ System Tray API ←→ OS Tray System
        ↓                                        ↓
Icon Generator      ←→ Event Handler    ←→ Platform Handlers
        ↓                                        ↓
State Monitor       ←→ Action Dispatcher ←→ App Controllers
```

### Tauri Commands

```rust
// Update tray icon status
#[tauri::command]
async fn update_tray_status(
    app: tauri::AppHandle,
    status: UserStatus,
    badge_count: Option<u32>
) -> Result<(), String>

// Set tray icon animation
#[tauri::command]
async fn set_tray_animation(
    animation_type: TrayAnimation,
    duration_ms: u32
) -> Result<(), String>

// Update tray menu
#[tauri::command]
async fn update_tray_menu(
    menu_items: Vec<TrayMenuItem>
) -> Result<(), String>

// Handle tray action
#[tauri::command]
async fn handle_tray_action(
    action: TrayAction
) -> Result<(), String>

// Get tray capabilities
#[tauri::command]
async fn get_tray_capabilities() -> Result<TrayCapabilities, String>
```

### Data Models

```typescript
interface UserStatus {
  type: 'online' | 'away' | 'dnd' | 'invisible' | 'offline';
  message?: string;
  inCall?: boolean;
  connecting?: boolean;
}

interface TrayAnimation {
  type: 'pulse' | 'flash' | 'bounce' | 'rotate' | 'none';
  intensity: 'low' | 'medium' | 'high';
  loop: boolean;
}

interface TrayMenuItem {
  id: string;
  label: string;
  action: TrayAction;
  enabled: boolean;
  separator?: boolean;
  submenu?: TrayMenuItem[];
  icon?: string;
  shortcut?: string;
}

interface TrayAction {
  type: 'show_window' | 'set_status' | 'join_voice' | 'toggle_mute' |
        'quick_reply' | 'snooze_notifications' | 'quit';
  payload?: any;
}

interface TrayCapabilities {
  supportsCustomIcons: boolean;
  supportsBadges: boolean;
  supportsAnimations: boolean;
  supportsContextMenu: boolean;
  supportsTooltips: boolean;
  maxMenuItems: number;
}
```

### Icon Generation System

**Dynamic Icon Generation**
```rust
pub struct TrayIconGenerator {
    base_icon: Vec<u8>,
    status_overlays: HashMap<UserStatus, Vec<u8>>,
    badge_renderer: BadgeRenderer,
}

impl TrayIconGenerator {
    pub fn generate_icon(&self, status: UserStatus, badge_count: Option<u32>) -> Vec<u8>
    pub fn generate_animated_frames(&self, animation: TrayAnimation) -> Vec<Vec<u8>>
    pub fn apply_status_overlay(&self, base: &[u8], status: UserStatus) -> Vec<u8>
    pub fn render_badge(&self, icon: &[u8], count: u32) -> Vec<u8>
}
```

**Icon States**
- **Online**: Green circle overlay
- **Away**: Yellow/orange crescent overlay
- **Do Not Disturb**: Red circle with white line overlay
- **Invisible/Offline**: Grayed out icon
- **In Call**: Microphone or video camera overlay
- **Connecting**: Animated dots or spinner overlay

**Badge System**
- Numeric badges for unread counts (1-99, 99+)
- Different badge styles per platform
- High contrast colors for accessibility
- Proper scaling for various icon sizes

### Context Menu System

**Menu Structure**
```
Hearth
├── Status
│   ├── 🟢 Online
│   ├── 🟡 Away
│   ├── 🔴 Do Not Disturb
│   └── ⚫ Invisible
├── ─────────────
├── 🔊 Voice Channel: General (click to leave)
├── 🎤 Mute/Unmute
├── 📹 Camera Toggle
├── ─────────────
├── Quick Actions
│   ├── Join Last Channel
│   ├── Quick Reply
│   └── Snooze Notifications (30m)
├── ─────────────
├── Show Hearth
└── Quit
```

**Dynamic Menu Updates**
- Real-time status updates
- Contextual options based on current state
- Server/channel quick access (top 5 recent)
- Notification management options

### Platform Implementation

**Windows Implementation**
```rust
// Windows tray with notification area integration
use windows::Win32::UI::Shell::{Shell_NotifyIconW, NIM_ADD, NIM_MODIFY, NOTIFYICONDATAW};

pub struct WindowsTrayManager {
    icon_id: u32,
    hwnd: HWND,
    icon_data: NOTIFYICONDATAW,
}
```

**macOS Implementation**
```rust
// macOS menu bar integration
use cocoa::appkit::{NSStatusBar, NSStatusItem};

pub struct MacOSTrayManager {
    status_item: NSStatusItem,
    menu: NSMenu,
    icon: NSImage,
}
```

**Linux Implementation**
```rust
// Linux system tray with DBus StatusNotifierItem
use dbus::blocking::Connection;

pub struct LinuxTrayManager {
    connection: Connection,
    path: String,
    properties: HashMap<String, Variant<Box<dyn RefArg + Send + Sync>>>,
}
```

### Animation System

**Smooth Animations**
- Frame-based animation for smooth transitions
- Configurable animation speeds and styles
- Efficient frame caching and memory management
- Respect system performance settings

**Animation Types**
- **Pulse**: Gentle brightness/size pulsing for notifications
- **Flash**: Quick flash for urgent messages
- **Bounce**: Playful bounce for incoming calls
- **Rotate**: Spinning indicator for connecting state
- **Badge Pop**: Smooth badge appearance/disappearance

## Implementation Plan

### Phase 1: Enhanced Tray Foundation (Sprint 1)
- Upgrade basic tray with enhanced click handling
- Implement dynamic icon generation system
- Add basic context menu with core actions
- Cross-platform tray icon rendering

### Phase 2: Status and Badge System (Sprint 1-2)
- Visual status indicators with icon overlays
- Notification badge system with count display
- Status selection from tray menu
- High DPI and theme adaptation

### Phase 3: Advanced Menu and Actions (Sprint 2)
- Rich context menu with submenus
- Quick actions implementation
- Real-time menu updates
- Voice channel integration

### Phase 4: Animations and Polish (Sprint 2-3)
- Tray icon animation system
- Smooth transitions and effects
- Performance optimization
- Platform-specific enhancements

### Phase 5: Testing and Optimization (Sprint 3)
- Cross-platform testing and bug fixes
- Performance profiling and optimization
- Accessibility compliance
- Documentation and user guides

## Testing Strategy

**Functional Testing**
- Context menu functionality across platforms
- Status indicator accuracy and real-time updates
- Badge count accuracy with message state
- Animation performance and smoothness
- Quick action execution and feedback

**Platform Testing**
- Windows: Taskbar integration, notification area behavior
- macOS: Menu bar integration, system theme adaptation
- Linux: Various desktop environments (GNOME, KDE, XFCE)
- High DPI displays and scaling factors

**Performance Testing**
- CPU usage during animations and updates
- Memory usage for icon caching and generation
- Responsiveness of tray interactions
- Battery impact on mobile devices

**User Experience Testing**
- Discoverability of tray features
- Intuitive interaction patterns
- Visual clarity of status indicators
- Accessibility with screen readers

## Success Metrics

- **Feature Adoption**: 70%+ of users regularly use tray features
- **Performance**: < 1% CPU usage for tray operations
- **User Satisfaction**: 4.3+ rating for tray functionality
- **Platform Coverage**: Full feature parity across Windows/macOS/Linux

## Risks & Mitigations

**Technical Risks**
- *Platform Inconsistencies*: Comprehensive testing, platform-specific fallbacks
- *Performance Issues*: Efficient icon caching, animation optimization
- *Tray Support Variations*: Graceful degradation, feature detection

**User Experience Risks**
- *Feature Overload*: Clean menu organization, configurable options
- *Platform Expectations*: Follow platform-specific UI guidelines

## Related Work

- Discord: Comprehensive tray integration with status, badges, and quick actions
- Slack: Status indicators, notification badges, workspace switching
- Microsoft Teams: Call status, quick actions, notification management
- Telegram: Message badges, status indicators, quick reply

## Future Considerations

- Custom tray icon themes
- Advanced notification management
- Tray widget for extended functionality
- Integration with system focus modes
- Voice command integration from tray
- Multi-account tray support
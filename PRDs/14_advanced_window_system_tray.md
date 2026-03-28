# PRD: Advanced Window Management & System Tray

## Overview

**Priority**: P1 (High)
**Timeline**: 4-6 weeks
**Owner**: Native/UI Team

Implement advanced window management and enhanced system tray functionality to provide power user features that exceed Discord's desktop experience and leverage native OS capabilities.

## Problem Statement

Hearth Desktop's current window management is basic, lacking advanced features that power users expect from native desktop applications. Current limitations:
- Basic system tray with minimal functionality
- No window state persistence across sessions
- Limited multi-monitor support and window positioning
- Missing native OS integration features
- No advanced window behaviors (always-on-top, transparent windows)

**Current Gap**: Discord has basic window management but lacks advanced native features. This is an opportunity for Hearth Desktop to exceed Discord's capabilities with sophisticated window management that leverages Tauri's native advantages.

## Success Metrics

- **Power User Adoption**: 80% of daily users configure advanced window features
- **Session Persistence**: 95% accurate window state restoration
- **Multi-Monitor Usage**: 60% of multi-monitor users utilize advanced positioning
- **Tray Engagement**: 70% of users interact with enhanced tray features
- **Performance**: <1% CPU overhead for window management

## User Stories

### Advanced Window Management
- As a multi-monitor user, I want window position memory so the app opens on the correct monitor
- As a power user, I want always-on-top mode for voice channel popouts so I can monitor activity
- As a streamer, I want transparent/overlay windows so I can show voice activity during streams
- As a productivity user, I want window snapping and positioning shortcuts for efficient workflow

### Enhanced System Tray
- As a user, I want rich tray notifications with actions so I can respond without opening the app
- As a multitasker, I want tray quick actions for mute/unmute so I can control audio from anywhere
- As a busy user, I want smart tray badge counts that distinguish between mentions and regular messages
- As a user, I want tray context menu shortcuts for common actions

### Session Management
- As a user, I want window state restoration so the app remembers my setup across restarts
- As a remote worker, I want profile-based window layouts for different work contexts
- As a user, I want workspace integration so windows integrate with OS virtual desktops
- As a laptop user, I want adaptive layouts that respond to monitor configuration changes

## Technical Requirements

### Window Management System (Rust/Tauri)

- **Window State Persistence**
  - Position, size, and monitor information storage
  - Multi-monitor configuration detection and adaptation
  - Window state restoration with validation
  - Layout profiles for different use cases

- **Advanced Window Behaviors**
  - Always-on-top mode for specific window types
  - Window transparency and opacity controls
  - Custom window shapes and borders
  - Window snapping and positioning APIs

- **Multi-Monitor Support**
  - Per-monitor DPI awareness
  - Cross-monitor window movement
  - Monitor configuration change detection
  - Smart window positioning based on monitor layout

### Enhanced System Tray (Native)

- **Rich Notification System**
  - Custom notification templates with actions
  - Grouped notifications by channel/server
  - Interactive notification responses
  - Notification persistence and history

- **Tray Menu System**
  - Dynamic context menu generation
  - Quick action shortcuts (mute, status, etc.)
  - Recent channels/servers access
  - Settings and preferences shortcuts

- **Badge and Status System**
  - Smart badge counting algorithms
  - Visual distinction for mentions vs. messages
  - Connection status indicators
  - Activity-based tray icon changes

## Technical Specifications

### Window Management Implementation

```rust
// Advanced window management system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    pub id: String,
    pub window_type: WindowType,
    pub position: WindowPosition,
    pub size: WindowSize,
    pub state: WindowState,
    pub behavior: WindowBehavior,
    pub monitor_id: Option<String>,
}

#[derive(Debug, Clone)]
pub enum WindowType {
    Main,
    VoicePopout,
    Settings,
    Overlay,
    Notification,
}

#[derive(Debug, Clone)]
pub struct WindowBehavior {
    pub always_on_top: bool,
    pub transparent: bool,
    pub opacity: f32,
    pub resizable: bool,
    pub minimizable: bool,
    pub closable: bool,
    pub skip_taskbar: bool,
}

// Window state manager
pub struct WindowManager {
    windows: HashMap<String, WindowConfig>,
    monitors: Vec<Monitor>,
    active_profile: Option<String>,
    state_file: PathBuf,
}

impl WindowManager {
    pub fn save_window_state(&self, window_id: &str) -> Result<()> {
        // Persist window configuration
    }

    pub fn restore_window_state(&self, window_id: &str) -> Result<WindowConfig> {
        // Restore saved configuration with validation
    }

    pub fn adapt_to_monitor_change(&mut self) -> Result<()> {
        // Handle monitor configuration changes
    }
}

// Platform-specific window APIs
#[cfg(target_os = "windows")]
mod windows_window {
    use windows::Win32::UI::WindowsAndMessaging::*;

    pub fn set_always_on_top(hwnd: HWND, enabled: bool) -> Result<()> {
        SetWindowPos(hwnd, if enabled { HWND_TOPMOST } else { HWND_NOTOPMOST }, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)?;
        Ok(())
    }

    pub fn set_window_opacity(hwnd: HWND, opacity: f32) -> Result<()> {
        // SetLayeredWindowAttributes for transparency
    }
}

#[cfg(target_os = "macos")]
mod macos_window {
    use cocoa::appkit::{NSWindow, NSWindowLevel};

    pub fn set_window_level(window: &NSWindow, level: NSWindowLevel) {
        window.setLevel_(level);
    }
}
```

### Enhanced System Tray Implementation

```rust
// Enhanced system tray with rich functionality
#[derive(Debug)]
pub struct EnhancedSystemTray {
    tray_icon: TrayIcon,
    notification_manager: NotificationManager,
    badge_counter: BadgeCounter,
    menu_builder: TrayMenuBuilder,
}

#[derive(Debug, Clone)]
pub struct TrayNotification {
    pub id: String,
    pub title: String,
    pub body: String,
    pub icon: Option<PathBuf>,
    pub actions: Vec<NotificationAction>,
    pub priority: NotificationPriority,
    pub group_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct NotificationAction {
    pub id: String,
    pub label: String,
    pub action_type: ActionType,
}

#[derive(Debug, Clone)]
pub enum ActionType {
    Reply,
    Join,
    Mute,
    Dismiss,
    MarkAsRead,
    Custom(String),
}

// Smart badge counting
pub struct BadgeCounter {
    total_unread: u32,
    mention_count: u32,
    dm_count: u32,
    priority_channels: HashSet<String>,
}

impl BadgeCounter {
    pub fn calculate_badge(&self) -> TrayBadge {
        if self.mention_count > 0 {
            TrayBadge::Urgent(self.mention_count)
        } else if self.dm_count > 0 {
            TrayBadge::Important(self.dm_count)
        } else if self.total_unread > 0 {
            TrayBadge::Normal(self.total_unread)
        } else {
            TrayBadge::None
        }
    }
}

// Dynamic tray menu
pub struct TrayMenuBuilder;

impl TrayMenuBuilder {
    pub fn build_context_menu(&self, app_state: &AppState) -> TrayMenu {
        let mut menu = TrayMenu::new();

        // Quick actions
        menu.add_section("Quick Actions");
        menu.add_item(TrayMenuItem::toggle("Mute", app_state.is_muted));
        menu.add_item(TrayMenuItem::toggle("Deafen", app_state.is_deafened));

        // Recent channels
        if !app_state.recent_channels.is_empty() {
            menu.add_section("Recent Channels");
            for channel in &app_state.recent_channels[..3] {
                menu.add_item(TrayMenuItem::action(&channel.name, ActionType::JoinChannel(channel.id.clone())));
            }
        }

        // Standard items
        menu.add_separator();
        menu.add_item(TrayMenuItem::action("Open", ActionType::ShowWindow));
        menu.add_item(TrayMenuItem::action("Settings", ActionType::ShowSettings));
        menu.add_item(TrayMenuItem::action("Quit", ActionType::Quit));

        menu
    }
}
```

### Window Layout Profiles

```rust
// Layout profile system for different contexts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutProfile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub windows: Vec<WindowConfig>,
    pub triggers: Vec<LayoutTrigger>,
}

#[derive(Debug, Clone)]
pub enum LayoutTrigger {
    MonitorConfigChange,
    TimeOfDay(Time),
    ApplicationLaunch(String),
    UserAction,
}

pub struct LayoutManager {
    profiles: HashMap<String, LayoutProfile>,
    active_profile: Option<String>,
    auto_switching: bool,
}

impl LayoutManager {
    pub fn apply_profile(&mut self, profile_id: &str) -> Result<()> {
        // Apply window configuration from profile
    }

    pub fn detect_optimal_profile(&self, context: &SystemContext) -> Option<String> {
        // AI-based profile suggestion based on current context
    }
}
```

## Implementation Phases

### Phase 1: Core Window Management (2 weeks)
- Window state persistence and restoration
- Basic multi-monitor support and positioning
- Window configuration storage and validation
- Always-on-top and transparency features

### Phase 2: Enhanced System Tray (2 weeks)
- Rich notification system with actions
- Smart badge counting and visual indicators
- Dynamic tray menu with quick actions
- Tray icon state management

### Phase 3: Advanced Features (1 week)
- Layout profiles and workspace integration
- Window snapping and positioning shortcuts
- Monitor configuration change handling
- Performance optimization and testing

### Phase 4: Power User Features (1 week)
- Custom window shapes and advanced behaviors
- Automation triggers and smart switching
- Integration with OS virtual desktops
- Advanced keyboard shortcuts for window management

## Platform Integration Details

### Windows
- **Window Management**: Win32 SetWindowPos, SetLayeredWindowAttributes
- **System Tray**: Shell_NotifyIcon, notification balloons
- **Multi-Monitor**: EnumDisplayMonitors, GetMonitorInfo
- **Virtual Desktops**: Windows 10/11 Virtual Desktop APIs

### macOS
- **Window Management**: NSWindow, NSScreen, Mission Control
- **System Tray**: NSStatusBar, NSUserNotification
- **Spaces**: NSWorkspace, Spaces API
- **Accessibility**: AXUIElement for advanced window control

### Linux
- **Window Management**: X11 Extended Window Manager Hints, Wayland protocols
- **System Tray**: StatusNotifierItem (KDE), AppIndicator (GNOME)
- **Multi-Monitor**: RandR, Wayland output protocols
- **Virtual Desktops**: _NET_CURRENT_DESKTOP, workspace switching

## Performance Requirements

- **Window State Save/Restore**: <100ms for complex layouts
- **Tray Updates**: <50ms for badge/icon changes
- **Monitor Detection**: <200ms for configuration changes
- **Memory Usage**: <10MB for window management system
- **CPU Usage**: <0.5% during normal operation

## User Experience Design

### Window Behaviors
- **Smart Positioning**: Remember per-monitor positions intelligently
- **Graceful Degradation**: Handle missing monitors and configuration changes
- **Visual Feedback**: Clear indication of window state changes
- **Keyboard Shortcuts**: Intuitive shortcuts for power user features

### System Tray Interaction
- **Progressive Disclosure**: Show relevant options based on context
- **Visual Hierarchy**: Clear distinction between notification types
- **Quick Actions**: Most common actions accessible with minimal clicks
- **Notification Grouping**: Logical grouping to prevent notification spam

## Dependencies

- **Settings System**: Window configuration storage
- **Theme System**: Window styling and tray icon variants
- **Notification System**: Integration with existing notification pipeline
- **Keyboard Shortcuts**: Global hotkey system integration

## Success Criteria

### MVP Definition
- Window position/size persistence across sessions
- Enhanced system tray with badge counts and quick actions
- Basic multi-monitor support with position memory
- Always-on-top functionality for voice popouts
- Rich notifications with action buttons

### Full Feature Success
- 95% accurate window restoration across different monitor configurations
- Sub-second window layout switching between profiles
- Zero-click tray interactions for common actions
- Seamless integration with OS virtual desktop systems
- Advanced window behaviors (transparency, custom shapes) working reliably

## Competitive Analysis

### vs Discord Window Management
- **Matching**: Basic window management, system tray functionality
- **Exceeding**: Advanced positioning, layout profiles, power user features
- **Missing**: None - this is a differentiation opportunity

### vs Native OS Features
- **Complementing**: Work with OS window management rather than replacing
- **Enhancing**: Add application-specific intelligence to OS primitives
- **Extending**: Provide features not available in standard OS window managers

## Future Enhancements

- **AI-Powered Layout Suggestions**: Machine learning for optimal window positioning
- **Voice-Controlled Window Management**: Voice commands for window operations
- **Gesture Support**: Touch and trackpad gestures for window manipulation
- **Multi-Device Sync**: Window layout sync across multiple devices
- **Workspace Templates**: Shareable window configuration templates
- **Integration APIs**: Allow third-party plugins to extend window management
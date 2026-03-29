# PRD #13: Rich System Tray & Enhanced Window Management

**Status:** Not Started
**Priority:** P0 (Critical)
**Effort:** 2-3 weeks
**Epic:** Desktop Parity with Discord

## Problem Statement

Hearth Desktop's system tray integration is minimal compared to Discord:
- Basic tray icon with click-to-show only
- No right-click context menu with quick actions
- Missing unread message indicators and badge counts
- No advanced window management (always-on-top, minimize behavior)
- No system notification action buttons
- No quick status controls from tray

Discord users rely heavily on tray interactions for quick status changes, direct navigation, and system integration. This gap reduces productivity for power users.

## Success Criteria

1. **Rich Tray Menu**: Right-click context menu with common actions (status, mute, quit)
2. **Visual Indicators**: Tray icon changes with unread messages, voice channel status
3. **Quick Actions**: Change status, toggle mute, open specific channels from tray
4. **Advanced Window Management**: Always-on-top mode, minimize-to-tray behavior
5. **System Integration**: Native taskbar/dock badge counts, notification actions
6. **Cross-Platform Consistency**: Uniform behavior across Windows, macOS, Linux

## Requirements

### Functional Requirements

**F-TRAY-01**: Rich Context Menu
- Right-click tray icon shows context menu with:
  - User status (Online, Away, DND, Invisible)
  - Quick toggle: Mute microphone, Deafen headphones
  - Open to specific channel (last 3 visited channels)
  - Unread messages count and navigation
  - Settings shortcut
  - Quit application
- Menu updates dynamically based on connection status
- Keyboard shortcuts displayed next to menu items

**F-TRAY-02**: Visual Status Indicators
- Default: Hearth logo in system colors
- Unread messages: Orange notification dot overlay
- Voice channel connected: Green microphone icon overlay
- Muted state: Red slash through microphone
- Away/DND status: Grayed out icon with status color border
- Connecting state: Animated pulse effect

**F-TRAY-03**: Badge Count Integration
- macOS: Dock badge with unread message count
- Windows: Taskbar badge with notification count
- Linux: Desktop notification with persistent count
- Badge clears when messages are read or app is focused
- Support for 99+ overflow display

**F-TRAY-04**: Enhanced Window Management
- Window state persistence (position, size, maximized state)
- Always-on-top mode toggle (keyboard shortcut + menu item)
- Minimize behavior options:
  - Minimize to taskbar (default)
  - Minimize to tray only
  - Close to tray (hide window)
- Multi-monitor support with smart positioning
- Window snapping and docking hints

**F-TRAY-05**: System Notification Actions
- Notification action buttons:
  - "Reply" - opens message compose
  - "Mark as Read" - dismisses notification
  - "Join Voice" - joins voice channel
  - "View Channel" - navigates to channel
- Rich notification content with avatars and previews
- Notification grouping by channel/server

### Non-Functional Requirements

**NF-TRAY-01**: Performance
- Tray menu opens within 100ms of right-click
- Icon updates within 50ms of status change
- Window state saves/restores within 200ms
- Memory overhead under 10MB for tray components

**NF-TRAY-02**: Cross-Platform Compatibility
- Consistent behavior across Windows 10/11, macOS 12+, Linux (GNOME/KDE)
- Proper high-DPI scaling for tray icons
- System theme integration (light/dark mode)
- Native look and feel per platform

**NF-TRAY-03**: Accessibility
- Screen reader announcements for tray icon status
- Keyboard navigation for context menu
- High contrast mode support for tray icons
- Focus management for window operations

## Technical Architecture

### Backend Components (Tauri/Rust)

```rust
// src-tauri/src/tray_manager.rs
#[tauri::command]
async fn update_tray_icon(status: TrayStatus) -> Result<(), String>

#[tauri::command]
async fn set_badge_count(count: i32) -> Result<(), String>

#[tauri::command]
async fn toggle_always_on_top() -> Result<bool, String>

#[tauri::command]
async fn set_window_state(state: WindowState) -> Result<(), String>

// src-tauri/src/window_manager.rs
#[tauri::command]
async fn save_window_position() -> Result<(), String>

#[tauri::command]
async fn restore_window_position() -> Result<(), String>
```

### Frontend Integration (Svelte)

```typescript
// src/lib/stores/tray.ts
export interface TrayState {
  unreadCount: number;
  voiceStatus: 'disconnected' | 'connected' | 'muted';
  userStatus: 'online' | 'away' | 'dnd' | 'invisible';
  alwaysOnTop: boolean;
  minimizeBehavior: 'taskbar' | 'tray' | 'close-to-tray';
}

// src/lib/components/TrayManager.svelte
// Handles state synchronization between frontend and tray
```

### System Integration

**Windows:**
- `SetWindowPos` for always-on-top
- `Shell_NotifyIcon` for tray management
- `SetTaskbarProgress` for badge counts

**macOS:**
- `NSApp.dockTile.badgeLabel` for dock badges
- `NSStatusBar` for menu bar integration
- `NSWindow.level` for window ordering

**Linux:**
- `libayatana-appindicator` for system tray
- `libnotify` for notification actions
- `gtk4` for native menu integration

## Implementation Plan

### Phase 1: Enhanced Tray Icon (Week 1)
- Implement dynamic icon generation with overlays
- Add status-based icon variations (online, away, muted)
- Create icon asset pipeline for different system themes
- Add unread message indicator dot

### Phase 2: Rich Context Menu (Week 1-2)
- Build native context menu with Tauri system tray API
- Add user status controls (online, away, DND, invisible)
- Implement quick actions (mute, deafen, open channels)
- Add keyboard shortcuts integration

### Phase 3: Badge Integration (Week 2)
- Implement cross-platform badge count system
- Add macOS dock badge support
- Create Windows taskbar badge integration
- Build Linux notification count system

### Phase 4: Window Management (Week 2-3)
- Add always-on-top toggle functionality
- Implement window state persistence
- Create minimize behavior options
- Add multi-monitor positioning support

### Phase 5: Notification Actions (Week 3)
- Extend existing notification system with action buttons
- Implement notification routing to app actions
- Add rich notification content with previews
- Create notification grouping logic

## Testing Strategy

### Unit Tests
- Icon generation for various status combinations
- Badge count formatting (1, 99, 99+)
- Window state serialization/deserialization
- Context menu action mapping

### Integration Tests
- Tray icon updates on status change
- Badge count synchronization with message state
- Window position persistence across app restarts
- Cross-platform tray behavior consistency

### Manual Testing
- Right-click responsiveness across platforms
- Icon clarity at various system scales (100%, 125%, 150%, 200%)
- Always-on-top behavior with multiple windows
- Notification action workflow end-to-end

## Security Considerations

**Tray Menu Actions:**
- Validate user permissions before status changes
- Rate limiting for rapid status updates
- Secure channel navigation (prevent unauthorized access)

**Window Management:**
- Bounds checking for window positioning (prevent off-screen)
- Z-order security (prevent always-on-top abuse)
- Monitor configuration validation

## Dependencies & Blockers

**Dependencies:**
- User authentication system - for status management
- Message system - for unread count calculation
- Voice connection manager - for voice status indication
- Settings system - for minimize behavior preferences

**Technical Dependencies:**
- Tauri 2 tray API enhancements
- Platform-specific native libraries
- Icon generation pipeline (SVG to platform formats)

## Success Metrics

**User Experience Metrics:**
- Tray interaction frequency > 5 interactions per user per day
- Context menu usage rate > 40% of tray interactions
- Always-on-top adoption rate > 20% of users

**Technical Metrics:**
- Tray menu response time < 100ms
- Icon update latency < 50ms
- Window restore accuracy > 99% (correct position/size)

**Competitive Parity Metrics:**
- Feature comparison vs Discord tray: 95%+
- User satisfaction for system integration: 4.5/5

## Platform-Specific Considerations

### Windows
- Tray icon size: 16x16 standard, 20x20 high-DPI
- Context menu theming follows system dark/light mode
- Taskbar badge integration via Windows API
- Notification actions via WinRT ToastNotification API

### macOS
- Menu bar icon: 16x16 template icon (auto-inverts for dark mode)
- Dock badge: red circle with white text
- Context menu follows macOS Human Interface Guidelines
- Window management via Cocoa frameworks

### Linux
- System tray: 22x22 SVG icon recommended
- Desktop environment integration (GNOME Shell, KDE Plasma)
- Notification actions via D-Bus interface
- Theme integration via GTK/Qt system settings

---

**Related PRDs:** #01 (Text Messaging), #12 (File Integration), #14 (Game Integration)
**Technical Dependencies:** Tauri 2 system tray, native OS APIs
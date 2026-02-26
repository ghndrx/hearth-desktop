# System Tray UX and Menus

> Research Date: February 26, 2026  
> Focus: System tray patterns for Hearth Desktop (Tauri 2.x)

## Executive Summary

System tray (Windows/Linux) and menu bar (macOS) integration is essential for communication apps that need persistent background presence. This document covers Tauri 2.x implementation patterns and UX best practices derived from Discord, Slack, and Element.

---

## 1. Platform Differences

### Windows (Notification Area)
- Located in taskbar notification area (bottom-right)
- Right-click = context menu (standard)
- Left-click = show/hide window OR popup menu (app choice)
- Double-click = show window (common pattern)
- Badge/overlay icons supported for unread counts

### macOS (Menu Bar Extras)
- Located in top menu bar (right side)
- Left-click = dropdown menu (standard pattern)
- No double-click convention
- Template images (monochrome) adapt to light/dark mode automatically
- No badge overlays - use title text or icon changes

### Linux
- Varies by desktop environment (GNOME, KDE, etc.)
- AppIndicator/StatusNotifierItem protocols
- Some DEs have removed/hidden tray entirely
- libappindicator dependency often required
- Most limited and inconsistent platform

---

## 2. Tauri 2.x Implementation

### Dependencies

```toml
# Cargo.toml
[dependencies]
tauri = { version = "2.0.0", features = ["tray-icon", "image-png"] }
```

### Basic Setup (Rust)

```rust
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem},
    tray::TrayIconBuilder,
};

fn enable_tray(app: &mut tauri::App) {
    // Create menu items
    let open_item = MenuItem::with_id(app, "open", "Open Hearth", true, None::<&str>).unwrap();
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>).unwrap();
    let quit_item = MenuItem::with_id(app, "quit", "Quit Hearth", true, None::<&str>).unwrap();

    // Build menu with separators
    let menu = MenuBuilder::new(app)
        .item(&open_item)
        .separator()
        .item(&settings_item)
        .separator()
        .item(&quit_item)
        .build()
        .unwrap();

    // Create tray icon
    let _tray = TrayIconBuilder::with_id("hearth-tray")
        .icon(Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
            .expect("Failed to load tray icon"))
        .menu(&menu)
        .tooltip("Hearth")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "open" => show_main_window(app),
                "settings" => open_settings(app),
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            match event.click_type {
                ClickType::Left => {
                    // Toggle window visibility on left click
                    toggle_main_window(tray.app_handle());
                }
                ClickType::Double => {
                    // Show and focus on double-click
                    show_and_focus_window(tray.app_handle());
                }
                _ => {}
            }
        })
        .build(app)
        .unwrap();
}
```

### JavaScript API Alternative

```typescript
import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { defaultWindowIcon } from '@tauri-apps/api/app';

async function setupTray() {
  const menu = await Menu.new({
    items: [
      { id: 'open', text: 'Open Hearth', action: () => showWindow() },
      { type: 'separator' },
      { id: 'settings', text: 'Settings...', action: () => openSettings() },
      { type: 'separator' },
      { id: 'quit', text: 'Quit Hearth', action: () => quitApp() },
    ],
  });

  const tray = await TrayIcon.new({
    icon: await defaultWindowIcon(),
    menu,
    menuOnLeftClick: false, // Show on right-click only (Windows/Linux pattern)
    tooltip: 'Hearth',
    action: (event) => {
      if (event.type === 'Click' && event.button === 'Left') {
        toggleWindow();
      } else if (event.type === 'DoubleClick') {
        showAndFocusWindow();
      }
    },
  });

  return tray;
}
```

---

## 3. Dynamic Icon Updates

### Unread Count Badge

For communication apps like Hearth, indicating unread messages is critical:

```rust
#[tauri::command]
fn update_tray_badge(app: tauri::AppHandle, unread_count: u32) {
    const ICON_NORMAL: &[u8] = include_bytes!("../icons/tray-icon.png");
    const ICON_UNREAD: &[u8] = include_bytes!("../icons/tray-icon-unread.png");
    
    if let Some(tray) = app.tray_by_id("hearth-tray") {
        let icon_bytes = if unread_count > 0 { ICON_UNREAD } else { ICON_NORMAL };
        
        let _ = tray.set_icon(Some(
            tauri::image::Image::from_bytes(icon_bytes)
                .expect("Failed to load tray icon")
        ));
        
        // Update tooltip with count
        let tooltip = if unread_count > 0 {
            format!("Hearth - {} unread", unread_count)
        } else {
            "Hearth".to_string()
        };
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}
```

### Theme-Adaptive Icons (macOS)

```rust
#[tauri::command]
fn switch_tray_theme(app: tauri::AppHandle, is_dark_mode: bool) {
    const DARK_ICON: &[u8] = include_bytes!("../icons/tray-dark@2x.png");
    const LIGHT_ICON: &[u8] = include_bytes!("../icons/tray-light@2x.png");
    
    let icon_bytes = if is_dark_mode { LIGHT_ICON } else { DARK_ICON };
    
    if let Some(tray) = app.tray_by_id("hearth-tray") {
        let _ = tray.set_icon(Some(
            tauri::image::Image::from_bytes(icon_bytes)
                .expect("Failed to load tray icon")
        ));
    }
}
```

**Best Practice**: On macOS, use template images (monochrome PNG with transparency) - the system automatically handles light/dark adaptation.

---

## 4. UX Patterns from Discord/Slack

### Discord's Tray Behavior

1. **Close button (X)**: Minimizes to tray (configurable)
2. **Tray right-click menu**:
   - Mute/Unmute
   - Deafen/Undeafen
   - --- (separator)
   - Open Discord
   - --- (separator)
   - Quit Discord
3. **Tray left-click**: Toggle window visibility
4. **First-time UX**: Shows notification "Discord is still running" when first minimized to tray
5. **Setting**: "Minimize to Tray" toggle in Windows Settings

### Slack's Tray Behavior

1. **Close button**: Minimizes to notification area (configurable in Advanced settings)
2. **Tray menu**:
   - Open Slack
   - Set yourself as active/away
   - --- (separator)
   - Preferences
   - Sign out of [workspace]
   - --- (separator)
   - Quit Slack
3. **Badge**: Red dot indicator for unread messages

### Element's Tray Behavior

1. **Tray menu**:
   - Show/Hide Element
   - --- (separator)
   - Notifications On/Off
   - --- (separator)
   - Quit Element
2. **Close behavior**: Window hides, app keeps running
3. **Badge**: Unread count overlay on tray icon

---

## 5. Recommended Hearth Tray Menu Structure

```
┌────────────────────────────┐
│ Open Hearth                │
├────────────────────────────┤
│ ◉ Available                │
│ ○ Away                     │
│ ○ Do Not Disturb           │
├────────────────────────────┤
│ □ Notifications On         │ (checkbox)
├────────────────────────────┤
│ Settings...                │
│ Check for Updates...       │
├────────────────────────────┤
│ Quit Hearth                │
└────────────────────────────┘
```

### Menu Item States

```rust
// Dynamic menu with status indicator
fn build_tray_menu(app: &tauri::App, status: UserStatus) -> Menu {
    let available = CheckMenuItem::with_id(
        app, "status-available", "Available", 
        true, status == UserStatus::Available, None::<&str>
    ).unwrap();
    
    let away = CheckMenuItem::with_id(
        app, "status-away", "Away",
        true, status == UserStatus::Away, None::<&str>
    ).unwrap();
    
    let dnd = CheckMenuItem::with_id(
        app, "status-dnd", "Do Not Disturb",
        true, status == UserStatus::DoNotDisturb, None::<&str>
    ).unwrap();
    
    // ... build menu with items
}
```

---

## 6. Close vs Minimize Behavior

### Configuration Option

```typescript
// User preference: what happens when clicking X
interface TraySettings {
  closeToTray: boolean;        // true = minimize to tray on close
  showTrayNotification: boolean; // Show "still running" notification first time
  startMinimized: boolean;      // Start in tray on system boot
}
```

### Implementation Pattern

```rust
// In window close handler
fn handle_window_close(window: &Window, settings: &TraySettings) {
    if settings.close_to_tray {
        // Hide window instead of closing app
        window.hide().unwrap();
        
        // Show notification on first minimize (once per install)
        if !settings.has_shown_tray_notification {
            show_notification(
                "Hearth is still running",
                "Click the tray icon to open Hearth"
            );
            mark_tray_notification_shown();
        }
    } else {
        // Actually quit the app
        std::process::exit(0);
    }
}
```

---

## 7. Cross-Platform Considerations

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Tray location | Notification area | Menu bar | Varies by DE |
| Left-click default | Toggle window | Show menu | Varies |
| Badge support | Overlay icon | Title text | Limited |
| Template icons | N/A | Recommended | N/A |
| First-time notification | Recommended | Less common | Recommended |
| libappindicator | N/A | N/A | Required |

### Linux Fallback

```rust
#[cfg(target_os = "linux")]
fn check_tray_support() -> bool {
    // Check if running in a DE with tray support
    // Fall back to dock/taskbar if not available
    std::env::var("XDG_CURRENT_DESKTOP")
        .map(|de| !de.contains("GNOME")) // GNOME removed tray support
        .unwrap_or(true)
}
```

---

## 8. Icon Design Guidelines

### Windows
- 16x16, 24x24, 32x32 (ICO with multiple sizes)
- Full color supported
- Consider high-DPI (32x32 minimum for modern displays)

### macOS
- 22x22 (or 44x44 @2x) template image
- Monochrome with transparency
- System automatically applies correct color

### Linux
- 22x22 or 24x24 PNG
- Consider symbolic icons for GNOME

### Unread State
- Add red dot overlay
- Or change icon entirely to indicate activity
- Keep recognizable silhouette

---

## 9. Implementation Checklist for Hearth

- [ ] Basic tray icon with menu
- [ ] Left-click toggle window visibility
- [ ] Right-click context menu
- [ ] Unread message badge/indicator
- [ ] User status quick-toggle (Available/Away/DND)
- [ ] Settings shortcut
- [ ] Close-to-tray behavior (configurable)
- [ ] First-time "still running" notification
- [ ] Theme-adaptive icons (macOS)
- [ ] Start minimized option
- [ ] Keyboard shortcut to show/hide (global hotkey)

---

## 10. References

- [Tauri 2.x System Tray Docs](https://v2.tauri.app/learn/system-tray/)
- [Tauri Menu API](https://v2.tauri.app/learn/window-menu/)
- [Electron Tray Reference](https://www.electronjs.org/docs/latest/tutorial/tray)
- [NSStatusItem (macOS)](https://developer.apple.com/documentation/appkit/nsstatusitem)
- [AppIndicator (Linux)](https://wiki.ubuntu.com/DesktopExperienceTeam/ApplicationIndicators)

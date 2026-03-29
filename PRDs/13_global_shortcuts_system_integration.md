# PRD: Global Shortcuts and System Integration

## Overview

**Priority**: P1 (High)
**Timeline**: 6-8 weeks
**Owner**: Desktop Integration Team

Implement comprehensive global shortcuts, system-level integration features, and advanced desktop capabilities that leverage native OS APIs to provide superior functionality compared to web-based Discord alternatives.

## Problem Statement

Desktop communication clients require seamless system integration to compete effectively. Hearth Desktop currently lacks:

- Global push-to-talk and mute hotkeys that work system-wide
- Always-on-top window modes for persistent voice control access
- Native OS integration features (Jump Lists, Touch Bar, system sounds)
- Advanced notification handling with action buttons
- Hardware media key support and audio device management
- Game overlay capabilities for uninterrupted voice communication

**Current Gap**: Discord's desktop client provides essential system-level features that web clients cannot match. Without these integrations, users cannot efficiently manage voice communication during gaming, work, or other full-screen activities.

## Success Metrics

- **Hotkey Adoption**: 75% of voice chat users configure at least one global hotkey
- **Always-on-Top Usage**: 35% of users enable persistent window modes during gaming
- **Notification Engagement**: 60% interaction rate with actionable system notifications
- **Media Key Integration**: 80% of users with media keyboards utilize hardware controls
- **System Performance**: <1ms hotkey response time, <5MB memory overhead
- **Cross-Platform Consistency**: 95% feature parity across Windows, macOS, Linux

## User Stories

### Global Voice Controls
- **As a gamer**, I want push-to-talk to work in any application without Alt+Tab disruption
- **As a remote worker**, I want global mute/unmute during video conferences and presentations
- **As a multitasker**, I want volume controls accessible without switching to Hearth Desktop

### Persistent Access
- **As a competitive gamer**, I want voice controls always visible during full-screen games
- **As a content creator**, I want streaming-friendly overlay that doesn't interfere with recordings
- **As a user**, I want quick access to voice channels without interrupting my workflow

### Native OS Features
- **As a Windows user**, I want Hearth Desktop shortcuts in my taskbar Jump List
- **As a macOS user**, I want Touch Bar integration for voice controls and server switching
- **As a Linux user**, I want proper system tray integration with desktop environment themes

## Technical Requirements

### Global Hotkey System
```rust
// Tauri global hotkey integration
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[tauri::command]
async fn register_global_hotkey(
    app: tauri::AppHandle,
    shortcut: String,
    action: String,
) -> Result<(), String> {
    let parsed_shortcut = shortcut.parse::<Shortcut>()
        .map_err(|e| format!("Invalid shortcut: {}", e))?;

    app.global_shortcut().register(parsed_shortcut, move || {
        match action.as_str() {
            "toggle_mute" => toggle_microphone_mute(),
            "push_to_talk_start" => start_push_to_talk(),
            "push_to_talk_end" => end_push_to_talk(),
            "toggle_deafen" => toggle_speaker_deafen(),
            "volume_up" => adjust_voice_volume(5),
            "volume_down" => adjust_voice_volume(-5),
            _ => eprintln!("Unknown hotkey action: {}", action),
        }
    })?;

    Ok(())
}

struct HotkeyConfig {
    push_to_talk: Option<String>,        // "ctrl+space"
    toggle_mute: Option<String>,         // "ctrl+shift+m"
    toggle_deafen: Option<String>,       // "ctrl+shift+d"
    volume_up: Option<String>,           // "ctrl+shift+plus"
    volume_down: Option<String>,         // "ctrl+shift+minus"
    show_overlay: Option<String>,        // "ctrl+shift+o"
    quick_switch_server: Option<String>, // "ctrl+k"
}
```

### Always-On-Top Window Management
```rust
#[tauri::command]
async fn create_overlay_window(
    app: tauri::AppHandle,
    config: OverlayConfig,
) -> Result<(), String> {
    let overlay_window = tauri::WindowBuilder::new(
        &app,
        "overlay",
        tauri::WindowUrl::App("overlay.html".into()),
    )
    .title("Hearth Desktop Overlay")
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .transparent(true)
    .inner_size(config.width, config.height)
    .position(config.x, config.y)
    .build()?;

    Ok(())
}

struct OverlayConfig {
    width: f64,
    height: f64,
    x: f64,
    y: f64,
    opacity: f64,          // 0.7 for semi-transparent
    position: OverlayPosition, // TopLeft, TopRight, BottomLeft, BottomRight
    auto_hide: bool,       // Hide when no voice activity
    click_through: bool,   // Allow clicks to pass through to underlying apps
}

enum OverlayPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Custom { x: f64, y: f64 },
}
```

### Native OS Integration APIs
```rust
// Windows-specific integrations
#[cfg(target_os = "windows")]
mod windows_integration {
    use windows_sys::Win32::UI::Shell::{SHAddToRecentDocs, SHARD_PATHW};

    pub fn update_jump_list(servers: Vec<ServerInfo>) {
        // Add recent servers to Windows Jump List
        for server in servers {
            unsafe {
                SHAddToRecentDocs(SHARD_PATHW, server.name.as_ptr() as *const _);
            }
        }
    }

    pub fn register_protocol_handler() {
        // Register hearth:// protocol for deep links
    }
}

// macOS-specific integrations
#[cfg(target_os = "macos")]
mod macos_integration {
    use objc::*;

    pub fn setup_touch_bar() {
        // Configure Touch Bar with voice controls
    }

    pub fn update_dock_badge(count: u32) {
        // Update app badge with unread message count
    }
}

// Linux-specific integrations
#[cfg(target_os = "linux")]
mod linux_integration {
    use zbus::Connection;

    pub async fn setup_dbus_integration() -> Result<(), Box<dyn std::error::Error>> {
        let connection = Connection::session().await?;
        // Register D-Bus service for desktop environment integration
        Ok(())
    }
}
```

### Hardware Media Key Support
```rust
#[tauri::command]
async fn register_media_keys(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_global_shortcut::Shortcut;

    let media_shortcuts = vec![
        ("MediaPlayPause", "toggle_voice_transmission"),
        ("MediaNextTrack", "next_voice_channel"),
        ("MediaPreviousTrack", "previous_voice_channel"),
        ("VolumeUp", "increase_voice_volume"),
        ("VolumeDown", "decrease_voice_volume"),
        ("VolumeMute", "toggle_system_audio"),
    ];

    for (key, action) in media_shortcuts {
        if let Ok(shortcut) = key.parse::<Shortcut>() {
            app.global_shortcut().register(shortcut, move || {
                handle_media_key_action(action);
            })?;
        }
    }

    Ok(())
}
```

## User Interface Design

### Hotkey Configuration Panel
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { hotkeyStore } from '$lib/stores/hotkeys';

  let recordingKey: string | null = null;
  let currentHotkeys = $hotkeyStore;

  function startRecording(action: string) {
    recordingKey = action;
    // Listen for key combination
  }

  function saveHotkey(action: string, combination: string) {
    hotkeyStore.update(hotkeys => ({
      ...hotkeys,
      [action]: combination
    }));
    // Call Tauri command to register global hotkey
  }
</script>

<SettingsSection title="Keyboard Shortcuts">
  <div class="hotkey-grid">
    {#each Object.entries(currentHotkeys) as [action, combination]}
      <div class="hotkey-row">
        <span class="hotkey-label">{formatActionName(action)}</span>
        <KeybindInput
          value={combination}
          recording={recordingKey === action}
          on:click={() => startRecording(action)}
          on:save={(event) => saveHotkey(action, event.detail)}
        />
        <button
          class="clear-btn"
          on:click={() => saveHotkey(action, null)}
        >
          Clear
        </button>
      </div>
    {/each}
  </div>

  <div class="hotkey-options">
    <ToggleInput
      label="Enable global shortcuts"
      bind:checked={$hotkeyStore.enabled}
    />
    <ToggleInput
      label="Push-to-talk mode (hold to talk)"
      bind:checked={$hotkeyStore.pushToTalkMode}
    />
  </div>
</SettingsSection>
```

### Overlay Interface
```svelte
<script lang="ts">
  import { voiceStore } from '$lib/stores/voice';
  import { fade, scale } from 'svelte/transition';

  let overlayVisible = false;
  let autoHideTimer: number;

  $: if ($voiceStore.speaking || $voiceStore.connected) {
    overlayVisible = true;
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => {
      overlayVisible = false;
    }, 3000);
  }
</script>

<div class="overlay-container" class:visible={overlayVisible}>
  {#if overlayVisible}
    <div class="overlay-panel" transition:scale>
      <div class="voice-status">
        <MicrophoneIcon
          muted={$voiceStore.muted}
          speaking={$voiceStore.speaking}
        />
        <SpeakerIcon deafened={$voiceStore.deafened} />
      </div>

      <div class="channel-info">
        <span class="channel-name">{$voiceStore.currentChannel?.name}</span>
        <span class="member-count">{$voiceStore.members.length} members</span>
      </div>

      <div class="quick-controls">
        <button on:click={toggleMute} class="control-btn">
          {$voiceStore.muted ? 'Unmute' : 'Mute'}
        </button>
        <button on:click={leaveChannel} class="control-btn">
          Leave
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .overlay-container {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
  }

  .overlay-container.visible {
    pointer-events: auto;
  }

  .overlay-panel {
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 12px;
    color: white;
    font-size: 12px;
    user-select: none;
  }
</style>
```

### Native System Integration
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/tauri';

  onMount(async () => {
    // Setup platform-specific integrations
    await invoke('setup_native_integration', {
      config: {
        jumpList: true,        // Windows Jump List
        touchBar: true,        // macOS Touch Bar
        dockBadge: true,       // macOS dock badge
        systemTray: true,      // System tray integration
        mediaKeys: true,       // Hardware media key support
        notifications: true,   // Rich system notifications
      }
    });
  });
</script>
```

## Implementation Phases

### Phase 1: Global Hotkey Foundation (2 weeks)
- Integrate `tauri-plugin-global-shortcut`
- Implement basic PTT, mute, deafen hotkeys
- Create hotkey configuration UI with key recording
- Add hotkey conflict detection and resolution

### Phase 2: Always-On-Top Overlay (2 weeks)
- Implement overlay window management
- Create voice status overlay UI components
- Add overlay positioning and customization options
- Implement auto-hide functionality and click-through mode

### Phase 3: Native OS Integration (2-3 weeks)
- Windows: Jump Lists, protocol handling, system sounds
- macOS: Touch Bar controls, dock badge, native notifications
- Linux: D-Bus integration, desktop environment theming
- Cross-platform media key support

### Phase 4: Advanced System Features (1-2 weeks)
- Hardware audio device management
- System volume integration
- Native file drag-and-drop support
- Performance optimization and memory management

## Security and Privacy Considerations

### Hotkey Security
- Sandboxed hotkey registration prevents malicious key capture
- User consent required for each global shortcut registration
- Automatic conflict resolution with other applications
- Secure input handling prevents key logging vulnerabilities

### Overlay Security
- Overlay windows restricted to Hearth Desktop process scope
- No screen capture or content reading capabilities
- Automatic disable in secure applications (banking, password managers)
- Click-through mode prevents accidental input capture

### System Integration Privacy
- Minimal system API usage with explicit permission requests
- No background process monitoring beyond registered hotkeys
- Native OS privacy controls respected (macOS privacy preferences, Windows privacy settings)
- Optional telemetry with full user control and transparency

## Cross-Platform Implementation Notes

### Windows Integration
```rust
// Windows-specific features
use windows_sys::Win32::{
    UI::WindowsAndMessaging::{RegisterHotKey, UnregisterHotKey},
    System::Threading::GetCurrentThreadId,
    Foundation::HWND,
};

pub struct WindowsIntegration {
    hotkey_id_counter: i32,
    registered_hotkeys: HashMap<i32, String>,
}

impl WindowsIntegration {
    pub fn register_hotkey(&mut self, combination: &str, callback: Box<dyn Fn()>) -> Result<i32, String> {
        let (modifiers, vk_code) = parse_hotkey_combination(combination)?;
        let hotkey_id = self.hotkey_id_counter;
        self.hotkey_id_counter += 1;

        unsafe {
            RegisterHotKey(
                HWND::default(),
                hotkey_id,
                modifiers,
                vk_code,
            );
        }

        self.registered_hotkeys.insert(hotkey_id, combination.to_string());
        Ok(hotkey_id)
    }

    pub fn setup_jump_list(&self, recent_servers: Vec<ServerInfo>) -> Result<(), String> {
        // Implement Windows Jump List with recent servers
        Ok(())
    }
}
```

### macOS Integration
```rust
// macOS-specific features using objc bindings
use objc::*;
use cocoa::{
    appkit::{NSApp, NSApplication, NSApplicationActivationPolicyRegular},
    base::{nil, YES},
    foundation::{NSString, NSAutoreleasePool},
};

pub struct MacOSIntegration;

impl MacOSIntegration {
    pub fn setup_touch_bar(&self) -> Result<(), String> {
        unsafe {
            // Create Touch Bar with voice control items
            let touch_bar = msg_send![class!(NSTouchBar), new];
            // Add mute, deafen, volume controls
        }
        Ok(())
    }

    pub fn update_dock_badge(&self, count: u32) -> Result<(), String> {
        unsafe {
            let app: id = NSApp();
            let badge_label = if count == 0 {
                nil
            } else {
                NSString::alloc(nil).init_str(&count.to_string())
            };
            let _: () = msg_send![app, setDockBadgeLabel: badge_label];
        }
        Ok(())
    }
}
```

### Linux Integration
```rust
// Linux-specific features using zbus for D-Bus integration
use zbus::{Connection, Interface};

#[derive(Debug)]
pub struct LinuxIntegration {
    dbus_connection: Connection,
}

#[zbus::interface(name = "com.hearth.Desktop")]
impl LinuxIntegration {
    pub async fn setup_dbus_service(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Register D-Bus service for desktop environment integration
        Ok(())
    }

    pub async fn send_notification(&self, title: &str, body: &str) -> Result<(), String> {
        // Send native desktop notification via D-Bus
        Ok(())
    }

    pub async fn setup_system_tray(&self) -> Result<(), String> {
        // Implement system tray via D-Bus StatusNotifierItem
        Ok(())
    }
}
```

## Success Metrics and Testing

### Performance Benchmarks
- **Hotkey Response Time**: <1ms from key press to action execution
- **Overlay Render Time**: <16ms frame time for smooth 60fps animation
- **Memory Usage**: <5MB additional overhead for all system integration features
- **CPU Usage**: <0.1% average CPU usage when idle, <2% during active hotkey usage

### Compatibility Testing
- **Windows**: Windows 10/11, various keyboard layouts, gaming keyboards with macro keys
- **macOS**: macOS 11+, Touch Bar and non-Touch Bar MacBooks, external keyboards
- **Linux**: Ubuntu, Fedora, Arch Linux, GNOME, KDE, various desktop environments

### User Experience Testing
- **Hotkey Conflicts**: Test with common applications (browsers, games, IDEs)
- **Overlay Compatibility**: Test with popular games and full-screen applications
- **Accessibility**: Screen reader compatibility, high contrast themes, keyboard navigation

## Future Roadmap

### Advanced Features (Post-Launch)
- **AI-Powered Hotkeys**: Smart hotkey suggestions based on usage patterns
- **Voice Command Integration**: "Mute me", "Join [server name]" voice commands
- **Gesture Support**: Touch gestures on touchscreen devices
- **Eye Tracking**: Eye tracking integration for hands-free voice controls
- **IoT Integration**: Smart home device integration for status indicators

This comprehensive system integration will establish Hearth Desktop as a superior native alternative to web-based Discord, providing the seamless desktop experience that power users and gamers demand.
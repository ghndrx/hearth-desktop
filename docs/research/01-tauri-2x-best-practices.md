# Tauri 2.x Best Practices and Plugins

> Research Date: 2026-02-14  
> Focus: Foundation for Hearth Desktop architecture

## Executive Summary

Tauri 2.0 (stable Oct 2024) represents a major architectural evolution supporting desktop AND mobile platforms (iOS, Android) from a single codebase. Core functionality has been modularized into plugins, enabling a more maintainable and contributor-friendly ecosystem.

---

## Architecture Overview

### Core Stack
```
┌─────────────────────────────────────┐
│           Frontend (WebView)        │  ← Your HTML/CSS/JS (React, Vue, etc.)
├─────────────────────────────────────┤
│           @tauri-apps/api           │  ← TypeScript bindings (message passing)
├─────────────────────────────────────┤
│              WRY                    │  ← Cross-platform WebView abstraction
├─────────────────────────────────────┤
│              TAO                    │  ← Window management (fork of winit)
├─────────────────────────────────────┤
│         Rust Core (tauri)           │  ← Commands, plugins, system APIs
└─────────────────────────────────────┘
```

### Key Components
- **tauri**: Main crate holding everything together, reads `tauri.conf.json` at compile time
- **tauri-runtime**: Glue layer between Tauri and WRY/TAO
- **tauri-macros**: Creates context, handler, and command macros
- **tauri-bundler**: Builds platform-specific packages (macOS, Windows, Linux, iOS, Android)
- **WRY**: Cross-platform WebView rendering (uses native webview per OS)
- **TAO**: Window creation/management (menus, system tray, multi-monitor)

---

## Plugin System (Major 2.0 Change)

### Philosophy
Tauri 2.0 moved most functionality into plugins to:
1. Lower barrier for contributors (modify plugin, not core)
2. Stabilize core, keep moving parts in plugins
3. Enable per-plugin maturity levels
4. Support mobile with native Swift/Kotlin code

### Official Plugins (plugins-workspace)

| Plugin | Windows | macOS | Linux | Android | iOS | Use Case |
|--------|---------|-------|-------|---------|-----|----------|
| **fs** | ✅ | ✅ | ✅ | ? | ? | File system access |
| **store** | ✅ | ✅ | ✅ | ✅ | ✅ | Persistent key-value storage |
| **notification** | ✅ | ✅ | ✅ | ✅ | ✅ | System notifications |
| **dialog** | ✅ | ✅ | ✅ | ✅ | ✅ | Native file/message dialogs |
| **global-shortcut** | ✅ | ✅ | ✅ | ? | ? | Register global hotkeys |
| **updater** | ✅ | ✅ | ✅ | ❌ | ❌ | In-app updates |
| **clipboard-manager** | ✅ | ✅ | ✅ | ✅ | ✅ | System clipboard |
| **window-state** | ✅ | ✅ | ✅ | ❌ | ❌ | Persist window size/position |
| **single-instance** | ✅ | ✅ | ✅ | ❌ | ❌ | Prevent multiple instances |
| **autostart** | ✅ | ✅ | ✅ | ❌ | ❌ | Launch at startup |
| **deep-link** | ✅ | ✅ | ✅ | ✅ | ✅ | URL protocol handlers |
| **shell** | ✅ | ✅ | ✅ | ? | ? | Spawn child processes |
| **http** | ✅ | ✅ | ✅ | ✅ | ✅ | Rust HTTP client |
| **log** | ✅ | ✅ | ✅ | ✅ | ✅ | Configurable logging |
| **sql** | ✅ | ✅ | ✅ | ✅ | ✅ | SQLite/MySQL/PostgreSQL |
| **positioner** | ✅ | ✅ | ✅ | ❌ | ❌ | Window positioning |

### Plugin Integration Pattern

**Cargo.toml:**
```toml
[dependencies]
tauri-plugin-store = "2"
tauri-plugin-notification = "2"
tauri-plugin-fs = "2"
```

**main.rs:**
```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Frontend (TypeScript):**
```typescript
import { Store } from '@tauri-apps/plugin-store';
import { sendNotification } from '@tauri-apps/plugin-notification';

const store = await Store.load('settings.json');
await store.set('theme', 'dark');
await sendNotification({ title: 'Hearth', body: 'Settings saved' });
```

---

## Security Model (Permissions & Capabilities)

### New in 2.0: Replaces Allowlist
The old allowlist is gone. New system uses:

1. **Permissions**: On/off toggles for Tauri commands
2. **Scopes**: Parameter validation for commands
3. **Capabilities**: Attach permissions to specific windows/webviews

### Capability File Example
```json
// src-tauri/capabilities/main.json
{
  "identifier": "main-window",
  "windows": ["main"],
  "permissions": [
    "fs:default",
    "fs:allow-read-file",
    {
      "identifier": "fs:allow-write-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    "notification:default",
    "store:default"
  ]
}
```

### Security Best Practice
- Principle of least privilege: only enable what's needed
- Use scopes to restrict paths/URLs
- Different capabilities for different windows (e.g., main vs settings)

---

## IPC (Frontend ↔ Backend Communication)

### Command Pattern
```rust
// src-tauri/src/commands.rs
#[tauri::command]
async fn get_user_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    // Access app state, storage, etc.
    Ok(Settings::default())
}

#[tauri::command]
async fn save_settings(settings: Settings, app: tauri::AppHandle) -> Result<(), String> {
    // Validate and persist
    Ok(())
}
```

Register commands:
```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        get_user_settings,
        save_settings
    ])
```

### Frontend Invocation
```typescript
import { invoke } from '@tauri-apps/api/core';

const settings = await invoke<Settings>('get_user_settings');
await invoke('save_settings', { settings: newSettings });
```

### Raw Payloads (New in 2.0)
For large binary data, bypass JSON serialization:
```rust
#[tauri::command]
async fn process_file(request: tauri::ipc::Request<'_>) -> Vec<u8> {
    let body = request.body().unwrap();
    // Process raw bytes
    processed_data
}
```

### Channels (Streaming Data)
```rust
#[tauri::command]
async fn subscribe_updates(channel: tauri::ipc::Channel<Update>) {
    loop {
        channel.send(Update::new()).await;
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
```

---

## Performance Best Practices

### Bundle Size
- Tauri apps are **~600KB - 3MB** (vs Electron ~150MB+)
- Uses OS native webview (WebView2 on Windows, WebKit on macOS/Linux)
- No bundled Chromium/Node.js runtime

### Memory
- Typical Tauri app: **20-50MB** (vs Electron 100-300MB)
- Single process model (no separate renderer processes)

### Optimizations
1. **Asset compression**: Tauri compresses embedded assets at compile time
2. **convertFileSrc**: Stream files directly to webview (don't load into memory)
3. **Lazy-load plugins**: Only init plugins when needed
4. **Release builds**: Use `--release` flag, significant perf difference

### Build Configuration
```toml
# Cargo.toml - Production optimizations
[profile.release]
lto = true
opt-level = "z"  # Optimize for size
strip = true
codegen-units = 1
```

---

## Project Structure Recommendation

```
hearth-desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── commands/         # Tauri commands (organized by feature)
│   │   │   ├── mod.rs
│   │   │   ├── settings.rs
│   │   │   └── notifications.rs
│   │   ├── state.rs          # App state management
│   │   └── lib.rs            # Library for testing
│   ├── capabilities/         # Security capabilities
│   │   ├── main.json
│   │   └── settings.json
│   ├── icons/                # App icons
│   ├── Cargo.toml
│   └── tauri.conf.json       # Tauri configuration
├── src/                      # Frontend (React/Vue/etc)
│   ├── components/
│   ├── hooks/
│   │   └── useTauri.ts       # Tauri API abstractions
│   └── main.tsx
├── package.json
└── vite.config.ts
```

---

## Tauri vs Electron Decision Points

| Aspect | Tauri | Electron |
|--------|-------|----------|
| **Bundle size** | ~1-3MB | ~150MB+ |
| **Memory usage** | ~20-50MB | ~100-300MB |
| **Startup time** | Fast | Slower |
| **Backend language** | Rust | Node.js |
| **WebView** | Native OS | Chromium (bundled) |
| **Browser consistency** | Varies by OS | Identical everywhere |
| **Node.js APIs** | ❌ (use Rust) | ✅ |
| **npm ecosystem** | Frontend only | Full access |
| **Mobile support** | ✅ (2.0) | ❌ |
| **Maturity** | Growing | Battle-tested |
| **Learning curve** | Higher (Rust) | Lower (JS everywhere) |

### When Tauri Wins
- Performance-critical apps
- Apps targeting resource-constrained machines
- Mobile+desktop from single codebase
- Security-sensitive applications
- Apps benefiting from Rust's safety

### When Electron Wins
- Team has no Rust experience
- Heavy reliance on npm packages in backend
- Need pixel-perfect cross-browser consistency
- Existing Node.js codebase to reuse

---

## Hearth-Specific Recommendations

### Essential Plugins for Hearth
1. **tauri-plugin-notification** - Desktop notifications (core feature)
2. **tauri-plugin-store** - Persist user settings
3. **tauri-plugin-window-state** - Remember window position/size
4. **tauri-plugin-autostart** - Launch at login
5. **tauri-plugin-single-instance** - Prevent duplicate instances
6. **tauri-plugin-global-shortcut** - Quick-access hotkeys
7. **tauri-plugin-updater** - Auto-updates
8. **tauri-plugin-deep-link** - `hearth://` protocol handler

### Architecture Pattern
```rust
// Organize by feature modules
mod commands {
    pub mod chat;        // Chat/messaging commands
    pub mod settings;    // User preferences
    pub mod system;      // System tray, notifications
}

mod services {
    pub mod gateway;     // WebSocket to Clawdbot Gateway
    pub mod storage;     // Local persistence layer
}
```

### Multi-Window Strategy
Tauri 2.0 supports multiple webviews. Consider:
- Main chat window
- Settings window (separate permissions)
- Quick-reply popup (minimal, focused)
- System tray popover

---

## Implementation Checklist

- [ ] Initialize with `create-tauri-app` (React + TypeScript template)
- [ ] Configure essential plugins (store, notification, window-state)
- [ ] Set up capabilities with minimal permissions
- [ ] Create command structure matching Hearth features
- [ ] Implement state management (Tauri managed state)
- [ ] Add system tray support
- [ ] Configure auto-updater
- [ ] Set up CI with `tauri-action` for cross-platform builds

---

## References

- [Tauri 2.0 Release Notes](https://v2.tauri.app/blog/tauri-20/)
- [Tauri Architecture](https://v2.tauri.app/concept/architecture/)
- [Official Plugins](https://github.com/tauri-apps/plugins-workspace)
- [Security Documentation](https://v2.tauri.app/security/)
- [Awesome Tauri](https://github.com/tauri-apps/awesome-tauri)
- [CrabNebula Cloud](https://crabnebula.dev/) - Auto-updates infrastructure

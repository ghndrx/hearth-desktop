# PRD: Window Management & Always-on-Top

## Overview

**Priority**: P1 (High)
**Timeline**: 1-2 weeks
**Owner**: Desktop Team

Implement window management features essential for power users — always-on-top mode, configurable window behavior, and native OS integrations — enabling Hearth Desktop to function as a persistent voice control panel during gaming or work.

## Problem Statement

Discord's desktop window is a standard decorated window with additional modes:
- **Always on Top** — Pin the window above all others, essential for gaming
- **Compact Mode** — Smaller window with only the voice panel visible
- **Native Titlebar Toggle** — Option to use OS-native vs. custom titlebar

Hearth Desktop has none of these. The `tauri.conf.json` currently shows a plain 1200×800 decorated window with no state persistence.

**Current Gap**: Power users (gamers, remote workers) need always-on-top to keep voice controls visible without switching windows. Discord provides this. Hearth Desktop does not.

## Goals

### Primary Goals
- **Always-on-Top Toggle** — Button in voice panel and/or keyboard shortcut (Ctrl+Shift+T) to pin window above all others; persists across restarts
- **Window Position/Size Memory** — Save and restore window position, size, and maximized state on restart (use `tauri-plugin-store`)
- **Minimize Behavior** — Configurable: minimize to taskbar (default) or minimize to tray (requires PRD #15)

### Secondary Goals
- **Always-on-Top Indicator** — Visual badge/icon when in always-on-top mode
- **Fullscreen Support** — Allow fullscreen for presentations (separate from the voice-only compact view)

## Technical Approach

### Always-on-Top (Rust)

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub async fn set_always_on_top(window: tauri::Window, value: bool) -> Result<(), String> {
    window.set_always_on_top(value).map_err(|e| e.to_string())?;
    Ok(())
}

// src-tauri/src/main.rs — add to invoke_handler
commands::set_always_on_top,
```

### Window State Persistence (Frontend)

```typescript
// src/lib/stores/app.ts — extend
import { load } from 'tauri-plugin-store';

export async function saveWindowState() {
  const win = await import('@tauri-apps/api/window');
  const store = await load('settings.json', { autoSave: true });
  const pos = await win.getCurrentWindow().outerPosition();
  const size = await win.getCurrentWindow().outerSize();
  await store.set('window', { x: pos.x, y: pos.y, width: size.width, height: size.height });
}

export async function restoreWindowState() {
  const win = await import('@tauri-apps/api/window');
  const store = await load('settings.json', { autoSave: true });
  const saved = await store.get<{x:number; y:number; width:number; height:number}>('window');
  if (saved) {
    await win.getCurrentWindow().setPosition(win.PositionLogical, saved);
    await win.getCurrentWindow().setSize(win.Size, saved);
  }
}
```

### Keyboard Shortcut (Frontend)

Add to the global shortcut listener (using `@tauri-apps/api/globalShortcut`):
```typescript
await globalShortcut.register('CommandOrControl+Shift+T', () => {
  setAlwaysOnTop(!isAlwaysOnTop);
});
```

# Cross-Platform Keyboard Shortcuts Research

**Research Date:** March 5, 2026  
**Focus Area:** Global and local keyboard shortcuts for Hearth desktop  
**Applications Studied:** Discord, Slack, VS Code, Telegram Desktop  
**Target Platform:** Tauri 2.x

---

## Executive Summary

Keyboard shortcuts are essential for power users of messaging apps. Users expect:
1. **Global shortcuts** to show/hide the app or trigger quick capture (even when app isn't focused)
2. **Local shortcuts** for navigation and actions within the app (when focused)
3. **Cross-platform consistency** with platform-specific conventions (Cmd vs Ctrl)
4. **User customization** of shortcuts
5. **Conflict avoidance** with system and other app shortcuts

**Tauri 2.x provides:**
- ✅ `tauri-plugin-global-shortcut` for system-wide hotkeys
- ✅ Standard web keyboard event handling for local shortcuts
- ✅ Cross-platform modifier keys (CommandOrControl)

---

## Tauri 2.x Global Shortcut Plugin

### Plugin: `tauri-plugin-global-shortcut`

**Documentation:** https://v2.tauri.app/plugin/global-shortcut/

**Platform Support:**
- ✅ Windows
- ✅ macOS
- ✅ Linux
- ❌ Android (not applicable)
- ❌ iOS (not applicable)

### Installation

```bash
npm run tauri add global-shortcut
```

### Permissions Setup

Global shortcuts are **disabled by default** for security. Add to capabilities:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "global-shortcut:allow-is-registered",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister"
  ]
}
```

### Basic Usage

```typescript
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';

// Register a global shortcut
await register('CommandOrControl+Shift+H', () => {
  console.log('Toggle Hearth window');
  toggleMainWindow();
});

// Check if registered
const registered = await isRegistered('CommandOrControl+Shift+H');

// Unregister
await unregister('CommandOrControl+Shift+H');
```

### Modifier Keys

**Cross-platform modifier syntax:**
- `CommandOrControl` - Cmd on macOS, Ctrl on Windows/Linux
- `Control` - Ctrl key
- `Alt` - Alt key (Option on macOS)
- `Shift` - Shift key
- `Super` - Windows key / Super key (Linux)
- `Meta` - Same as Command on macOS

**Examples:**
```typescript
// Show quick capture
'CommandOrControl+Shift+Space'

// Toggle main window
'CommandOrControl+Shift+H'

// New conversation
'CommandOrControl+N'

// Search
'CommandOrControl+K'
```

### Register Multiple Shortcuts

```typescript
import { registerAll } from '@tauri-apps/plugin-global-shortcut';

await registerAll(
  ['CommandOrControl+Shift+H', 'CommandOrControl+Alt+H'],
  (shortcut) => {
    console.log(`Shortcut ${shortcut} triggered`);
    toggleMainWindow();
  }
);
```

### Unregister All Shortcuts

```typescript
import { unregisterAll } from '@tauri-apps/plugin-global-shortcut';

// Clean up on app close
await unregisterAll();
```

---

## Hearth Global Shortcuts

### Recommended Global Hotkeys

| Shortcut | Action | Priority |
|----------|--------|----------|
| `Cmd/Ctrl+Shift+H` | Toggle main window | **Essential** |
| `Cmd/Ctrl+Shift+Space` | Quick Capture | **Essential** |
| `Cmd/Ctrl+Shift+N` | New conversation (from anywhere) | Nice-to-have |
| `Cmd/Ctrl+Shift+M` | Mute/unmute audio | Nice-to-have |

**Implementation:**

```typescript
// src/lib/shortcuts/global.ts
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

export class GlobalShortcutManager {
  private registered = new Map<string, string>();
  
  async registerDefaults() {
    // Toggle main window
    await this.register('toggle-window', 'CommandOrControl+Shift+H', async () => {
      const window = getCurrentWindow();
      const visible = await window.isVisible();
      
      if (visible) {
        await window.hide();
      } else {
        await window.show();
        await window.setFocus();
      }
    });
    
    // Quick Capture
    await this.register('quick-capture', 'CommandOrControl+Shift+Space', async () => {
      await invoke('show_quick_capture_window');
    });
  }
  
  async register(id: string, shortcut: string, handler: () => void) {
    try {
      await register(shortcut, handler);
      this.registered.set(id, shortcut);
      console.log(`Registered global shortcut: ${id} (${shortcut})`);
    } catch (error) {
      console.error(`Failed to register ${shortcut}:`, error);
      // Shortcut might already be taken by system or another app
    }
  }
  
  async unregister(id: string) {
    const shortcut = this.registered.get(id);
    if (shortcut) {
      await unregister(shortcut);
      this.registered.delete(id);
    }
  }
  
  async unregisterAll() {
    for (const id of this.registered.keys()) {
      await this.unregister(id);
    }
  }
}
```

### Conflict Handling

Global shortcuts can fail to register if:
1. System already uses that shortcut (e.g., `Cmd+Space` for Spotlight on macOS)
2. Another app registered it first
3. User disabled global shortcuts in OS settings

**Best practices:**
- **Try-catch** registration and show a warning to user
- **Fallback shortcuts:** If primary fails, try alternative
- **User customization:** Let users choose their own shortcuts

```typescript
async function registerWithFallback(primary: string, fallback: string, handler: () => void) {
  try {
    await register(primary, handler);
    return primary;
  } catch {
    console.warn(`${primary} unavailable, trying ${fallback}`);
    try {
      await register(fallback, handler);
      return fallback;
    } catch {
      console.error('All shortcuts failed, disabling feature');
      return null;
    }
  }
}

// Usage
const toggleShortcut = await registerWithFallback(
  'CommandOrControl+Shift+H',
  'CommandOrControl+Alt+H',
  toggleMainWindow
);
```

---

## Local Shortcuts (In-App Navigation)

Local shortcuts use standard web keyboard event handling. No Tauri plugin needed.

### Recommended Local Shortcuts

**Discord/Slack Patterns:**

| Shortcut | Action | Category |
|----------|--------|----------|
| `Cmd/Ctrl+K` | Quick switcher / command palette | **Navigation** |
| `Cmd/Ctrl+F` | Search in conversation | **Search** |
| `Cmd/Ctrl+/` | Show keyboard shortcuts | **Help** |
| `Cmd/Ctrl+N` | New conversation | **Actions** |
| `Cmd/Ctrl+W` | Close current conversation | **Actions** |
| `Cmd/Ctrl+,` | Open settings | **System** |
| `Alt+Up` | Previous conversation | **Navigation** |
| `Alt+Down` | Next conversation | **Navigation** |
| `Alt+Shift+Up` | Previous unread | **Navigation** |
| `Alt+Shift+Down` | Next unread | **Navigation** |
| `Cmd/Ctrl+1-9` | Jump to conversation 1-9 | **Navigation** |
| `Cmd/Ctrl+Shift+M` | Toggle mute current channel | **Actions** |
| `Escape` | Close modal / unfocus | **UI** |
| `Cmd/Ctrl+Enter` | Send message | **Messaging** |
| `Shift+Enter` | New line in message | **Messaging** |
| `Cmd/Ctrl+Up` | Edit last message | **Messaging** |
| `Cmd/Ctrl+Shift+R` | Mark as read | **Messaging** |

### Implementation with Svelte

**Global keyboard handler:**

```typescript
// src/lib/shortcuts/local.ts
export type ShortcutHandler = () => void | Promise<void>;

export interface Shortcut {
  id: string;
  keys: string;
  description: string;
  handler: ShortcutHandler;
  enabled?: boolean;
}

export class LocalShortcutManager {
  private shortcuts = new Map<string, Shortcut>();
  private isMac = navigator.platform.toUpperCase().includes('MAC');
  
  register(shortcut: Shortcut) {
    this.shortcuts.set(shortcut.id, shortcut);
  }
  
  unregister(id: string) {
    this.shortcuts.delete(id);
  }
  
  handleKeyDown(event: KeyboardEvent): boolean {
    // Don't handle shortcuts when typing in input
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Exception: Allow Cmd+Enter to send message
      if (!this.matchesKeys(event, 'CommandOrControl+Enter')) {
        return false;
      }
    }
    
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.enabled === false) continue;
      
      if (this.matchesKeys(event, shortcut.keys)) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.handler();
        return true;
      }
    }
    
    return false;
  }
  
  private matchesKeys(event: KeyboardEvent, keys: string): boolean {
    const parts = keys.split('+').map(k => k.trim().toLowerCase());
    
    const hasCtrl = parts.includes('control') || parts.includes('ctrl');
    const hasCmd = parts.includes('command') || parts.includes('cmd');
    const hasCommandOrControl = parts.includes('commandorcontrol');
    const hasAlt = parts.includes('alt');
    const hasShift = parts.includes('shift');
    
    // Check modifiers
    if (hasCommandOrControl) {
      if (this.isMac) {
        if (!event.metaKey) return false;
      } else {
        if (!event.ctrlKey) return false;
      }
    } else {
      if (hasCtrl && !event.ctrlKey) return false;
      if (hasCmd && !event.metaKey) return false;
    }
    
    if (hasAlt && !event.altKey) return false;
    if (hasShift && !event.shiftKey) return false;
    
    // Check key
    const key = parts[parts.length - 1];
    const eventKey = event.key.toLowerCase();
    
    return eventKey === key || event.code.toLowerCase() === key.toLowerCase();
  }
  
  getAll(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }
}
```

**Svelte component integration:**

```svelte
<!-- src/lib/shortcuts/ShortcutHandler.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { LocalShortcutManager } from './local';
  import { goto } from '$app/navigation';
  
  export let manager = new LocalShortcutManager();
  
  // Register app shortcuts
  manager.register({
    id: 'quick-switcher',
    keys: 'CommandOrControl+K',
    description: 'Open quick switcher',
    handler: () => {
      showQuickSwitcher();
    }
  });
  
  manager.register({
    id: 'search',
    keys: 'CommandOrControl+F',
    description: 'Search in conversation',
    handler: () => {
      focusSearchInput();
    }
  });
  
  manager.register({
    id: 'settings',
    keys: 'CommandOrControl+,',
    description: 'Open settings',
    handler: () => {
      goto('/settings');
    }
  });
  
  manager.register({
    id: 'shortcuts-help',
    keys: 'CommandOrControl+/',
    description: 'Show keyboard shortcuts',
    handler: () => {
      showShortcutsModal();
    }
  });
  
  function handleKeyDown(event: KeyboardEvent) {
    manager.handleKeyDown(event);
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });
  
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<!-- This component doesn't render anything, just handles events -->
```

**Usage in +layout.svelte:**

```svelte
<script lang="ts">
  import ShortcutHandler from '$lib/shortcuts/ShortcutHandler.svelte';
</script>

<ShortcutHandler />

<slot />
```

---

## Cross-Platform Consistency

### Platform-Specific Considerations

**macOS:**
- Use `Cmd` instead of `Ctrl` for primary actions
- `Cmd+Q` quits the app (don't override)
- `Cmd+H` hides the app (system behavior)
- `Cmd+M` minimizes (system behavior)
- Use `Option` (Alt) for secondary modifiers

**Windows/Linux:**
- Use `Ctrl` for primary actions
- `Alt+F4` closes window (don't override)
- `F11` toggles fullscreen (optional override)

### Shortcut Display

Show platform-appropriate symbols in UI:

```typescript
export function formatShortcut(keys: string): string {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  
  let formatted = keys
    .replace(/CommandOrControl/g, isMac ? '⌘' : 'Ctrl')
    .replace(/Command/g, '⌘')
    .replace(/Control/g, 'Ctrl')
    .replace(/Shift/g, isMac ? '⇧' : 'Shift')
    .replace(/Alt/g, isMac ? '⌥' : 'Alt')
    .replace(/\+/g, isMac ? '' : '+');
  
  return formatted;
}

// Usage
formatShortcut('CommandOrControl+Shift+K')
// macOS: "⌘⇧K"
// Windows: "Ctrl+Shift+K"
```

---

## User Customization

Allow users to customize shortcuts in settings:

```typescript
// src/lib/stores/shortcuts.ts
import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface CustomShortcut {
  id: string;
  defaultKeys: string;
  currentKeys: string;
  description: string;
}

function createShortcutsStore() {
  const { subscribe, set, update } = writable<CustomShortcut[]>([
    {
      id: 'toggle-window',
      defaultKeys: 'CommandOrControl+Shift+H',
      currentKeys: 'CommandOrControl+Shift+H',
      description: 'Toggle main window',
    },
    {
      id: 'quick-capture',
      defaultKeys: 'CommandOrControl+Shift+Space',
      currentKeys: 'CommandOrControl+Shift+Space',
      description: 'Open quick capture',
    },
    // ... more shortcuts
  ]);
  
  return {
    subscribe,
    load: async () => {
      const saved = await invoke('load_shortcuts');
      set(saved);
    },
    save: async (shortcuts: CustomShortcut[]) => {
      await invoke('save_shortcuts', { shortcuts });
      set(shortcuts);
    },
    updateShortcut: (id: string, newKeys: string) => {
      update(shortcuts => 
        shortcuts.map(s => s.id === id ? { ...s, currentKeys: newKeys } : s)
      );
    },
    reset: () => {
      update(shortcuts => 
        shortcuts.map(s => ({ ...s, currentKeys: s.defaultKeys }))
      );
    },
  };
}

export const shortcuts = createShortcutsStore();
```

**Settings UI:**

```svelte
<!-- src/routes/settings/shortcuts/+page.svelte -->
<script lang="ts">
  import { shortcuts } from '$lib/stores/shortcuts';
  import { formatShortcut } from '$lib/shortcuts/format';
  
  let recording: string | null = null;
  
  function startRecording(id: string) {
    recording = id;
  }
  
  function handleKeyDown(event: KeyboardEvent, id: string) {
    if (recording !== id) return;
    
    event.preventDefault();
    
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Control');
    if (event.metaKey) modifiers.push('Command');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    
    const key = event.key.toUpperCase();
    const newKeys = [...modifiers, key].join('+');
    
    shortcuts.updateShortcut(id, newKeys);
    recording = null;
  }
</script>

<h1>Keyboard Shortcuts</h1>

<table>
  <thead>
    <tr>
      <th>Action</th>
      <th>Shortcut</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each $shortcuts as shortcut}
      <tr>
        <td>{shortcut.description}</td>
        <td>
          {#if recording === shortcut.id}
            <input
              type="text"
              placeholder="Press keys..."
              on:keydown={(e) => handleKeyDown(e, shortcut.id)}
              on:blur={() => recording = null}
              autofocus
            />
          {:else}
            <kbd>{formatShortcut(shortcut.currentKeys)}</kbd>
          {/if}
        </td>
        <td>
          <button on:click={() => startRecording(shortcut.id)}>
            Change
          </button>
          <button on:click={() => shortcuts.updateShortcut(shortcut.id, shortcut.defaultKeys)}>
            Reset
          </button>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<button on:click={() => shortcuts.reset()}>Reset All</button>
<button on:click={() => shortcuts.save($shortcuts)}>Save</button>
```

---

## Reserved Shortcuts to Avoid

**System shortcuts (don't override):**

**macOS:**
- `Cmd+Q` - Quit
- `Cmd+H` - Hide
- `Cmd+M` - Minimize
- `Cmd+Tab` - App switcher
- `Cmd+Space` - Spotlight
- `Cmd+Option+Esc` - Force quit

**Windows:**
- `Alt+F4` - Close window
- `Ctrl+Alt+Del` - Task manager
- `Win+D` - Show desktop
- `Win+L` - Lock screen

**Linux (varies by DE):**
- `Super` key combos (window management)
- `Alt+F2` - Run dialog
- `Ctrl+Alt+T` - Terminal

---

## Keyboard Shortcut Help Modal

Show users available shortcuts with `Cmd/Ctrl+/`:

```svelte
<!-- src/lib/components/ShortcutsModal.svelte -->
<script lang="ts">
  import { shortcuts } from '$lib/stores/shortcuts';
  import { formatShortcut } from '$lib/shortcuts/format';
  
  export let show = false;
  
  const categories = [
    { name: 'Navigation', shortcuts: ['quick-switcher', 'search', 'prev-chat', 'next-chat'] },
    { name: 'Actions', shortcuts: ['new-conversation', 'mark-read', 'mute-channel'] },
    { name: 'Messaging', shortcuts: ['send-message', 'new-line', 'edit-last'] },
    { name: 'System', shortcuts: ['settings', 'toggle-window', 'quick-capture'] },
  ];
</script>

{#if show}
  <div class="modal-overlay" on:click={() => show = false}>
    <div class="modal" on:click|stopPropagation>
      <h2>Keyboard Shortcuts</h2>
      
      {#each categories as category}
        <section>
          <h3>{category.name}</h3>
          <dl>
            {#each category.shortcuts as id}
              {@const shortcut = $shortcuts.find(s => s.id === id)}
              {#if shortcut}
                <div class="shortcut-row">
                  <dt>{shortcut.description}</dt>
                  <dd><kbd>{formatShortcut(shortcut.currentKeys)}</kbd></dd>
                </div>
              {/if}
            {/each}
          </dl>
        </section>
      {/each}
      
      <button on:click={() => show = false}>Close</button>
    </div>
  </div>
{/if}

<style>
  kbd {
    padding: 0.25rem 0.5rem;
    background: var(--gray-800);
    border: 1px solid var(--gray-700);
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
    font-size: 0.9em;
  }
</style>
```

---

## Implementation Checklist

### Phase 1: Global Shortcuts (Target: Sprint 1)
- [ ] Install `tauri-plugin-global-shortcut`
- [ ] Add permissions to capabilities
- [ ] Implement `GlobalShortcutManager`
- [ ] Register toggle window shortcut (`Cmd/Ctrl+Shift+H`)
- [ ] Register quick capture shortcut (`Cmd/Ctrl+Shift+Space`)
- [ ] Test on macOS, Windows, Linux

### Phase 2: Local Shortcuts (Target: Sprint 2)
- [ ] Implement `LocalShortcutManager`
- [ ] Add `ShortcutHandler` component
- [ ] Register core shortcuts (switcher, search, navigation)
- [ ] Handle input field exceptions
- [ ] Test keyboard navigation flow

### Phase 3: Shortcuts Help (Target: Sprint 3)
- [ ] Create `ShortcutsModal` component
- [ ] Register `Cmd/Ctrl+/` to show modal
- [ ] Format shortcuts per platform
- [ ] Categorize shortcuts by function

### Phase 4: Customization (Target: Sprint 4)
- [ ] Create shortcuts store
- [ ] Implement settings UI for customization
- [ ] Save/load custom shortcuts from disk
- [ ] Validate shortcuts (no conflicts)
- [ ] Re-register global shortcuts on change

---

## Known Limitations

1. **Global shortcuts can fail to register** if system/another app uses them - need fallbacks
2. **No shortcut conflict detection** across apps - relies on OS
3. **Linux desktop environment variations** - test on GNOME, KDE, etc.

---

## References

- [Tauri Global Shortcut Plugin](https://v2.tauri.app/plugin/global-shortcut/)
- [Discord Keyboard Shortcuts](https://support.discord.com/hc/en-us/articles/225977308-Keyboard-Shortcuts)
- [Slack Keyboard Shortcuts](https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts)
- [VS Code Keyboard Shortcuts](https://code.visualstudio.com/docs/getstarted/keybindings)

---

**Compiled by:** Data (Research Agent)  
**Next Research Topic:** Native file drag-and-drop (for attachments)

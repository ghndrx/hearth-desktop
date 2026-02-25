/**
 * Keyboard Shortcuts Store
 * 
 * Manages global and local keyboard shortcuts with Tauri integration.
 * Supports customizable key bindings and cross-platform key mapping.
 */

import { writable, derived, get } from 'svelte/store';

export interface Shortcut {
  id: string;
  name: string;
  description: string;
  category: ShortcutCategory;
  defaultKeys: string[];
  currentKeys: string[];
  isGlobal: boolean;
  enabled: boolean;
}

export type ShortcutCategory = 
  | 'navigation'
  | 'messaging'
  | 'voice'
  | 'media'
  | 'window'
  | 'accessibility';

export interface ShortcutConflict {
  shortcutId: string;
  conflictsWith: string;
  keys: string[];
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  // Navigation
  {
    id: 'quick-switcher',
    name: 'Quick Switcher',
    description: 'Open the quick switcher to jump between channels and servers',
    category: 'navigation',
    defaultKeys: ['Ctrl', 'K'],
    currentKeys: ['Ctrl', 'K'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'command-palette',
    name: 'Command Palette',
    description: 'Open the command palette for quick actions',
    category: 'navigation',
    defaultKeys: ['Ctrl', 'Shift', 'P'],
    currentKeys: ['Ctrl', 'Shift', 'P'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'search',
    name: 'Search',
    description: 'Open global search',
    category: 'navigation',
    defaultKeys: ['Ctrl', 'F'],
    currentKeys: ['Ctrl', 'F'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'prev-channel',
    name: 'Previous Channel',
    description: 'Go to the previous channel',
    category: 'navigation',
    defaultKeys: ['Alt', 'ArrowUp'],
    currentKeys: ['Alt', 'ArrowUp'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'next-channel',
    name: 'Next Channel',
    description: 'Go to the next channel',
    category: 'navigation',
    defaultKeys: ['Alt', 'ArrowDown'],
    currentKeys: ['Alt', 'ArrowDown'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'prev-unread',
    name: 'Previous Unread',
    description: 'Jump to the previous unread channel',
    category: 'navigation',
    defaultKeys: ['Alt', 'Shift', 'ArrowUp'],
    currentKeys: ['Alt', 'Shift', 'ArrowUp'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'next-unread',
    name: 'Next Unread',
    description: 'Jump to the next unread channel',
    category: 'navigation',
    defaultKeys: ['Alt', 'Shift', 'ArrowDown'],
    currentKeys: ['Alt', 'Shift', 'ArrowDown'],
    isGlobal: false,
    enabled: true,
  },
  
  // Messaging
  {
    id: 'focus-input',
    name: 'Focus Message Input',
    description: 'Focus the message input field',
    category: 'messaging',
    defaultKeys: ['Escape'],
    currentKeys: ['Escape'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'edit-last',
    name: 'Edit Last Message',
    description: 'Edit your last sent message',
    category: 'messaging',
    defaultKeys: ['ArrowUp'],
    currentKeys: ['ArrowUp'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'emoji-picker',
    name: 'Emoji Picker',
    description: 'Open the emoji picker',
    category: 'messaging',
    defaultKeys: ['Ctrl', 'E'],
    currentKeys: ['Ctrl', 'E'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'gif-picker',
    name: 'GIF Picker',
    description: 'Open the GIF picker',
    category: 'messaging',
    defaultKeys: ['Ctrl', 'G'],
    currentKeys: ['Ctrl', 'G'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'upload-file',
    name: 'Upload File',
    description: 'Open file upload dialog',
    category: 'messaging',
    defaultKeys: ['Ctrl', 'U'],
    currentKeys: ['Ctrl', 'U'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'mark-read',
    name: 'Mark as Read',
    description: 'Mark current channel as read',
    category: 'messaging',
    defaultKeys: ['Escape'],
    currentKeys: ['Escape'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'mark-all-read',
    name: 'Mark All as Read',
    description: 'Mark all channels as read',
    category: 'messaging',
    defaultKeys: ['Shift', 'Escape'],
    currentKeys: ['Shift', 'Escape'],
    isGlobal: false,
    enabled: true,
  },
  
  // Voice
  {
    id: 'toggle-mute',
    name: 'Toggle Mute',
    description: 'Mute or unmute your microphone',
    category: 'voice',
    defaultKeys: ['Ctrl', 'Shift', 'M'],
    currentKeys: ['Ctrl', 'Shift', 'M'],
    isGlobal: true,
    enabled: true,
  },
  {
    id: 'toggle-deafen',
    name: 'Toggle Deafen',
    description: 'Deafen or undeafen audio',
    category: 'voice',
    defaultKeys: ['Ctrl', 'Shift', 'D'],
    currentKeys: ['Ctrl', 'Shift', 'D'],
    isGlobal: true,
    enabled: true,
  },
  {
    id: 'push-to-talk',
    name: 'Push to Talk',
    description: 'Hold to transmit voice',
    category: 'voice',
    defaultKeys: ['`'],
    currentKeys: ['`'],
    isGlobal: true,
    enabled: false,
  },
  {
    id: 'disconnect-voice',
    name: 'Disconnect from Voice',
    description: 'Leave the current voice channel',
    category: 'voice',
    defaultKeys: ['Ctrl', 'Shift', 'E'],
    currentKeys: ['Ctrl', 'Shift', 'E'],
    isGlobal: false,
    enabled: true,
  },
  
  // Media
  {
    id: 'toggle-video',
    name: 'Toggle Video',
    description: 'Turn camera on or off',
    category: 'media',
    defaultKeys: ['Ctrl', 'Shift', 'V'],
    currentKeys: ['Ctrl', 'Shift', 'V'],
    isGlobal: true,
    enabled: true,
  },
  {
    id: 'screen-share',
    name: 'Screen Share',
    description: 'Start or stop screen sharing',
    category: 'media',
    defaultKeys: ['Ctrl', 'Shift', 'S'],
    currentKeys: ['Ctrl', 'Shift', 'S'],
    isGlobal: false,
    enabled: true,
  },
  
  // Window
  {
    id: 'minimize-to-tray',
    name: 'Minimize to Tray',
    description: 'Minimize the window to system tray',
    category: 'window',
    defaultKeys: ['Ctrl', 'W'],
    currentKeys: ['Ctrl', 'W'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'toggle-sidebar',
    name: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    category: 'window',
    defaultKeys: ['Ctrl', '\\'],
    currentKeys: ['Ctrl', '\\'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'toggle-member-list',
    name: 'Toggle Member List',
    description: 'Show or hide the member list',
    category: 'window',
    defaultKeys: ['Ctrl', 'Shift', 'U'],
    currentKeys: ['Ctrl', 'Shift', 'U'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'zoom-in',
    name: 'Zoom In',
    description: 'Increase zoom level',
    category: 'window',
    defaultKeys: ['Ctrl', '='],
    currentKeys: ['Ctrl', '='],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'zoom-out',
    name: 'Zoom Out',
    description: 'Decrease zoom level',
    category: 'window',
    defaultKeys: ['Ctrl', '-'],
    currentKeys: ['Ctrl', '-'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'zoom-reset',
    name: 'Reset Zoom',
    description: 'Reset zoom to default',
    category: 'window',
    defaultKeys: ['Ctrl', '0'],
    currentKeys: ['Ctrl', '0'],
    isGlobal: false,
    enabled: true,
  },
  
  // Accessibility
  {
    id: 'open-settings',
    name: 'Open Settings',
    description: 'Open user settings',
    category: 'accessibility',
    defaultKeys: ['Ctrl', ','],
    currentKeys: ['Ctrl', ','],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'toggle-high-contrast',
    name: 'Toggle High Contrast',
    description: 'Toggle high contrast mode',
    category: 'accessibility',
    defaultKeys: ['Ctrl', 'Shift', 'H'],
    currentKeys: ['Ctrl', 'Shift', 'H'],
    isGlobal: false,
    enabled: true,
  },
  {
    id: 'toggle-reduced-motion',
    name: 'Toggle Reduced Motion',
    description: 'Toggle reduced motion mode',
    category: 'accessibility',
    defaultKeys: ['Ctrl', 'Shift', 'R'],
    currentKeys: ['Ctrl', 'Shift', 'R'],
    isGlobal: false,
    enabled: true,
  },
];

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  messaging: 'Messaging',
  voice: 'Voice & Video',
  media: 'Media',
  window: 'Window',
  accessibility: 'Accessibility',
};

const CATEGORY_ICONS: Record<ShortcutCategory, string> = {
  navigation: '🧭',
  messaging: '💬',
  voice: '🎤',
  media: '📺',
  window: '🪟',
  accessibility: '♿',
};

// Store state
interface ShortcutsState {
  shortcuts: Shortcut[];
  isRecording: boolean;
  recordingId: string | null;
  recordedKeys: string[];
}

const initialState: ShortcutsState = {
  shortcuts: [...DEFAULT_SHORTCUTS],
  isRecording: false,
  recordingId: null,
  recordedKeys: [],
};

function createShortcutsStore() {
  const { subscribe, set, update } = writable<ShortcutsState>(initialState);
  
  // Load saved shortcuts from localStorage
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('hearth-shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        update(state => ({
          ...state,
          shortcuts: state.shortcuts.map(shortcut => {
            const savedShortcut = parsed.find((s: Shortcut) => s.id === shortcut.id);
            if (savedShortcut) {
              return {
                ...shortcut,
                currentKeys: savedShortcut.currentKeys || shortcut.defaultKeys,
                enabled: savedShortcut.enabled ?? shortcut.enabled,
              };
            }
            return shortcut;
          }),
        }));
      }
    } catch (e) {
      console.warn('Failed to load shortcuts:', e);
    }
  }
  
  function saveToStorage(shortcuts: Shortcut[]) {
    if (typeof window !== 'undefined') {
      const toSave = shortcuts.map(s => ({
        id: s.id,
        currentKeys: s.currentKeys,
        enabled: s.enabled,
      }));
      localStorage.setItem('hearth-shortcuts', JSON.stringify(toSave));
    }
  }
  
  return {
    subscribe,
    
    startRecording: (shortcutId: string) => {
      update(state => ({
        ...state,
        isRecording: true,
        recordingId: shortcutId,
        recordedKeys: [],
      }));
    },
    
    addRecordedKey: (key: string) => {
      update(state => {
        if (!state.isRecording) return state;
        
        // Normalize key names
        const normalizedKey = normalizeKeyName(key);
        
        // Prevent duplicates
        if (state.recordedKeys.includes(normalizedKey)) {
          return state;
        }
        
        // Max 4 keys in a combination
        if (state.recordedKeys.length >= 4) {
          return state;
        }
        
        return {
          ...state,
          recordedKeys: [...state.recordedKeys, normalizedKey],
        };
      });
    },
    
    confirmRecording: () => {
      update(state => {
        if (!state.isRecording || !state.recordingId || state.recordedKeys.length === 0) {
          return {
            ...state,
            isRecording: false,
            recordingId: null,
            recordedKeys: [],
          };
        }
        
        const newShortcuts = state.shortcuts.map(shortcut => {
          if (shortcut.id === state.recordingId) {
            return {
              ...shortcut,
              currentKeys: [...state.recordedKeys],
            };
          }
          return shortcut;
        });
        
        saveToStorage(newShortcuts);
        
        return {
          ...state,
          shortcuts: newShortcuts,
          isRecording: false,
          recordingId: null,
          recordedKeys: [],
        };
      });
    },
    
    cancelRecording: () => {
      update(state => ({
        ...state,
        isRecording: false,
        recordingId: null,
        recordedKeys: [],
      }));
    },
    
    resetShortcut: (shortcutId: string) => {
      update(state => {
        const newShortcuts = state.shortcuts.map(shortcut => {
          if (shortcut.id === shortcutId) {
            return {
              ...shortcut,
              currentKeys: [...shortcut.defaultKeys],
            };
          }
          return shortcut;
        });
        
        saveToStorage(newShortcuts);
        return { ...state, shortcuts: newShortcuts };
      });
    },
    
    resetAllShortcuts: () => {
      update(state => {
        const newShortcuts = state.shortcuts.map(shortcut => ({
          ...shortcut,
          currentKeys: [...shortcut.defaultKeys],
        }));
        
        saveToStorage(newShortcuts);
        return { ...state, shortcuts: newShortcuts };
      });
    },
    
    toggleShortcut: (shortcutId: string) => {
      update(state => {
        const newShortcuts = state.shortcuts.map(shortcut => {
          if (shortcut.id === shortcutId) {
            return {
              ...shortcut,
              enabled: !shortcut.enabled,
            };
          }
          return shortcut;
        });
        
        saveToStorage(newShortcuts);
        return { ...state, shortcuts: newShortcuts };
      });
    },
    
    clearShortcut: (shortcutId: string) => {
      update(state => {
        const newShortcuts = state.shortcuts.map(shortcut => {
          if (shortcut.id === shortcutId) {
            return {
              ...shortcut,
              currentKeys: [],
              enabled: false,
            };
          }
          return shortcut;
        });
        
        saveToStorage(newShortcuts);
        return { ...state, shortcuts: newShortcuts };
      });
    },
  };
}

export const shortcutsStore = createShortcutsStore();

// Derived stores
export const shortcuts = derived(shortcutsStore, $state => $state.shortcuts);
export const isRecording = derived(shortcutsStore, $state => $state.isRecording);
export const recordingId = derived(shortcutsStore, $state => $state.recordingId);
export const recordedKeys = derived(shortcutsStore, $state => $state.recordedKeys);

export const shortcutsByCategory = derived(shortcuts, $shortcuts => {
  const grouped: Record<ShortcutCategory, Shortcut[]> = {
    navigation: [],
    messaging: [],
    voice: [],
    media: [],
    window: [],
    accessibility: [],
  };
  
  for (const shortcut of $shortcuts) {
    grouped[shortcut.category].push(shortcut);
  }
  
  return grouped;
});

export const conflicts = derived(shortcuts, $shortcuts => {
  const conflicts: ShortcutConflict[] = [];
  const keyMap = new Map<string, string[]>();
  
  for (const shortcut of $shortcuts) {
    if (!shortcut.enabled || shortcut.currentKeys.length === 0) continue;
    
    const keyString = shortcut.currentKeys.join('+');
    const existing = keyMap.get(keyString);
    
    if (existing) {
      existing.push(shortcut.id);
    } else {
      keyMap.set(keyString, [shortcut.id]);
    }
  }
  
  for (const [keys, ids] of keyMap) {
    if (ids.length > 1) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          conflicts.push({
            shortcutId: ids[i],
            conflictsWith: ids[j],
            keys: keys.split('+'),
          });
        }
      }
    }
  }
  
  return conflicts;
});

// Utility functions
function normalizeKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    'Control': 'Ctrl',
    'Meta': 'Cmd',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    ' ': 'Space',
  };
  
  return keyMap[key] || key;
}

export function formatKeys(keys: string[]): string {
  if (keys.length === 0) return 'Not set';
  
  return keys
    .map(key => {
      // Use platform-specific modifier symbols on macOS
      if (typeof navigator !== 'undefined' && navigator.platform.includes('Mac')) {
        const macMap: Record<string, string> = {
          'Ctrl': '⌃',
          'Alt': '⌥',
          'Shift': '⇧',
          'Cmd': '⌘',
        };
        return macMap[key] || key;
      }
      return key;
    })
    .join(' + ');
}

export function getCategoryLabel(category: ShortcutCategory): string {
  return CATEGORY_LABELS[category];
}

export function getCategoryIcon(category: ShortcutCategory): string {
  return CATEGORY_ICONS[category];
}

export function getShortcut(id: string): Shortcut | undefined {
  const state = get(shortcutsStore);
  return state.shortcuts.find(s => s.id === id);
}

export function isShortcutPressed(event: KeyboardEvent, shortcutId: string): boolean {
  const shortcut = getShortcut(shortcutId);
  if (!shortcut || !shortcut.enabled || shortcut.currentKeys.length === 0) {
    return false;
  }
  
  const pressedKeys: string[] = [];
  
  if (event.ctrlKey) pressedKeys.push('Ctrl');
  if (event.altKey) pressedKeys.push('Alt');
  if (event.shiftKey) pressedKeys.push('Shift');
  if (event.metaKey) pressedKeys.push('Cmd');
  
  const key = normalizeKeyName(event.key);
  if (!['Ctrl', 'Alt', 'Shift', 'Cmd', 'Control', 'Meta'].includes(event.key)) {
    pressedKeys.push(key);
  }
  
  // Check if all required keys are pressed
  if (pressedKeys.length !== shortcut.currentKeys.length) {
    return false;
  }
  
  return shortcut.currentKeys.every(k => pressedKeys.includes(k));
}

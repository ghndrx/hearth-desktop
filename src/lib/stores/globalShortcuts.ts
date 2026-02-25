/**
 * Global Shortcuts Store
 *
 * Manages system-wide global shortcuts via Tauri backend.
 * These shortcuts work even when the app window is not focused.
 */

import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface RegisteredShortcut {
  id: string;
  accelerator: string;
  label: string;
  active: boolean;
}

export interface GlobalShortcutBinding {
  id: string;
  keys: string[];
  label: string;
  description: string;
}

/** Default global shortcut bindings */
export const DEFAULT_GLOBAL_BINDINGS: GlobalShortcutBinding[] = [
  {
    id: 'global-toggle-window',
    keys: ['Ctrl', 'Shift', 'H'],
    label: 'Toggle Window',
    description: 'Show or hide the Hearth window',
  },
  {
    id: 'global-toggle-mute',
    keys: ['Ctrl', 'Shift', 'M'],
    label: 'Toggle Mute',
    description: 'Mute or unmute notifications globally',
  },
  {
    id: 'global-toggle-deafen',
    keys: ['Ctrl', 'Shift', 'D'],
    label: 'Toggle Deafen',
    description: 'Deafen or undeafen audio output',
  },
  {
    id: 'global-push-to-talk',
    keys: ['Ctrl', '`'],
    label: 'Push to Talk',
    description: 'Hold to transmit voice (when PTT is enabled)',
  },
  {
    id: 'global-toggle-dnd',
    keys: ['Ctrl', 'Shift', 'N'],
    label: 'Toggle Do Not Disturb',
    description: 'Enable or disable Do Not Disturb mode',
  },
  {
    id: 'global-focus-mode',
    keys: ['Ctrl', 'Shift', 'F'],
    label: 'Toggle Focus Mode',
    description: 'Only receive mentions and DMs',
  },
];

interface GlobalShortcutsState {
  registered: RegisteredShortcut[];
  bindings: GlobalShortcutBinding[];
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'hearth-global-shortcuts';

function loadBindings(): GlobalShortcutBinding[] {
  if (typeof window === 'undefined') return [...DEFAULT_GLOBAL_BINDINGS];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: GlobalShortcutBinding[] = JSON.parse(saved);
      // Merge saved bindings with defaults (preserve new defaults, apply saved keys)
      return DEFAULT_GLOBAL_BINDINGS.map((def) => {
        const saved = parsed.find((s) => s.id === def.id);
        return saved ? { ...def, keys: saved.keys } : def;
      });
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_GLOBAL_BINDINGS];
}

function saveBindings(bindings: GlobalShortcutBinding[]) {
  if (typeof window === 'undefined') return;
  const toSave = bindings.map((b) => ({ id: b.id, keys: b.keys }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function createGlobalShortcutsStore() {
  const { subscribe, set, update } = writable<GlobalShortcutsState>({
    registered: [],
    bindings: loadBindings(),
    loading: false,
    error: null,
  });

  let unlisten: UnlistenFn | null = null;
  let handlers: Map<string, () => void> = new Map();

  return {
    subscribe,

    /** Register a handler function for a specific shortcut ID */
    onShortcut(id: string, handler: () => void) {
      handlers.set(id, handler);
    },

    /** Remove a handler for a specific shortcut ID */
    offShortcut(id: string) {
      handlers.delete(id);
    },

    /** Initialize the event listener for global shortcut triggers */
    async init() {
      if (unlisten) return;
      unlisten = await listen<{ id: string }>('global-shortcut-triggered', (event) => {
        const handler = handlers.get(event.payload.id);
        if (handler) handler();
      });
    },

    /** Clean up the event listener */
    async destroy() {
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
      handlers.clear();
    },

    /** Register a global shortcut with the Tauri backend */
    async register(binding: GlobalShortcutBinding): Promise<void> {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await invoke<RegisteredShortcut>('register_global_shortcut', {
          id: binding.id,
          keys: binding.keys,
          label: binding.label,
        });
        update((s) => ({
          ...s,
          registered: [...s.registered.filter((r) => r.id !== result.id), result],
          loading: false,
        }));
      } catch (err) {
        update((s) => ({
          ...s,
          loading: false,
          error: `Failed to register "${binding.label}": ${err}`,
        }));
      }
    },

    /** Unregister a global shortcut */
    async unregister(id: string): Promise<void> {
      try {
        await invoke('unregister_global_shortcut', { id });
        update((s) => ({
          ...s,
          registered: s.registered.filter((r) => r.id !== id),
        }));
      } catch (err) {
        update((s) => ({
          ...s,
          error: `Failed to unregister shortcut: ${err}`,
        }));
      }
    },

    /** Unregister all global shortcuts */
    async unregisterAll(): Promise<void> {
      try {
        await invoke('unregister_all_global_shortcuts');
        update((s) => ({ ...s, registered: [] }));
      } catch (err) {
        update((s) => ({
          ...s,
          error: `Failed to unregister all: ${err}`,
        }));
      }
    },

    /** Refresh the registered list from the backend */
    async refresh(): Promise<void> {
      try {
        const list = await invoke<RegisteredShortcut[]>('list_global_shortcuts');
        update((s) => ({ ...s, registered: list }));
      } catch (err) {
        update((s) => ({
          ...s,
          error: `Failed to list shortcuts: ${err}`,
        }));
      }
    },

    /** Register all bindings from the current state */
    async registerAll(): Promise<void> {
      update((s) => ({ ...s, loading: true, error: null }));
      let state: GlobalShortcutsState | null = null;
      const unsub = subscribe((s) => (state = s));
      unsub();
      if (!state) return;

      for (const binding of (state as GlobalShortcutsState).bindings) {
        if (binding.keys.length > 0) {
          try {
            const result = await invoke<RegisteredShortcut>('register_global_shortcut', {
              id: binding.id,
              keys: binding.keys,
              label: binding.label,
            });
            update((s) => ({
              ...s,
              registered: [...s.registered.filter((r) => r.id !== result.id), result],
            }));
          } catch {
            // Skip shortcuts that fail to register (e.g., conflicts with OS)
          }
        }
      }
      update((s) => ({ ...s, loading: false }));
    },

    /** Update a binding's key combination and re-register it */
    async updateBinding(id: string, newKeys: string[]): Promise<void> {
      // Unregister old shortcut
      await invoke('unregister_global_shortcut', { id }).catch(() => {});

      update((s) => {
        const newBindings = s.bindings.map((b) =>
          b.id === id ? { ...b, keys: newKeys } : b
        );
        saveBindings(newBindings);
        return {
          ...s,
          bindings: newBindings,
          registered: s.registered.filter((r) => r.id !== id),
        };
      });

      // Re-register with new keys if keys are set
      if (newKeys.length > 0) {
        let binding: GlobalShortcutBinding | undefined;
        const unsub = subscribe((s) => {
          binding = s.bindings.find((b) => b.id === id);
        });
        unsub();
        if (binding) {
          try {
            const result = await invoke<RegisteredShortcut>('register_global_shortcut', {
              id: binding.id,
              keys: newKeys,
              label: binding.label,
            });
            update((s) => ({
              ...s,
              registered: [...s.registered.filter((r) => r.id !== result.id), result],
            }));
          } catch (err) {
            update((s) => ({
              ...s,
              error: `Failed to register "${binding!.label}": ${err}`,
            }));
          }
        }
      }
    },

    /** Reset a binding to its default keys */
    async resetBinding(id: string): Promise<void> {
      const defaultBinding = DEFAULT_GLOBAL_BINDINGS.find((b) => b.id === id);
      if (defaultBinding) {
        await this.updateBinding(id, [...defaultBinding.keys]);
      }
    },

    /** Reset all bindings to defaults */
    async resetAll(): Promise<void> {
      await invoke('unregister_all_global_shortcuts').catch(() => {});
      update((s) => ({
        ...s,
        bindings: [...DEFAULT_GLOBAL_BINDINGS],
        registered: [],
      }));
      saveBindings([...DEFAULT_GLOBAL_BINDINGS]);
      await this.registerAll();
    },

    /** Clear the error */
    clearError() {
      update((s) => ({ ...s, error: null }));
    },
  };
}

export const globalShortcutsStore = createGlobalShortcutsStore();

// Derived stores
export const globalShortcuts = derived(globalShortcutsStore, ($s) => $s.bindings);
export const registeredShortcuts = derived(globalShortcutsStore, ($s) => $s.registered);
export const globalShortcutsLoading = derived(globalShortcutsStore, ($s) => $s.loading);
export const globalShortcutsError = derived(globalShortcutsStore, ($s) => $s.error);

/** Check if a shortcut is currently registered */
export function isRegistered(
  registered: RegisteredShortcut[],
  id: string
): boolean {
  return registered.some((r) => r.id === id && r.active);
}

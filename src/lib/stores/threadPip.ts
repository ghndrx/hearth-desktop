import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface PipWindowState {
  windowId: string;
  conversationId: string;
  conversationType: 'thread' | 'dm' | 'channel';
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  alwaysOnTop: boolean;
  compactMode: boolean;
  createdAt: number;
}

export interface PipConfig {
  defaultWidth: number;
  defaultHeight: number;
  defaultOpacity: number;
  alwaysOnTop: boolean;
  compactMode: boolean;
  maxWindows: number;
  rememberPositions: boolean;
}

const DEFAULT_CONFIG: PipConfig = {
  defaultWidth: 360,
  defaultHeight: 480,
  defaultOpacity: 1.0,
  alwaysOnTop: true,
  compactMode: false,
  maxWindows: 5,
  rememberPositions: true
};

function createThreadPipStore() {
  const windows = writable<PipWindowState[]>([]);
  const config = writable<PipConfig>({ ...DEFAULT_CONFIG });

  const unlisteners: UnlistenFn[] = [];

  return {
    subscribe: windows.subscribe,
    config: { subscribe: config.subscribe },

    async init() {
      try {
        const [list, cfg] = await Promise.all([
          invoke<PipWindowState[]>('pip_list_windows'),
          invoke<PipConfig>('pip_get_config')
        ]);
        windows.set(list);
        config.set(cfg);
      } catch {
        // Backend not available yet
      }

      try {
        const u1 = await listen<PipWindowState>('pip:window-opened', (e) => {
          windows.update(ws => [...ws, e.payload]);
        });
        const u2 = await listen<string>('pip:window-closed', (e) => {
          windows.update(ws => ws.filter(w => w.windowId !== e.payload));
        });
        const u3 = await listen('pip:all-closed', () => {
          windows.set([]);
        });
        const u4 = await listen<PipConfig>('pip:config-changed', (e) => {
          config.set(e.payload);
        });
        unlisteners.push(u1, u2, u3, u4);
      } catch {
        // Events not available
      }
    },

    cleanup() {
      unlisteners.forEach(u => u());
      unlisteners.length = 0;
    },

    async openWindow(conversationId: string, conversationType: 'thread' | 'dm' | 'channel', title: string) {
      return invoke<PipWindowState>('pip_open_window', {
        conversationId,
        conversationType,
        title
      });
    },

    async closeWindow(windowId: string) {
      return invoke<void>('pip_close_window', { windowId });
    },

    async closeAll() {
      return invoke<void>('pip_close_all');
    },

    async setOpacity(windowId: string, opacity: number) {
      return invoke<void>('pip_set_opacity', { windowId, opacity });
    },

    async setAlwaysOnTop(windowId: string, onTop: boolean) {
      return invoke<void>('pip_set_always_on_top', { windowId, onTop });
    },

    async setCompact(windowId: string, compact: boolean) {
      return invoke<void>('pip_set_compact', { windowId, compact });
    },

    async getConfig() {
      const cfg = await invoke<PipConfig>('pip_get_config');
      config.set(cfg);
      return cfg;
    },

    async setConfig(cfg: PipConfig) {
      await invoke<void>('pip_set_config', { config: cfg });
      config.set(cfg);
    },

    getWindowCount() {
      return get(windows).length;
    }
  };
}

export const threadPip = createThreadPipStore();

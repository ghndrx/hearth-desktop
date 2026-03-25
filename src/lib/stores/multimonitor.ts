//! Multi-Monitor Store
//!
//! Svelte store for multi-monitor detection and configuration.
//! Provides reactive state for monitor list, current monitor, and preferences.

import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { browser } from '$app/environment';

// ============================================================================
// Types
// ============================================================================

export interface Monitor {
  id: string;
  name: string;
  isPrimary: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  refreshRate: number;
  rotation: number;
  isConnected: boolean;
}

export interface MonitorPreferences {
  monitorId: string;
  preferred: boolean;
  label: string | null;
}

export interface ScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MultiMonitorState {
  monitors: Monitor[];
  currentMonitor: Monitor | null;
  preferences: MonitorPreferences[];
  virtualScreen: ScreenBounds | null;
  loading: boolean;
  error: string | null;
}

const initialState: MultiMonitorState = {
  monitors: [],
  currentMonitor: null,
  preferences: [],
  virtualScreen: null,
  loading: false,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

function createMultiMonitorStore() {
  const { subscribe, set, update } = writable<MultiMonitorState>(initialState);

  return {
    subscribe,

    /** Refresh all monitor information from the native layer */
    async refresh(): Promise<void> {
      if (!browser) return;

      update((s) => ({ ...s, loading: true, error: null }));

      try {
        const [monitors, currentMonitor, virtualScreen, preferences] = await Promise.all([
          invoke<Monitor[]>('get_monitors'),
          invoke<Monitor | null>('get_window_monitor'),
          invoke<ScreenBounds>('get_virtual_screen_bounds'),
          invoke<MonitorPreferences[]>('get_monitor_preferences'),
        ]);

        update((s) => ({
          ...s,
          monitors,
          currentMonitor,
          virtualScreen,
          preferences,
          loading: false,
        }));
      } catch (err) {
        update((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },

    /** Move the app window to a specific monitor */
    async moveToMonitor(monitorId: string): Promise<void> {
      if (!browser) return;

      try {
        await invoke('move_window_to_monitor', { monitorId });
        // Refresh to update currentMonitor
        await this.refresh();
      } catch (err) {
        update((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },

    /** Save preferences for a specific monitor */
    async savePreference(preference: MonitorPreferences): Promise<void> {
      if (!browser) return;

      try {
        await invoke('save_monitor_preference', { preference });
        const preferences = await invoke<MonitorPreferences[]>('get_monitor_preferences');
        update((s) => ({ ...s, preferences }));
      } catch (err) {
        update((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },

    /** Set a monitor as the preferred display for the app */
    async setPreferredMonitor(monitorId: string): Promise<void> {
      if (!browser) return;

      try {
        await invoke('set_preferred_monitor', { monitorId });
        await this.refresh();
      } catch (err) {
        update((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },

    /** Clear any error state */
    clearError(): void {
      update((s) => ({ ...s, error: null }));
    },

    /** Reset to initial state */
    reset(): void {
      set(initialState);
    },
  };
}

export const multiMonitor = createMultiMonitorStore();

// ============================================================================
// Derived Stores
// ============================================================================

/** All currently connected monitors */
export const connectedMonitors = derived(
  multiMonitor,
  ($m) => $m.monitors.filter((m) => m.isConnected)
);

/** The primary monitor (if any) */
export const primaryMonitor = derived(
  multiMonitor,
  ($m) => $m.monitors.find((m) => m.isPrimary) ?? null
);

/** The preferred monitor (based on user preferences) */
export const preferredMonitor = derived(multiMonitor, ($m) => {
  const pref = $m.preferences.find((p) => p.preferred);
  if (!pref) return null;
  return $m.monitors.find((mon) => mon.id === pref.monitorId) ?? null;
});

/** Whether multi-monitor is available (more than one monitor) */
export const hasMultiMonitor = derived(
  multiMonitor,
  ($m) => $m.monitors.length > 1
);

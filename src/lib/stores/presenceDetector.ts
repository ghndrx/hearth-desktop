import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';

export interface PresenceState {
  activityState: 'active' | 'idle' | 'away' | 'donotdisturb';
  presenceStatus: PresenceStatus;
  idleSeconds: number;
  windowFocused: boolean;
  inMeeting: boolean;
  manualOverride: boolean;
  idleThreshold: number;
  awayThreshold: number;
  detectorActive: boolean;
  screenLocked: boolean;
}

export interface PresenceConfig {
  idleThreshold: number;
  awayThreshold: number;
}

function createPresenceDetectorStore() {
  const state = writable<PresenceState>({
    activityState: 'active',
    presenceStatus: 'online',
    idleSeconds: 0,
    windowFocused: true,
    inMeeting: false,
    manualOverride: false,
    idleThreshold: 300,
    awayThreshold: 900,
    detectorActive: false,
    screenLocked: false,
  });

  let unlisten: (() => void) | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  return {
    state: { subscribe: state.subscribe },

    async init() {
      try {
        // Start the backend detector
        await invoke('start_presence_detector');

        // Get initial state
        const initial = await invoke<PresenceState>('get_presence_state');
        state.set(initial);

        // Listen for state changes from backend
        const unlistenFn = await listen<PresenceState>('presence-detector:state-changed', (event) => {
          state.set(event.payload);
        });
        unlisten = unlistenFn;

        // Poll for state updates (idle seconds change frequently)
        pollInterval = setInterval(async () => {
          try {
            const current = await invoke<PresenceState>('get_presence_state');
            state.set(current);
          } catch (error) {
            console.error('Failed to poll presence state:', error);
          }
        }, 5000);
      } catch (error) {
        console.error('Failed to initialize presence detector:', error);
      }
    },

    async setManualStatus(status: PresenceStatus | null) {
      try {
        const result = await invoke<PresenceState>('set_manual_status', { status });
        state.set(result);
      } catch (error) {
        console.error('Failed to set manual status:', error);
      }
    },

    async updateConfig(config: PresenceConfig) {
      try {
        await invoke<PresenceConfig>('set_presence_config', {
          idleThreshold: config.idleThreshold,
          awayThreshold: config.awayThreshold,
        });
        // Refresh state to pick up new thresholds
        const current = await invoke<PresenceState>('get_presence_state');
        state.set(current);
      } catch (error) {
        console.error('Failed to update presence config:', error);
      }
    },

    async cleanup() {
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      try {
        await invoke('stop_presence_detector');
      } catch (error) {
        console.error('Failed to stop presence detector:', error);
      }
    },
  };
}

export const presenceDetector = createPresenceDetectorStore();

export const currentPresence = derived(
  presenceDetector.state,
  ($state) => $state.presenceStatus
);

export const isIdle = derived(
  presenceDetector.state,
  ($state) => $state.activityState === 'idle' || $state.activityState === 'away'
);

export const isAway = derived(
  presenceDetector.state,
  ($state) => $state.activityState === 'away'
);

export const presenceConfig = derived(
  presenceDetector.state,
  ($state) => ({
    idleThreshold: $state.idleThreshold,
    awayThreshold: $state.awayThreshold,
  })
);

export function formatIdleTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

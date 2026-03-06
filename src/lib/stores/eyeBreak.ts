import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface EyeBreakConfig {
  workIntervalMs: number;
  breakDurationMs: number;
  enabled: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
}

export interface EyeBreakState {
  active: boolean;
  onBreak: boolean;
  startedAt: number;
  nextBreakAt: number;
  breakStartedAt: number;
  breaksTaken: number;
  breaksSkipped: number;
  totalSessionMs: number;
}

const DEFAULT_CONFIG: EyeBreakConfig = {
  workIntervalMs: 20 * 60 * 1000,
  breakDurationMs: 20 * 1000,
  enabled: true,
  soundEnabled: true,
  notificationEnabled: true
};

const DEFAULT_STATE: EyeBreakState = {
  active: false,
  onBreak: false,
  startedAt: 0,
  nextBreakAt: 0,
  breakStartedAt: 0,
  breaksTaken: 0,
  breaksSkipped: 0,
  totalSessionMs: 0
};

function createEyeBreakStore() {
  const state = writable<EyeBreakState>({ ...DEFAULT_STATE });
  const config = writable<EyeBreakConfig>({ ...DEFAULT_CONFIG });
  const timeRemaining = writable<number>(0);
  const breakTimeRemaining = writable<number>(0);

  let tickInterval: ReturnType<typeof setInterval> | null = null;

  function startTicking() {
    stopTicking();
    tickInterval = setInterval(() => {
      const s = get(state);
      const now = Date.now();
      if (s.active && !s.onBreak && s.nextBreakAt > 0) {
        const remaining = Math.max(0, s.nextBreakAt - now);
        timeRemaining.set(remaining);
        if (remaining === 0) {
          // Time for a break - notify frontend
          state.update(st => ({ ...st, onBreak: true, breakStartedAt: now }));
        }
      } else if (s.onBreak && s.breakStartedAt > 0) {
        const c = get(config);
        const elapsed = now - s.breakStartedAt;
        const remaining = Math.max(0, c.breakDurationMs - elapsed);
        breakTimeRemaining.set(remaining);
      } else {
        timeRemaining.set(0);
        breakTimeRemaining.set(0);
      }
    }, 500);
  }

  function stopTicking() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  return {
    subscribe: state.subscribe,
    config: { subscribe: config.subscribe },
    timeRemaining: { subscribe: timeRemaining.subscribe },
    breakTimeRemaining: { subscribe: breakTimeRemaining.subscribe },

    async init() {
      try {
        const [s, c] = await Promise.all([
          invoke<EyeBreakState>('eyebreak_get_state'),
          invoke<EyeBreakConfig>('eyebreak_get_config')
        ]);
        state.set(s);
        config.set(c);
        if (s.active) startTicking();
      } catch (error) {
        console.error('Failed to initialize eye break:', error);
      }
    },

    async start() {
      try {
        const result = await invoke<EyeBreakState>('eyebreak_start');
        state.set(result);
        startTicking();
      } catch (error) {
        console.error('Failed to start eye break timer:', error);
      }
    },

    async stop() {
      try {
        const result = await invoke<EyeBreakState>('eyebreak_stop');
        state.set(result);
        stopTicking();
        timeRemaining.set(0);
        breakTimeRemaining.set(0);
      } catch (error) {
        console.error('Failed to stop eye break timer:', error);
      }
    },

    async beginBreak() {
      try {
        const result = await invoke<EyeBreakState>('eyebreak_begin_break');
        state.set(result);
      } catch (error) {
        console.error('Failed to begin eye break:', error);
      }
    },

    async endBreak() {
      try {
        const result = await invoke<EyeBreakState>('eyebreak_end_break');
        state.set(result);
        breakTimeRemaining.set(0);
      } catch (error) {
        console.error('Failed to end eye break:', error);
      }
    },

    async skipBreak() {
      try {
        const result = await invoke<EyeBreakState>('eyebreak_skip_break');
        state.set(result);
        breakTimeRemaining.set(0);
      } catch (error) {
        console.error('Failed to skip eye break:', error);
      }
    },

    async updateConfig(newConfig: EyeBreakConfig) {
      try {
        const result = await invoke<EyeBreakConfig>('eyebreak_set_config', { newConfig });
        config.set(result);
      } catch (error) {
        console.error('Failed to update eye break config:', error);
      }
    },

    async resetStats() {
      try {
        const result = await invoke<EyeBreakState>('eyebreak_reset_stats');
        state.set(result);
      } catch (error) {
        console.error('Failed to reset eye break stats:', error);
      }
    },

    cleanup() {
      stopTicking();
    }
  };
}

export const eyeBreak = createEyeBreakStore();

export const eyeBreakActive = derived(
  { subscribe: eyeBreak.subscribe },
  $state => $state.active
);

export const eyeBreakOnBreak = derived(
  { subscribe: eyeBreak.subscribe },
  $state => $state.onBreak
);

export function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

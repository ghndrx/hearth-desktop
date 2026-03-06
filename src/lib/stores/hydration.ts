import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface HydrationConfig {
  reminderIntervalMs: number;
  dailyGoalGlasses: number;
  glassSizeMl: number;
  enabled: boolean;
  notificationEnabled: boolean;
}

export interface HydrationState {
  active: boolean;
  startedAt: number;
  nextReminderAt: number;
  glassesToday: number;
  totalMlToday: number;
  lastDrinkAt: number;
  remindersSent: number;
  dayStartedAt: number;
}

const DEFAULT_CONFIG: HydrationConfig = {
  reminderIntervalMs: 30 * 60 * 1000,
  dailyGoalGlasses: 8,
  glassSizeMl: 250,
  enabled: true,
  notificationEnabled: true
};

const DEFAULT_STATE: HydrationState = {
  active: false,
  startedAt: 0,
  nextReminderAt: 0,
  glassesToday: 0,
  totalMlToday: 0,
  lastDrinkAt: 0,
  remindersSent: 0,
  dayStartedAt: 0
};

function createHydrationStore() {
  const state = writable<HydrationState>({ ...DEFAULT_STATE });
  const config = writable<HydrationConfig>({ ...DEFAULT_CONFIG });
  const timeUntilReminder = writable<number>(0);
  const reminderDue = writable<boolean>(false);

  let tickInterval: ReturnType<typeof setInterval> | null = null;

  function startTicking() {
    stopTicking();
    tickInterval = setInterval(() => {
      const s = get(state);
      const now = Date.now();
      if (s.active && s.nextReminderAt > 0) {
        const remaining = Math.max(0, s.nextReminderAt - now);
        timeUntilReminder.set(remaining);
        if (remaining === 0) {
          reminderDue.set(true);
        }
      } else {
        timeUntilReminder.set(0);
      }
    }, 1000);
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
    timeUntilReminder: { subscribe: timeUntilReminder.subscribe },
    reminderDue: { subscribe: reminderDue.subscribe },

    async init() {
      try {
        const [s, c] = await Promise.all([
          invoke<HydrationState>('hydration_get_state'),
          invoke<HydrationConfig>('hydration_get_config')
        ]);
        state.set(s);
        config.set(c);
        if (s.active) startTicking();
      } catch (error) {
        console.error('Failed to initialize hydration:', error);
      }
    },

    async start() {
      try {
        const result = await invoke<HydrationState>('hydration_start');
        state.set(result);
        reminderDue.set(false);
        startTicking();
      } catch (error) {
        console.error('Failed to start hydration reminders:', error);
      }
    },

    async stop() {
      try {
        const result = await invoke<HydrationState>('hydration_stop');
        state.set(result);
        stopTicking();
        timeUntilReminder.set(0);
        reminderDue.set(false);
      } catch (error) {
        console.error('Failed to stop hydration reminders:', error);
      }
    },

    async logDrink() {
      try {
        const result = await invoke<HydrationState>('hydration_log_drink');
        state.set(result);
        reminderDue.set(false);
      } catch (error) {
        console.error('Failed to log drink:', error);
      }
    },

    async dismissReminder() {
      try {
        const result = await invoke<HydrationState>('hydration_dismiss_reminder');
        state.set(result);
        reminderDue.set(false);
      } catch (error) {
        console.error('Failed to dismiss reminder:', error);
      }
    },

    async updateConfig(newConfig: HydrationConfig) {
      try {
        const result = await invoke<HydrationConfig>('hydration_set_config', { newConfig });
        config.set(result);
      } catch (error) {
        console.error('Failed to update hydration config:', error);
      }
    },

    async resetToday() {
      try {
        const result = await invoke<HydrationState>('hydration_reset_today');
        state.set(result);
      } catch (error) {
        console.error('Failed to reset hydration stats:', error);
      }
    },

    cleanup() {
      stopTicking();
    }
  };
}

export const hydration = createHydrationStore();

export const hydrationActive = derived(
  { subscribe: hydration.subscribe },
  $state => $state.active
);

export const hydrationProgress = derived(
  { subscribe: hydration.subscribe },
  $state => {
    const config = get(hydration.config as any) as HydrationConfig;
    return config.dailyGoalGlasses > 0
      ? Math.min(1, $state.glassesToday / config.dailyGoalGlasses)
      : 0;
  }
);

export function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function formatMl(ml: number): string {
  if (ml >= 1000) {
    return `${(ml / 1000).toFixed(1)}L`;
  }
  return `${ml}ml`;
}

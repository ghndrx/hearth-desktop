import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface WorldClockEntry {
  id: string;
  label: string;
  timezone: string;
}

export interface WorldClockTime {
  id: string;
  label: string;
  timezone: string;
  hours: number;
  minutes: number;
  seconds: number;
  offsetHours: number;
  offsetMinutes: number;
  dayOfWeek: string;
  dateStr: string;
  isDst: boolean;
}

function createWorldClockStore() {
  const clocks = writable<WorldClockEntry[]>([]);
  const times = writable<WorldClockTime[]>([]);

  let tickInterval: ReturnType<typeof setInterval> | null = null;

  async function refreshTimes() {
    try {
      const result = await invoke<WorldClockTime[]>('worldclock_get_times');
      times.set(result);
    } catch (error) {
      console.error('Failed to refresh world clock times:', error);
    }
  }

  function startTicking() {
    stopTicking();
    refreshTimes();
    tickInterval = setInterval(refreshTimes, 1000);
  }

  function stopTicking() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  return {
    clocks: { subscribe: clocks.subscribe },
    times: { subscribe: times.subscribe },

    async init() {
      try {
        const entries = await invoke<WorldClockEntry[]>('worldclock_get_clocks');
        clocks.set(entries);
        startTicking();
      } catch (error) {
        console.error('Failed to initialize world clock:', error);
      }
    },

    async addClock(label: string, timezone: string) {
      try {
        const result = await invoke<WorldClockEntry[]>('worldclock_add_clock', { label, timezone });
        clocks.set(result);
        await refreshTimes();
      } catch (error) {
        console.error('Failed to add world clock:', error);
      }
    },

    async removeClock(id: string) {
      try {
        const result = await invoke<WorldClockEntry[]>('worldclock_remove_clock', { id });
        clocks.set(result);
        await refreshTimes();
      } catch (error) {
        console.error('Failed to remove world clock:', error);
      }
    },

    cleanup() {
      stopTicking();
    }
  };
}

export const worldClock = createWorldClockStore();

export function formatTime12h(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatTime24h(hours: number, minutes: number, seconds: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatOffset(offsetHours: number, offsetMinutes: number): string {
  const sign = offsetHours >= 0 ? '+' : '';
  if (offsetMinutes !== 0) {
    return `UTC${sign}${offsetHours}:${String(Math.abs(offsetMinutes)).padStart(2, '0')}`;
  }
  return `UTC${sign}${offsetHours}`;
}

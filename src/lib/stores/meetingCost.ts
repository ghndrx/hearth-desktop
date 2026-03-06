import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface MeetingCostConfig {
  defaultHourlyRate: number;
  currencySymbol: string;
  currencyCode: string;
}

export interface MeetingCostState {
  running: boolean;
  paused: boolean;
  startedAt: number;
  pausedAt: number;
  totalPausedMs: number;
  attendees: number;
  hourlyRate: number;
  elapsedMs: number;
  totalCost: number;
  meetingsToday: number;
  totalCostToday: number;
  totalTimeTodayMs: number;
}

const DEFAULT_STATE: MeetingCostState = {
  running: false,
  paused: false,
  startedAt: 0,
  pausedAt: 0,
  totalPausedMs: 0,
  attendees: 2,
  hourlyRate: 75,
  elapsedMs: 0,
  totalCost: 0,
  meetingsToday: 0,
  totalCostToday: 0,
  totalTimeTodayMs: 0
};

function createMeetingCostStore() {
  const state = writable<MeetingCostState>({ ...DEFAULT_STATE });
  const config = writable<MeetingCostConfig>({
    defaultHourlyRate: 75,
    currencySymbol: '$',
    currencyCode: 'USD'
  });

  let tickInterval: ReturnType<typeof setInterval> | null = null;

  function startTicking() {
    stopTicking();
    tickInterval = setInterval(() => {
      const s = get(state);
      if (s.running && !s.paused) {
        const now = Date.now();
        const elapsed = now - s.startedAt - s.totalPausedMs;
        const hours = elapsed / 3_600_000;
        const cost = hours * s.attendees * s.hourlyRate;
        state.update(st => ({ ...st, elapsedMs: elapsed, totalCost: cost }));
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

    async init() {
      try {
        const [s, c] = await Promise.all([
          invoke<MeetingCostState>('meeting_get_state'),
          invoke<MeetingCostConfig>('meeting_get_config')
        ]);
        state.set(s);
        config.set(c);
        if (s.running) startTicking();
      } catch (error) {
        console.error('Failed to initialize meeting cost:', error);
      }
    },

    async start(attendees: number, hourlyRate?: number) {
      try {
        const result = await invoke<MeetingCostState>('meeting_start', { attendees, hourlyRate });
        state.set(result);
        startTicking();
      } catch (error) {
        console.error('Failed to start meeting:', error);
      }
    },

    async stop() {
      try {
        const result = await invoke<MeetingCostState>('meeting_stop');
        state.set(result);
        stopTicking();
      } catch (error) {
        console.error('Failed to stop meeting:', error);
      }
    },

    async pause() {
      try {
        const result = await invoke<MeetingCostState>('meeting_pause');
        state.set(result);
        stopTicking();
      } catch (error) {
        console.error('Failed to pause meeting:', error);
      }
    },

    async resume() {
      try {
        const result = await invoke<MeetingCostState>('meeting_resume');
        state.set(result);
        startTicking();
      } catch (error) {
        console.error('Failed to resume meeting:', error);
      }
    },

    async updateAttendees(attendees: number) {
      try {
        const result = await invoke<MeetingCostState>('meeting_update_attendees', { attendees });
        state.set(result);
      } catch (error) {
        console.error('Failed to update attendees:', error);
      }
    },

    async updateConfig(newConfig: MeetingCostConfig) {
      try {
        const result = await invoke<MeetingCostConfig>('meeting_set_config', { newConfig });
        config.set(result);
      } catch (error) {
        console.error('Failed to update meeting config:', error);
      }
    },

    async resetDaily() {
      try {
        const result = await invoke<MeetingCostState>('meeting_reset_daily');
        state.set(result);
      } catch (error) {
        console.error('Failed to reset daily stats:', error);
      }
    },

    cleanup() {
      stopTicking();
    }
  };
}

export const meetingCost = createMeetingCostStore();

export const meetingRunning = derived(
  { subscribe: meetingCost.subscribe },
  $state => $state.running
);

export const meetingPaused = derived(
  { subscribe: meetingCost.subscribe },
  $state => $state.paused
);

export function formatCost(amount: number, symbol: string = '$'): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function costPerSecond(attendees: number, hourlyRate: number): number {
  return (attendees * hourlyRate) / 3600;
}

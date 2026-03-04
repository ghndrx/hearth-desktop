import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type PomodoroSessionType = 'work' | 'short-break' | 'long-break';

export interface PomodoroSettings {
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  pomodoros_before_long_break: number;
  auto_start_breaks: boolean;
  auto_start_work: boolean;
  sound_enabled: boolean;
  notifications_enabled: boolean;
}

export interface PomodoroState {
  session_type: PomodoroSessionType;
  time_remaining: number;
  is_running: boolean;
  completed_pomodoros: number;
  total_completed_today: number;
  streak: number;
}

export interface PomodoroTrayInfo {
  time_display: string;
  is_running: boolean;
  session_type: PomodoroSessionType;
}

// Default settings
const defaultSettings: PomodoroSettings = {
  work_duration: 25,
  short_break_duration: 5,
  long_break_duration: 15,
  pomodoros_before_long_break: 4,
  auto_start_breaks: false,
  auto_start_work: false,
  sound_enabled: true,
  notifications_enabled: true
};

// Default state
const defaultState: PomodoroState = {
  session_type: 'work',
  time_remaining: 25 * 60,
  is_running: false,
  completed_pomodoros: 0,
  total_completed_today: 0,
  streak: 0
};

// Stores
function createPomodoroStore() {
  const { subscribe, set, update } = writable<PomodoroState>(defaultState);
  const settingsStore = writable<PomodoroSettings>(defaultSettings);
  const tickUnlisten = writable<UnlistenFn | null>(null);
  const completedUnlisten = writable<UnlistenFn | null>(null);

  return {
    subscribe,
    settings: { subscribe: settingsStore.subscribe, set: settingsStore.set, update: settingsStore.update },
    
    // Initialize and load state from backend
    async init() {
      try {
        const state = await invoke<PomodoroState>('pomodoro_get_state');
        const settings = await invoke<PomodoroSettings>('pomodoro_get_settings');
        set(state);
        settingsStore.set(settings);
        
        // Listen for tick events from backend
        const unlistenTick = await listen<{ time_remaining: number; time_display: string; is_running: boolean; session_type: PomodoroSessionType }>(
          'pomodoro:tick',
          (event) => {
            update(s => ({
              ...s,
              time_remaining: event.payload.time_remaining,
              is_running: event.payload.is_running,
              session_type: event.payload.session_type
            }));
          }
        );
        tickUnlisten.set(unlistenTick);
        
        // Listen for completion events
        const unlistenCompleted = await listen<{
          completed_type: PomodoroSessionType;
          new_session_type: PomodoroSessionType;
          completed_pomodoros: number;
          total_completed_today: number;
        }>('pomodoro:completed', (event) => {
          update(s => ({
            ...s,
            session_type: event.payload.new_session_type,
            completed_pomodoros: event.payload.completed_pomodoros,
            total_completed_today: event.payload.total_completed_today,
            time_remaining: getSessionDuration(event.payload.new_session_type, get(settingsStore)) * 60,
            is_running: false
          }));
        });
        completedUnlisten.set(unlistenCompleted);
        
      } catch (error) {
        console.error('Failed to initialize pomodoro:', error);
      }
    },
    
    // Start the timer
    async start() {
      try {
        await invoke('pomodoro_start');
        update(s => ({ ...s, is_running: true }));
      } catch (error) {
        console.error('Failed to start pomodoro:', error);
      }
    },
    
    // Pause the timer
    async pause() {
      try {
        await invoke('pomodoro_pause');
        update(s => ({ ...s, is_running: false }));
      } catch (error) {
        console.error('Failed to pause pomodoro:', error);
      }
    },
    
    // Reset the current session
    async reset() {
      try {
        await invoke('pomodoro_reset');
        const settings = get(settingsStore);
        update(s => ({
          ...s,
          is_running: false,
          time_remaining: getSessionDuration(s.session_type, settings) * 60
        }));
      } catch (error) {
        console.error('Failed to reset pomodoro:', error);
      }
    },
    
    // Skip to next session
    async skip() {
      try {
        const newState = await invoke<PomodoroState>('pomodoro_skip');
        set(newState);
      } catch (error) {
        console.error('Failed to skip pomodoro session:', error);
      }
    },
    
    // Change session type
    async setSessionType(type: PomodoroSessionType) {
      try {
        await invoke('pomodoro_set_session', { sessionType: type });
        const settings = get(settingsStore);
        update(s => ({
          ...s,
          session_type: type,
          time_remaining: getSessionDuration(type, settings) * 60,
          is_running: false
        }));
      } catch (error) {
        console.error('Failed to set pomodoro session:', error);
      }
    },
    
    // Update settings
    async updateSettings(newSettings: PomodoroSettings) {
      try {
        await invoke('pomodoro_update_settings', { settings: newSettings });
        settingsStore.set(newSettings);
      } catch (error) {
        console.error('Failed to update pomodoro settings:', error);
      }
    },
    
    // Save current state
    async save() {
      try {
        await invoke('pomodoro_save_state');
      } catch (error) {
        console.error('Failed to save pomodoro state:', error);
      }
    },
    
    // Get tray info
    async getTrayInfo(): Promise<PomodoroTrayInfo | null> {
      try {
        return await invoke<PomodoroTrayInfo>('pomodoro_get_tray_info');
      } catch (error) {
        console.error('Failed to get pomodoro tray info:', error);
        return null;
      }
    },
    
    // Cleanup listeners
    cleanup() {
      const tickCleanup = get(tickUnlisten);
      const completedCleanup = get(completedUnlisten);
      if (tickCleanup) tickCleanup();
      if (completedCleanup) completedCleanup();
    }
  };
}

// Helper function to get session duration
function getSessionDuration(type: PomodoroSessionType, settings: PomodoroSettings): number {
  switch (type) {
    case 'work': return settings.work_duration;
    case 'short-break': return settings.short_break_duration;
    case 'long-break': return settings.long_break_duration;
    default: return 25;
  }
}

// Create the store instance
export const pomodoro = createPomodoroStore();

// Derived stores for convenience
export const pomodoroFormattedTime = derived(pomodoro, $state => {
  const minutes = Math.floor($state.time_remaining / 60);
  const seconds = $state.time_remaining % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

export const pomodoroProgress = derived([pomodoro, pomodoro.settings], ([$state, $settings]) => {
  const totalSeconds = getSessionDuration($state.session_type, $settings) * 60;
  return ((totalSeconds - $state.time_remaining) / totalSeconds) * 100;
});

export const pomodoroSessionLabel = derived(pomodoro, $state => {
  switch ($state.session_type) {
    case 'work': return 'Focus Time';
    case 'short-break': return 'Short Break';
    case 'long-break': return 'Long Break';
  }
});

export const pomodoroSessionColor = derived(pomodoro, $state => {
  switch ($state.session_type) {
    case 'work': return '#ef4444'; // red-500
    case 'short-break': return '#22c55e'; // green-500
    case 'long-break': return '#3b82f6'; // blue-500
  }
});

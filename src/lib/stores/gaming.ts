import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { DetectedGame, GameEntry } from '../gaming/types';
import * as gamingApi from '../gaming/api';

export interface GamingState {
  currentGame: DetectedGame | null;
  runningGames: DetectedGame[];
  supportedGames: GameEntry[];
  isScanning: boolean;
  scanInterval: number; // in seconds
  lastScanTime: number | null;
  error: string | null;
  settings: {
    autoScan: boolean;
    scanFrequency: number; // in seconds
    hideSystemApps: boolean;
    showNotifications: boolean;
  };
}

const initialGamingState: GamingState = {
  currentGame: null,
  runningGames: [],
  supportedGames: [],
  isScanning: false,
  scanInterval: 10, // scan every 10 seconds
  lastScanTime: null,
  error: null,
  settings: {
    autoScan: true,
    scanFrequency: 10,
    hideSystemApps: true,
    showNotifications: true,
  },
};

function createGamingStore() {
  const { subscribe, set, update } = writable<GamingState>(initialGamingState);
  let scanIntervalId: ReturnType<typeof setInterval> | null = null;

  const startScanning = () => {
    update(state => ({ ...state, isScanning: true }));

    if (scanIntervalId) {
      clearInterval(scanIntervalId);
    }

    // Initial scan
    scanForGames();

    // Set up interval scanning
    scanIntervalId = setInterval(() => {
      scanForGames();
    }, initialGamingState.scanInterval * 1000);
  };

  const stopScanning = () => {
    if (scanIntervalId) {
      clearInterval(scanIntervalId);
      scanIntervalId = null;
    }
    update(state => ({ ...state, isScanning: false }));
  };

  const scanForGames = async () => {
    try {
      const [currentGame, runningGames] = await Promise.all([
        gamingApi.detectRunningGame(),
        gamingApi.getRunningGames(),
      ]);

      update(state => {
        const newState = {
          ...state,
          currentGame,
          runningGames,
          lastScanTime: Date.now(),
          error: null,
        };

        // Check if the current game changed for notifications
        if (
          state.settings.showNotifications &&
          browser &&
          state.currentGame?.id !== currentGame?.id &&
          currentGame
        ) {
          // Trigger game change notification (could integrate with app notifications)
          console.log(`[Gaming] Now playing: ${currentGame.name}`);
        }

        return newState;
      });
    } catch (error) {
      update(state => ({
        ...state,
        error: error instanceof Error ? error.message : 'Failed to scan for games',
        lastScanTime: Date.now(),
      }));
    }
  };

  return {
    subscribe,

    // Game scanning
    startScanning,
    stopScanning,
    scanOnce: scanForGames,

    // Game data
    setCurrentGame: (game: DetectedGame | null) =>
      update(state => ({ ...state, currentGame: game })),

    setRunningGames: (games: DetectedGame[]) =>
      update(state => ({ ...state, runningGames: games })),

    setSupportedGames: (games: GameEntry[]) =>
      update(state => ({ ...state, supportedGames: games })),

    // Settings
    updateSettings: (settings: Partial<GamingState['settings']>) =>
      update(state => {
        const newSettings = { ...state.settings, ...settings };

        // Save to localStorage
        if (browser) {
          localStorage.setItem('hearth_gaming_settings', JSON.stringify(newSettings));
        }

        // Update scan frequency if changed
        if (newSettings.scanFrequency !== state.settings.scanFrequency) {
          if (state.isScanning) {
            stopScanning();
            setTimeout(() => startScanning(), 100);
          }
        }

        return { ...state, settings: newSettings };
      }),

    // Error handling
    setError: (error: string) =>
      update(state => ({ ...state, error })),

    clearError: () =>
      update(state => ({ ...state, error: null })),

    // Initialize
    init: async () => {
      if (!browser) return;

      // Load saved settings
      const saved = localStorage.getItem('hearth_gaming_settings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          update(state => ({ ...state, settings: { ...state.settings, ...settings } }));
        } catch (e) {
          console.warn('[Gaming] Failed to load settings:', e);
        }
      }

      try {
        // Load supported games
        const supportedGames = await gamingApi.getSupportedGames();
        update(state => ({ ...state, supportedGames }));

        // Start auto-scanning if enabled
        const currentState = await new Promise<GamingState>(resolve => {
          const unsubscribe = subscribe(state => {
            resolve(state);
            unsubscribe();
          });
        });

        if (currentState.settings.autoScan) {
          startScanning();
        }
      } catch (error) {
        update(state => ({
          ...state,
          error: error instanceof Error ? error.message : 'Failed to initialize gaming system',
        }));
      }
    },

    // Cleanup
    destroy: () => {
      stopScanning();
    },
  };
}

// Store instance
export const gamingState = createGamingStore();

// Action helpers
export const gamingActions = {
  init: gamingState.init,
  destroy: gamingState.destroy,
  startScanning: gamingState.startScanning,
  stopScanning: gamingState.stopScanning,
  scanOnce: gamingState.scanOnce,
  setCurrentGame: gamingState.setCurrentGame,
  setRunningGames: gamingState.setRunningGames,
  setSupportedGames: gamingState.setSupportedGames,
  updateSettings: gamingState.updateSettings,
  setError: gamingState.setError,
  clearError: gamingState.clearError,
};

// Derived stores for convenience
export const currentGame = derived(gamingState, $state => $state.currentGame);
export const runningGames = derived(gamingState, $state => $state.runningGames);
export const supportedGames = derived(gamingState, $state => $state.supportedGames);
export const isGamingActive = derived(gamingState, $state => $state.currentGame !== null);
export const gamingError = derived(gamingState, $state => $state.error);
export const isScanning = derived(gamingState, $state => $state.isScanning);
export const lastScanTime = derived(gamingState, $state => $state.lastScanTime);

// Filtered running games (exclude system/communication apps if setting is enabled)
export const visibleRunningGames = derived(
  gamingState,
  $state => {
    if (!$state.settings.hideSystemApps) {
      return $state.runningGames;
    }

    return $state.runningGames.filter(game => !gamingApi.isCommunicationApp(game));
  }
);

// Current game display name
export const currentGameDisplayName = derived(
  currentGame,
  $game => $game ? gamingApi.formatGameName($game) : null
);
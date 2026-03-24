import { writable } from 'svelte/store';

export type GamePlatform = 'Steam' | 'Epic Games Store' | 'Battle.net';

export interface DetectedGame {
  app_id: string;
  name: string;
  process_name: string;
  is_running: boolean;
  last_detected: number;
  total_playtime_seconds: number;
  platform?: GamePlatform;
}

export interface GameState {
  runningGames: DetectedGame[];
  library: DetectedGame[];
  isDetectionActive: boolean;
  lastUpdateTime: number;
}

const initialState: GameState = {
  runningGames: [],
  library: [],
  isDetectionActive: false,
  lastUpdateTime: 0,
};

function createGameStore() {
  const { subscribe, set, update } = writable<GameState>(initialState);

  return {
    subscribe,

    // Update the list of currently running games
    updateRunningGames: (games: DetectedGame[]) => {
      update(state => {
        const runningGames = games.filter(game => game.is_running);

        // Update library with latest information
        const updatedLibrary = [...state.library];

        games.forEach(detectedGame => {
          const existingIndex = updatedLibrary.findIndex(g => g.app_id === detectedGame.app_id);
          if (existingIndex >= 0) {
            updatedLibrary[existingIndex] = detectedGame;
          } else {
            updatedLibrary.push(detectedGame);
          }
        });

        // Sort library by last detected time (most recent first)
        updatedLibrary.sort((a, b) => b.last_detected - a.last_detected);

        return {
          ...state,
          runningGames,
          library: updatedLibrary,
          isDetectionActive: true,
          lastUpdateTime: Date.now(),
        };
      });
    },

    // Update the full game library
    updateLibrary: (library: DetectedGame[]) => {
      update(state => ({
        ...state,
        library: library.sort((a, b) => b.last_detected - a.last_detected),
      }));
    },

    // Set detection status
    setDetectionStatus: (active: boolean) => {
      update(state => ({
        ...state,
        isDetectionActive: active,
      }));
    },

    // Get running games
    getRunningGames: (): DetectedGame[] => {
      let currentState: GameState;
      subscribe(state => currentState = state)();
      return currentState!.runningGames;
    },

    // Get all games in library
    getLibrary: (): DetectedGame[] => {
      let currentState: GameState;
      subscribe(state => currentState = state)();
      return currentState!.library;
    },

    // Find a specific game by app_id
    findGame: (appId: string): DetectedGame | undefined => {
      let currentState: GameState;
      subscribe(state => currentState = state)();
      return currentState!.library.find(game => game.app_id === appId);
    },

    // Get statistics
    getStats: () => {
      let currentState: GameState;
      subscribe(state => currentState = state)();

      const totalGames = currentState!.library.length;
      const runningGames = currentState!.runningGames.length;
      const totalPlaytime = currentState!.library.reduce(
        (total, game) => total + game.total_playtime_seconds,
        0
      );
      const recentlyPlayed = currentState!.library.filter(
        game => game.last_detected > 0 &&
        (Date.now() / 1000 - game.last_detected) < (24 * 60 * 60) // Last 24 hours
      ).length;

      return {
        totalGames,
        runningGames,
        totalPlaytime,
        recentlyPlayed,
        lastUpdate: currentState!.lastUpdateTime,
      };
    },

    // Reset the store
    reset: () => {
      set(initialState);
    },
  };
}

export const gameStore = createGameStore();
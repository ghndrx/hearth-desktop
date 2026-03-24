<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/tauri';
  import { listen } from '@tauri-apps/api/event';
  import { gameStore } from '$lib/stores/gameStore';

  interface DetectedGame {
    app_id: string;
    name: string;
    process_name: string;
    is_running: boolean;
    last_detected: number;
    total_playtime_seconds: number;
  }

  let isScanning = false;
  let lastScanTime: string | null = null;
  let error: string | null = null;
  let unlisten: (() => void) | null = null;

  // Subscribe to the game store
  $: runningGames = $gameStore.runningGames;
  $: gameLibrary = $gameStore.library;

  onMount(async () => {
    try {
      // Start game detection
      await invoke('start_detection');
      isScanning = true;

      // Listen for game detection events
      unlisten = await listen('games-detected', (event) => {
        const detectedGames = event.payload as DetectedGame[];
        gameStore.updateRunningGames(detectedGames);
        updateLastScanTime();
      });

      // Load initial game library
      await loadGameLibrary();

    } catch (e) {
      console.error('Failed to start game detection:', e);
      error = `Failed to start game detection: ${e}`;
    }
  });

  onDestroy(async () => {
    try {
      if (unlisten) {
        unlisten();
      }
      await invoke('stop_detection');
      isScanning = false;
    } catch (e) {
      console.error('Failed to stop game detection:', e);
    }
  });

  async function loadGameLibrary() {
    try {
      const library = await invoke('get_game_library') as DetectedGame[];
      gameStore.updateLibrary(library);
    } catch (e) {
      console.error('Failed to load game library:', e);
    }
  }

  function updateLastScanTime() {
    lastScanTime = new Date().toLocaleTimeString();
  }

  function formatPlaytime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m`;
    } else {
      return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    }
  }

  function formatLastSeen(timestamp: number): string {
    if (timestamp === 0) return 'Never';

    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  }

  async function launchGame(appId: string) {
    try {
      await invoke('launch_game', { appId });
    } catch (e) {
      console.error('Failed to launch game:', e);
      error = `Failed to launch game: ${e}`;
      setTimeout(() => error = null, 3000);
    }
  }
</script>

<div class="game-detection-status bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
      <svg class="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
      Game Detection
    </h2>

    <div class="flex items-center space-x-2">
      {#if isScanning}
        <div class="flex items-center text-green-600">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
          <span class="text-sm">Scanning</span>
        </div>
      {:else}
        <div class="flex items-center text-gray-500">
          <div class="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
          <span class="text-sm">Stopped</span>
        </div>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
      {error}
    </div>
  {/if}

  {#if lastScanTime}
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
      Last scan: {lastScanTime}
    </p>
  {/if}

  <!-- Currently Running Games -->
  <div class="mb-6">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Currently Running</h3>
    {#if runningGames.length > 0}
      <div class="space-y-2">
        {#each runningGames as game}
          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{game.name}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">{game.process_name}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {formatPlaytime(game.total_playtime_seconds)}
              </p>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-gray-600 dark:text-gray-400 text-center py-4">
        No games currently running
      </p>
    {/if}
  </div>

  <!-- Game Library -->
  <div>
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Detected Games</h3>
    {#if gameLibrary.length > 0}
      <div class="space-y-2">
        {#each gameLibrary as game}
          <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <div class="flex items-center">
              <div class="w-3 h-3 {game.is_running ? 'bg-green-500' : 'bg-gray-400'} rounded-full mr-3"></div>
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{game.name}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Last seen: {formatLastSeen(game.last_detected)}
                </p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <div class="text-right">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {formatPlaytime(game.total_playtime_seconds)}
                </p>
              </div>
              <button
                on:click={() => launchGame(game.app_id)}
                class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                title="Launch via Steam"
              >
                Launch
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-gray-600 dark:text-gray-400 text-center py-4">
        No games detected yet
      </p>
    {/if}
  </div>
</div>

<style>
  /* Add any custom styles here */
</style>
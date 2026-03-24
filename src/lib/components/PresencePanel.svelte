<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { richPresenceStore } from '$lib/stores/richPresence';
  import type { FriendPresence } from '$lib/stores/richPresence';
  import RichPresenceCard from './RichPresenceCard.svelte';

  const { currentPresence, friendPresences, broadcastingEnabled } = richPresenceStore;

  let cleanupListeners: (() => void) | null = null;
  let error: string | null = null;

  $: broadcasting = $broadcastingEnabled;

  $: friendList = Array.from($friendPresences.values()) as FriendPresence[];
  $: onlineFriends = friendList.filter(f => f.is_online);
  $: playingFriends = friendList.filter(f => f.presence !== null);

  onMount(async () => {
    try {
      cleanupListeners = await richPresenceStore.initListeners();
      await richPresenceStore.fetchCurrentPresence();
      await richPresenceStore.fetchAllFriendPresences();
    } catch (e) {
      console.error('Failed to initialize presence panel:', e);
      error = `Failed to initialize: ${e}`;
    }
  });

  onDestroy(() => {
    if (cleanupListeners) {
      cleanupListeners();
    }
  });

  async function toggleBroadcasting() {
    const current = broadcasting;
    await richPresenceStore.setBroadcasting(!current);
  }

  async function handleClearPresence() {
    await richPresenceStore.clearPresence();
  }
</script>

<div class="presence-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
      <svg class="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
      </svg>
      Rich Presence
    </h2>

    <label class="flex items-center gap-2 cursor-pointer">
      <span class="text-sm text-gray-600 dark:text-gray-400">Broadcast</span>
      <button
        on:click={toggleBroadcasting}
        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
        class:bg-blue-500={broadcasting}
        class:bg-gray-300={!broadcasting}
        role="switch"
        aria-checked={broadcasting}
        aria-label="Toggle presence broadcasting"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
          class:translate-x-6={broadcasting}
          class:translate-x-1={!broadcasting}
        ></span>
      </button>
    </label>
  </div>

  {#if error}
    <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
      {error}
    </div>
  {/if}

  <!-- Current Presence -->
  <div class="mb-6">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Your Presence</h3>
    {#if $currentPresence}
      <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <p class="font-medium text-gray-900 dark:text-white">
          Playing {$currentPresence.game_name}
        </p>
        {#if $currentPresence.details}
          <p class="text-sm text-gray-600 dark:text-gray-400">{$currentPresence.details}</p>
        {/if}
        {#if $currentPresence.state && $currentPresence.state !== 'Playing'}
          <p class="text-sm text-gray-500 dark:text-gray-400">{$currentPresence.state}</p>
        {/if}
        {#if $currentPresence.party_info}
          <p class="text-sm text-gray-400">
            Party: {$currentPresence.party_info.party_size}/{$currentPresence.party_info.party_max}
          </p>
        {/if}
        <button
          on:click={handleClearPresence}
          class="mt-2 px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
        >
          Clear Presence
        </button>
      </div>
    {:else}
      <p class="text-gray-600 dark:text-gray-400 text-center py-4">
        No game activity
      </p>
    {/if}
  </div>

  <!-- Friends Playing -->
  <div class="mb-6">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">
      Friends Playing
      {#if playingFriends.length > 0}
        <span class="text-sm font-normal text-gray-500">({playingFriends.length})</span>
      {/if}
    </h3>
    {#if playingFriends.length > 0}
      <div class="space-y-2">
        {#each playingFriends as friend (friend.friend_id)}
          <RichPresenceCard friendPresence={friend} />
        {/each}
      </div>
    {:else}
      <p class="text-gray-600 dark:text-gray-400 text-center py-4">
        No friends currently playing
      </p>
    {/if}
  </div>

  <!-- Online Friends -->
  {#if onlineFriends.length > 0}
    <div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">
        Online
        <span class="text-sm font-normal text-gray-500">({onlineFriends.length})</span>
      </h3>
      <div class="space-y-2">
        {#each onlineFriends.filter(f => !f.presence) as friend (friend.friend_id)}
          <RichPresenceCard friendPresence={friend} showActions={false} />
        {/each}
      </div>
    </div>
  {/if}
</div>

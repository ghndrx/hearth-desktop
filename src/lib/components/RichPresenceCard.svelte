<script lang="ts">
  import type { GamePresenceState, FriendPresence } from '$lib/stores/richPresence';
  import { richPresenceStore } from '$lib/stores/richPresence';

  export let friendPresence: FriendPresence;
  export let showActions: boolean = true;

  $: presence = friendPresence.presence;
  $: isOnline = friendPresence.is_online;

  function formatTimestamp(timestamp: number): string {
    if (!timestamp) return '';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function handleJoin() {
    if (presence?.party_info) {
      richPresenceStore.joinGame(presence.game_id, presence.party_info.party_id);
    } else if (presence) {
      richPresenceStore.joinGame(presence.game_id);
    }
  }

  function handleSpectate() {
    if (presence) {
      richPresenceStore.spectateGame(presence.game_id);
    }
  }
</script>

<div class="rich-presence-card p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
  <div class="flex items-center gap-3">
    <div class="relative flex-shrink-0">
      <div class="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
        {friendPresence.friend_id.slice(0, 2).toUpperCase()}
      </div>
      <div
        class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-50 dark:border-gray-700"
        class:bg-green-500={isOnline && presence}
        class:bg-yellow-500={isOnline && !presence}
        class:bg-gray-400={!isOnline}
      ></div>
    </div>

    <div class="flex-1 min-w-0">
      <p class="font-medium text-sm text-gray-900 dark:text-white truncate">
        {friendPresence.friend_id}
      </p>

      {#if presence}
        <p class="text-xs text-green-600 dark:text-green-400 truncate">
          Playing {presence.game_name}
        </p>
        {#if presence.details}
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{presence.details}</p>
        {/if}
        {#if presence.state && presence.state !== 'Playing'}
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{presence.state}</p>
        {/if}
        {#if presence.party_info}
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Party {presence.party_info.party_size}/{presence.party_info.party_max}
          </p>
        {/if}
        {#if presence.timestamp}
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {formatTimestamp(presence.timestamp)}
          </p>
        {/if}
      {:else if isOnline}
        <p class="text-xs text-gray-500 dark:text-gray-400">Online</p>
      {:else}
        <p class="text-xs text-gray-500 dark:text-gray-400">Offline</p>
      {/if}
    </div>

    {#if showActions && presence}
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button
          on:click={handleJoin}
          class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          title="Join game"
        >
          Join
        </button>
        <button
          on:click={handleSpectate}
          class="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
          title="Spectate game"
        >
          Watch
        </button>
      </div>
    {/if}
  </div>
</div>

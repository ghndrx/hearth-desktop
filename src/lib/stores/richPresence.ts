import { writable, derived, get } from 'svelte/store';

export type GamePlatform = 'Steam' | 'Epic Games Store' | 'Battle.net';

export interface PartyInfo {
  party_id: string;
  party_size: number;
  party_max: number;
}

export interface GamePresenceState {
  game_id: string;
  game_name: string;
  state: string;
  details: string;
  timestamp: number;
  party_info: PartyInfo | null;
  metadata: Record<string, string> | null;
  platform?: GamePlatform;
}

export interface FriendPresence {
  friend_id: string;
  presence: GamePresenceState | null;
  is_online: boolean;
}

function createRichPresenceStore() {
  const currentPresence = writable<GamePresenceState | null>(null);
  const friendPresences = writable<Map<string, FriendPresence>>(new Map());
  const broadcastingEnabled = writable<boolean>(false);

  async function updatePresence(state: GamePresenceState): Promise<GamePresenceState | null> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const updated = await invoke<GamePresenceState>('update_presence', { state });
      currentPresence.set(updated);
      return updated;
    } catch (e) {
      console.error('Failed to update presence:', e);
      return null;
    }
  }

  async function clearPresence(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('clear_presence');
      currentPresence.set(null);
    } catch (e) {
      console.error('Failed to clear presence:', e);
    }
  }

  async function fetchCurrentPresence(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const presence = await invoke<GamePresenceState | null>('get_current_presence');
      currentPresence.set(presence);
    } catch (e) {
      console.error('Failed to fetch current presence:', e);
    }
  }

  async function fetchFriendPresence(friendId: string): Promise<FriendPresence | null> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const friend = await invoke<FriendPresence>('get_friend_presence', { friendId });
      friendPresences.update(map => {
        map.set(friendId, friend);
        return new Map(map);
      });
      return friend;
    } catch (e) {
      console.error('Failed to fetch friend presence:', e);
      return null;
    }
  }

  async function fetchAllFriendPresences(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const friends = await invoke<FriendPresence[]>('get_all_friend_presences');
      friendPresences.update(map => {
        for (const friend of friends) {
          map.set(friend.friend_id, friend);
        }
        return new Map(map);
      });
    } catch (e) {
      console.error('Failed to fetch friend presences:', e);
    }
  }

  async function joinGame(gameId: string, partyId?: string): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('join_game', { gameId, partyId: partyId ?? null });
    } catch (e) {
      console.error('Failed to join game:', e);
    }
  }

  async function spectateGame(gameId: string): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('spectate_game', { gameId });
    } catch (e) {
      console.error('Failed to spectate game:', e);
    }
  }

  async function setBroadcasting(enabled: boolean): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_presence_broadcasting', { enabled });
      broadcastingEnabled.set(enabled);
    } catch (e) {
      console.error('Failed to set broadcasting:', e);
    }
  }

  async function initListeners(): Promise<() => void> {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisteners: Array<() => void> = [];

    const unlisten1 = await listen<GamePresenceState | null>('presence-updated', (event) => {
      currentPresence.set(event.payload);
    });
    unlisteners.push(unlisten1);

    const unlisten2 = await listen<{ game_id: string; party_id?: string }>('game-joined', (event) => {
      console.log('Game joined:', event.payload);
    });
    unlisteners.push(unlisten2);

    const unlisten3 = await listen<{ game_id: string }>('game-spectated', (event) => {
      console.log('Game spectated:', event.payload);
    });
    unlisteners.push(unlisten3);

    return () => {
      unlisteners.forEach(fn => fn());
    };
  }

  return {
    currentPresence: { subscribe: currentPresence.subscribe },
    friendPresences: { subscribe: friendPresences.subscribe },
    broadcastingEnabled: { subscribe: broadcastingEnabled.subscribe },
    updatePresence,
    clearPresence,
    fetchCurrentPresence,
    fetchFriendPresence,
    fetchAllFriendPresences,
    joinGame,
    spectateGame,
    setBroadcasting,
    initListeners,
  };
}

export const richPresenceStore = createRichPresenceStore();

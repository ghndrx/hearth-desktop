import { writable, derived } from 'svelte/store';
import { api } from '$lib/api';

export interface PopoutUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  pronouns: string | null;
  bot: boolean;
  created_at: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
}

export interface PopoutMember {
  nickname: string | null;
  joined_at: string;
  roles: {
    id: string;
    name: string;
    color: string;
  }[];
}

export interface SharedChannel {
  id: string;
  name: string;
  server_id: string;
  server_name: string;
  server_icon: string | null;
}

export interface RecentActivity {
  last_message_at: string | null;
  server_name: string | null;
  channel_name: string | null;
  message_count_24h: number;
}

export interface PopoutState {
  isOpen: boolean;
  user: PopoutUser | null;
  member: PopoutMember | null;
  position: { x: number; y: number } | null;
  anchor: 'left' | 'right' | 'bottom';
  mutualServers: { id: string; name: string; icon: string | null }[];
  mutualFriends: { id: string; username: string; avatar: string | null }[];
  sharedChannels: SharedChannel[];
  recentActivity: RecentActivity | null;
  totalMutual: {
    servers: number;
    channels: number;
    friends: number;
  };
  loading: boolean;
}

const initialState: PopoutState = {
  isOpen: false,
  user: null,
  member: null,
  position: null,
  anchor: 'right',
  mutualServers: [],
  mutualFriends: [],
  sharedChannels: [],
  recentActivity: null,
  totalMutual: { servers: 0, channels: 0, friends: 0 },
  loading: false,
};

// Backend response type for user profile
interface UserProfileResponse {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar_url: string | null;
    banner_url: string | null;
    bio: string | null;
    flags: number;
    created_at: string;
  };
  mutual_servers: { id: string; name: string; icon_url: string | null }[];
  shared_channels: SharedChannel[];
  mutual_friends: { id: string; username: string; avatar_url: string | null }[];
  recent_activity: RecentActivity | null;
  total_mutual: {
    servers: number;
    channels: number;
    friends: number;
  };
}

function createPopoutStore() {
  const { subscribe, set, update } = writable<PopoutState>(initialState);

  async function fetchUserProfile(userId: string) {
    update((state) => ({ ...state, loading: true }));
    
    try {
      const data = await api.get<UserProfileResponse>(`/users/${userId}/profile`);
      
      update((state) => ({
        ...state,
        mutualServers: data.mutual_servers.map((s) => ({
          id: s.id,
          name: s.name,
          icon: s.icon_url,
        })),
        sharedChannels: data.shared_channels || [],
        mutualFriends: data.mutual_friends.map((f) => ({
          id: f.id,
          username: f.username,
          avatar: f.avatar_url,
        })),
        recentActivity: data.recent_activity,
        totalMutual: data.total_mutual || { servers: 0, channels: 0, friends: 0 },
        loading: false,
      }));
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      update((state) => ({ ...state, loading: false }));
    }
  }

  return {
    subscribe,

    /**
     * Open the user popout at a specific position
     */
    open(options: {
      user: PopoutUser;
      member?: PopoutMember | null;
      position?: { x: number; y: number };
      anchor?: 'left' | 'right' | 'bottom';
      mutualServers?: { id: string; name: string; icon: string | null }[];
      mutualFriends?: { id: string; username: string; avatar: string | null }[];
    }) {
      set({
        isOpen: true,
        user: options.user,
        member: options.member ?? null,
        position: options.position ?? null,
        anchor: options.anchor ?? 'right',
        mutualServers: options.mutualServers ?? [],
        mutualFriends: options.mutualFriends ?? [],
        sharedChannels: [],
        recentActivity: null,
        totalMutual: { servers: 0, channels: 0, friends: 0 },
        loading: true,
      });

      // Fetch enhanced profile data asynchronously
      if (options.user?.id) {
        fetchUserProfile(options.user.id);
      }
    },

    /**
     * Close the user popout
     */
    close() {
      update((state) => ({
        ...state,
        isOpen: false,
      }));
    },

    /**
     * Update popout data (e.g., after fetching more info)
     */
    updateData(data: Partial<PopoutState>) {
      update((state) => ({
        ...state,
        ...data,
      }));
    },

    /**
     * Reset to initial state
     */
    reset() {
      set(initialState);
    },
  };
}

export const popoutStore = createPopoutStore();

// Derived store for checking if popout is open
export const isPopoutOpen = derived(popoutStore, ($popout) => $popout.isOpen);

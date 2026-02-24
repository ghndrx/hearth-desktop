import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { popoutStore } from './popout';

// Mock the api module
vi.mock('$lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '$lib/api';

describe('popoutStore', () => {
  beforeEach(() => {
    popoutStore.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct initial state', () => {
    const state = get(popoutStore);
    
    expect(state.isOpen).toBe(false);
    expect(state.user).toBeNull();
    expect(state.member).toBeNull();
    expect(state.mutualServers).toEqual([]);
    expect(state.sharedChannels).toEqual([]);
    expect(state.mutualFriends).toEqual([]);
    expect(state.recentActivity).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('should open with user data and start loading', async () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      display_name: 'Test User',
      avatar: null,
      banner: null,
      bio: null,
      pronouns: null,
      bot: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    // Mock the profile API response
    const mockProfile = {
      user: {
        id: '123',
        username: 'testuser',
        discriminator: '0001',
        avatar_url: null,
        banner_url: null,
        bio: null,
        flags: 0,
        created_at: '2024-01-01T00:00:00Z',
      },
      mutual_servers: [
        { id: 'server1', name: 'Server 1', icon_url: null },
        { id: 'server2', name: 'Server 2', icon_url: 'https://example.com/icon.png' },
      ],
      shared_channels: [
        { id: 'channel1', name: 'general', server_id: 'server1', server_name: 'Server 1', server_icon: null },
      ],
      mutual_friends: [
        { id: 'friend1', username: 'friend1', avatar_url: null },
      ],
      recent_activity: {
        last_message_at: '2024-01-15T12:00:00Z',
        server_name: 'Server 1',
        channel_name: 'general',
        message_count_24h: 5,
      },
      total_mutual: {
        servers: 2,
        channels: 3,
        friends: 1,
      },
    };

    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockProfile);

    popoutStore.open({
      user: mockUser,
      position: { x: 100, y: 200 },
    });

    // Check immediate state
    let state = get(popoutStore);
    expect(state.isOpen).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.loading).toBe(true);
    expect(state.position).toEqual({ x: 100, y: 200 });

    // Wait for the profile fetch to complete
    await vi.waitFor(() => {
      const currentState = get(popoutStore);
      return currentState.loading === false;
    });

    // Check state after fetch
    state = get(popoutStore);
    expect(state.loading).toBe(false);
    expect(state.mutualServers).toHaveLength(2);
    expect(state.mutualServers[0].name).toBe('Server 1');
    expect(state.sharedChannels).toHaveLength(1);
    expect(state.sharedChannels[0].name).toBe('general');
    expect(state.mutualFriends).toHaveLength(1);
    expect(state.recentActivity).not.toBeNull();
    expect(state.recentActivity?.message_count_24h).toBe(5);
    expect(state.totalMutual.servers).toBe(2);
    expect(state.totalMutual.channels).toBe(3);
    expect(state.totalMutual.friends).toBe(1);
  });

  it('should close the popout', () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      display_name: null,
      avatar: null,
      banner: null,
      bio: null,
      pronouns: null,
      bot: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: mockUser,
      mutual_servers: [],
      shared_channels: [],
      mutual_friends: [],
      recent_activity: null,
      total_mutual: { servers: 0, channels: 0, friends: 0 },
    });

    popoutStore.open({ user: mockUser });
    expect(get(popoutStore).isOpen).toBe(true);

    popoutStore.close();
    expect(get(popoutStore).isOpen).toBe(false);
  });

  it('should handle API errors gracefully', async () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      display_name: null,
      avatar: null,
      banner: null,
      bio: null,
      pronouns: null,
      bot: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    popoutStore.open({ user: mockUser });

    // Wait for the error to be handled
    await vi.waitFor(() => {
      const currentState = get(popoutStore);
      return currentState.loading === false;
    });

    const state = get(popoutStore);
    expect(state.isOpen).toBe(true);
    expect(state.loading).toBe(false);
    // Should still have the basic user data
    expect(state.user).toEqual(mockUser);
    // But no profile data
    expect(state.mutualServers).toEqual([]);
    
    consoleSpy.mockRestore();
  });

  it('should reset to initial state', () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      display_name: null,
      avatar: null,
      banner: null,
      bio: null,
      pronouns: null,
      bot: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: mockUser,
      mutual_servers: [],
      shared_channels: [],
      mutual_friends: [],
      recent_activity: null,
      total_mutual: { servers: 0, channels: 0, friends: 0 },
    });

    popoutStore.open({ user: mockUser });
    popoutStore.reset();

    const state = get(popoutStore);
    expect(state.isOpen).toBe(false);
    expect(state.user).toBeNull();
    expect(state.mutualServers).toEqual([]);
  });

  it('should include member data when provided', async () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      display_name: null,
      avatar: null,
      banner: null,
      bio: null,
      pronouns: null,
      bot: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockMember = {
      nickname: 'Tester',
      joined_at: '2024-01-10T00:00:00Z',
      roles: [
        { id: 'role1', name: 'Admin', color: '#ff0000' },
      ],
    };

    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: mockUser,
      mutual_servers: [],
      shared_channels: [],
      mutual_friends: [],
      recent_activity: null,
      total_mutual: { servers: 0, channels: 0, friends: 0 },
    });

    popoutStore.open({ user: mockUser, member: mockMember });

    const state = get(popoutStore);
    expect(state.member).toEqual(mockMember);
    expect(state.member?.nickname).toBe('Tester');
    expect(state.member?.roles).toHaveLength(1);
  });
});

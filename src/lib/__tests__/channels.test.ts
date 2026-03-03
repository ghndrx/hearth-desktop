/**
 * Tests for channels store
 * 
 * Tests channel management including loading server channels, DM channels,
 * creating, updating, and deleting channels.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get, writable } from 'svelte/store';

// Unmock channels store - we want to test the real implementation
vi.unmock('$lib/stores/channels');

// Mock API
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn()
};

// Mock ApiError class
class MockApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

vi.mock('$lib/api', () => ({
  api: mockApi,
  ApiError: MockApiError
}));

// Mock servers store
const mockCurrentServer = writable<{ id: string; name: string } | null>(null);

vi.mock('../stores/servers', () => ({
  currentServer: mockCurrentServer
}));

describe('Channels Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCurrentServer.set(null);
  });

  afterEach(() => {
    vi.resetModules();
  });

  const mockTextChannel = {
    id: 'channel-1',
    server_id: 'server-1',
    name: 'general',
    topic: 'General discussion',
    type: 0, // text
    position: 0,
    parent_id: null,
    slowmode: 0,
    nsfw: false,
    e2ee_enabled: false,
    last_message_id: 'msg-1',
    last_message_at: '2024-01-01T00:00:00Z'
  };

  const mockVoiceChannel = {
    id: 'channel-2',
    server_id: 'server-1',
    name: 'Voice',
    topic: null,
    type: 2, // voice
    position: 1,
    parent_id: null,
    slowmode: 0,
    nsfw: false,
    e2ee_enabled: false,
    last_message_id: null,
    last_message_at: null
  };

  const mockDMChannel = {
    id: 'dm-1',
    server_id: null,
    name: '',
    topic: null,
    type: 1, // DM
    position: 0,
    parent_id: null,
    slowmode: 0,
    nsfw: false,
    e2ee_enabled: true,
    recipients: [{ id: 'user-2', username: 'friend', display_name: 'Friend', avatar: null }],
    last_message_id: 'msg-2',
    last_message_at: '2024-01-02T00:00:00Z'
  };

  const mockGroupDM = {
    id: 'dm-2',
    server_id: null,
    name: 'Group Chat',
    topic: null,
    type: 3, // group DM
    position: 0,
    parent_id: null,
    slowmode: 0,
    nsfw: false,
    e2ee_enabled: true,
    recipients: [
      { id: 'user-2', username: 'friend1', display_name: null, avatar: null },
      { id: 'user-3', username: 'friend2', display_name: null, avatar: null }
    ],
    last_message_id: null,
    last_message_at: null
  };

  describe('Initial State', () => {
    it('should have empty channels array initially', async () => {
      const { channels } = await import('../stores/channels');
      expect(get(channels)).toEqual([]);
    });

    it('should have null currentChannel initially', async () => {
      const { currentChannel } = await import('../stores/channels');
      expect(get(currentChannel)).toBeNull();
    });
  });

  describe('Derived Stores', () => {
    it('should derive serverChannels based on currentServer', async () => {
      const { channels, serverChannels } = await import('../stores/channels');
      
      channels.set([mockTextChannel, mockVoiceChannel, mockDMChannel]);
      
      // No server selected - should be empty
      expect(get(serverChannels)).toEqual([]);
      
      // Select server
      mockCurrentServer.set({ id: 'server-1', name: 'Test Server' });
      
      // Should now show server channels
      expect(get(serverChannels)).toHaveLength(2);
      expect(get(serverChannels)).toContainEqual(mockTextChannel);
      expect(get(serverChannels)).toContainEqual(mockVoiceChannel);
    });

    it('should derive dmChannels correctly', async () => {
      const { channels, dmChannels } = await import('../stores/channels');
      
      channels.set([mockTextChannel, mockDMChannel, mockGroupDM]);
      
      const dms = get(dmChannels);
      expect(dms).toHaveLength(2);
      expect(dms).toContainEqual(mockDMChannel);
      expect(dms).toContainEqual(mockGroupDM);
    });
  });

  describe('loadServerChannels()', () => {
    it('should load channels for a server', async () => {
      mockApi.get.mockResolvedValueOnce([mockTextChannel, mockVoiceChannel]);
      
      const { channels, loadServerChannels } = await import('../stores/channels');
      await loadServerChannels('server-1');
      
      expect(mockApi.get).toHaveBeenCalledWith('/servers/server-1/channels');
      expect(get(channels)).toEqual([mockTextChannel, mockVoiceChannel]);
    });

    it('should replace old server channels and keep DMs', async () => {
      const { channels, loadServerChannels } = await import('../stores/channels');
      
      // Start with existing channels
      channels.set([mockDMChannel]);
      
      // Load server channels
      mockApi.get.mockResolvedValueOnce([mockTextChannel]);
      await loadServerChannels('server-1');
      
      const allChannels = get(channels);
      expect(allChannels).toHaveLength(2);
      expect(allChannels).toContainEqual(mockDMChannel);
      expect(allChannels).toContainEqual(mockTextChannel);
    });

    it('should handle load error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));
      
      const { channels, loadServerChannels } = await import('../stores/channels');
      
      // Function throws after logging - we catch and verify behavior
      await expect(loadServerChannels('server-1')).rejects.toThrow('Network error');
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load channels:', expect.any(Error));
      expect(get(channels)).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('loadDMChannels()', () => {
    it('should load DM channels', async () => {
      mockApi.get.mockResolvedValueOnce([mockDMChannel, mockGroupDM]);
      
      const { channels, loadDMChannels } = await import('../stores/channels');
      await loadDMChannels();
      
      expect(mockApi.get).toHaveBeenCalledWith('/users/@me/channels');
      expect(get(channels)).toEqual([mockDMChannel, mockGroupDM]);
    });

    it('should replace old DMs and keep server channels', async () => {
      const { channels, loadDMChannels } = await import('../stores/channels');
      
      // Start with server channels
      channels.set([mockTextChannel]);
      
      // Load DMs
      mockApi.get.mockResolvedValueOnce([mockDMChannel]);
      await loadDMChannels();
      
      const allChannels = get(channels);
      expect(allChannels).toHaveLength(2);
      expect(allChannels).toContainEqual(mockTextChannel);
      expect(allChannels).toContainEqual(mockDMChannel);
    });

    it('should handle load error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));
      
      const { loadDMChannels } = await import('../stores/channels');
      
      // Function throws after logging - we catch and verify behavior
      await expect(loadDMChannels()).rejects.toThrow('Network error');
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load DM channels:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('createChannel()', () => {
    it('should create text channel', async () => {
      mockApi.post.mockResolvedValueOnce(mockTextChannel);
      
      const { channels, createChannel } = await import('../stores/channels');
      const result = await createChannel('server-1', { name: 'general' });
      
      expect(mockApi.post).toHaveBeenCalledWith('/servers/server-1/channels', { name: 'general', type: 'text' });
      expect(result).toEqual(mockTextChannel);
      expect(get(channels)).toContainEqual(mockTextChannel);
    });

    it('should create voice channel', async () => {
      mockApi.post.mockResolvedValueOnce(mockVoiceChannel);
      
      const { createChannel } = await import('../stores/channels');
      const result = await createChannel('server-1', { name: 'Voice', type: 'voice' });
      
      expect(mockApi.post).toHaveBeenCalledWith('/servers/server-1/channels', { name: 'Voice', type: 'voice' });
      expect(result).toEqual(mockVoiceChannel);
    });

    it('should throw error on create failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.post.mockRejectedValueOnce(new Error('Permission denied'));
      
      const { createChannel } = await import('../stores/channels');
      
      await expect(createChannel('server-1', { name: 'new-channel' })).rejects.toThrow('Permission denied');
      consoleSpy.mockRestore();
    });
  });

  describe('updateChannel()', () => {
    it('should update channel in list', async () => {
      const updatedChannel = { ...mockTextChannel, name: 'updated-general', topic: 'New topic' };
      mockApi.patch.mockResolvedValueOnce(updatedChannel);
      
      const { channels, updateChannel } = await import('../stores/channels');
      channels.set([mockTextChannel, mockVoiceChannel]);
      
      const result = await updateChannel('channel-1', { name: 'updated-general', topic: 'New topic' });
      
      expect(mockApi.patch).toHaveBeenCalledWith('/channels/channel-1', { name: 'updated-general', topic: 'New topic' });
      expect(result).toEqual(updatedChannel);
      
      const allChannels = get(channels);
      expect(allChannels[0].name).toBe('updated-general');
      expect(allChannels[0].topic).toBe('New topic');
    });

    it('should throw error on update failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.patch.mockRejectedValueOnce(new Error('Update failed'));
      
      const { updateChannel } = await import('../stores/channels');
      
      await expect(updateChannel('channel-1', { name: 'new-name' })).rejects.toThrow('Update failed');
      consoleSpy.mockRestore();
    });
  });

  describe('deleteChannel()', () => {
    it('should delete channel from list', async () => {
      mockApi.delete.mockResolvedValueOnce({});
      
      const { channels, deleteChannel } = await import('../stores/channels');
      channels.set([mockTextChannel, mockVoiceChannel]);
      
      await deleteChannel('channel-1');
      
      expect(mockApi.delete).toHaveBeenCalledWith('/channels/channel-1');
      expect(get(channels)).toHaveLength(1);
      expect(get(channels)[0].id).toBe('channel-2');
    });

    it('should clear currentChannel if deleted', async () => {
      mockApi.delete.mockResolvedValueOnce({});
      
      const { channels, currentChannel, deleteChannel } = await import('../stores/channels');
      channels.set([mockTextChannel]);
      currentChannel.set(mockTextChannel);
      
      await deleteChannel('channel-1');
      
      expect(get(currentChannel)).toBeNull();
    });

    it('should not clear currentChannel if different channel deleted', async () => {
      mockApi.delete.mockResolvedValueOnce({});
      
      const { channels, currentChannel, deleteChannel } = await import('../stores/channels');
      channels.set([mockTextChannel, mockVoiceChannel]);
      currentChannel.set(mockVoiceChannel);
      
      await deleteChannel('channel-1');
      
      expect(get(currentChannel)?.id).toBe('channel-2');
    });

    it('should throw error on delete failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.delete.mockRejectedValueOnce(new Error('Delete failed'));
      
      const { deleteChannel } = await import('../stores/channels');
      
      await expect(deleteChannel('channel-1')).rejects.toThrow('Delete failed');
      consoleSpy.mockRestore();
    });
  });

  describe('createDM()', () => {
    it('should create new DM channel', async () => {
      mockApi.post.mockResolvedValueOnce(mockDMChannel);
      
      const { channels, createDM } = await import('../stores/channels');
      const result = await createDM('user-2');
      
      expect(mockApi.post).toHaveBeenCalledWith('/users/@me/channels', { recipient_id: 'user-2' });
      expect(result).toEqual(mockDMChannel);
      expect(get(channels)).toContainEqual(mockDMChannel);
    });

    it('should not duplicate existing DM channel', async () => {
      mockApi.post.mockResolvedValueOnce(mockDMChannel);
      
      const { channels, createDM } = await import('../stores/channels');
      channels.set([mockDMChannel]); // DM already exists
      
      await createDM('user-2');
      
      // Should not add duplicate
      expect(get(channels)).toHaveLength(1);
    });

    it('should throw error on create failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.post.mockRejectedValueOnce(new Error('User not found'));
      
      const { createDM } = await import('../stores/channels');
      
      await expect(createDM('nonexistent-user')).rejects.toThrow('User not found');
      consoleSpy.mockRestore();
    });
  });

  describe('Channel Types', () => {
    it('should correctly identify channel types', async () => {
      const { channels, dmChannels, serverChannels } = await import('../stores/channels');
      
      const categoryChannel = {
        ...mockTextChannel,
        id: 'cat-1',
        type: 4, // category
        name: 'Category'
      };
      
      channels.set([mockTextChannel, mockVoiceChannel, mockDMChannel, mockGroupDM, categoryChannel]);
      mockCurrentServer.set({ id: 'server-1', name: 'Test' });
      
      // DMs should only include type 1 and 3
      expect(get(dmChannels)).toHaveLength(2);
      
      // Server channels should include all server-specific channels
      expect(get(serverChannels)).toHaveLength(3); // text, voice, category
    });
  });
});

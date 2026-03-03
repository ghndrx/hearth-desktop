/**
 * Tests for servers store
 * 
 * Tests server management including loading, creating, updating,
 * deleting, and leaving servers.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock API
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn()
};

vi.mock('$lib/api', () => ({
  api: mockApi
}));

describe('Servers Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const mockServer = {
    id: 'server-1',
    name: 'Test Server',
    icon: null,
    banner: null,
    description: 'A test server',
    owner_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z'
  };

  const mockServer2 = {
    id: 'server-2',
    name: 'Another Server',
    icon: 'icon-url',
    banner: null,
    description: null,
    owner_id: 'user-2',
    created_at: '2024-01-02T00:00:00Z'
  };

  describe('Initial State', () => {
    it('should have empty servers array initially', async () => {
      const { servers } = await import('../stores/servers');
      expect(get(servers)).toEqual([]);
    });

    it('should have null currentServer initially', async () => {
      const { currentServer } = await import('../stores/servers');
      expect(get(currentServer)).toBeNull();
    });
  });

  describe('loadServers()', () => {
    it('should load servers successfully', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer, mockServer2]);
      
      const { servers, loadServers } = await import('../stores/servers');
      await loadServers();
      
      expect(mockApi.get).toHaveBeenCalledWith('/users/@me/servers');
      expect(get(servers)).toEqual([mockServer, mockServer2]);
    });

    it('should handle load error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));
      
      const { servers, loadServers } = await import('../stores/servers');
      await loadServers();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load servers:', expect.any(Error));
      expect(get(servers)).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('createServer()', () => {
    it('should create server and add to list', async () => {
      mockApi.post.mockResolvedValueOnce(mockServer);
      
      const { servers, createServer } = await import('../stores/servers');
      const result = await createServer('Test Server');
      
      expect(mockApi.post).toHaveBeenCalledWith('/servers', { name: 'Test Server', icon: undefined });
      expect(result).toEqual(mockServer);
      expect(get(servers)).toContainEqual(mockServer);
    });

    it('should create server with icon', async () => {
      const serverWithIcon = { ...mockServer, icon: 'icon-data' };
      mockApi.post.mockResolvedValueOnce(serverWithIcon);
      
      const { createServer } = await import('../stores/servers');
      const result = await createServer('Test Server', 'icon-data');
      
      expect(mockApi.post).toHaveBeenCalledWith('/servers', { name: 'Test Server', icon: 'icon-data' });
      expect(result).toEqual(serverWithIcon);
    });

    it('should throw error on create failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.post.mockRejectedValueOnce(new Error('Create failed'));
      
      const { createServer } = await import('../stores/servers');
      
      await expect(createServer('Test Server')).rejects.toThrow('Create failed');
      consoleSpy.mockRestore();
    });
  });

  describe('updateServer()', () => {
    it('should update server in list', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer]);
      const updatedServer = { ...mockServer, name: 'Updated Server' };
      mockApi.patch.mockResolvedValueOnce(updatedServer);
      
      const { servers, loadServers, updateServer } = await import('../stores/servers');
      await loadServers();
      const result = await updateServer('server-1', { name: 'Updated Server' });
      
      expect(mockApi.patch).toHaveBeenCalledWith('/servers/server-1', { name: 'Updated Server' });
      expect(result).toEqual(updatedServer);
      expect(get(servers)[0].name).toBe('Updated Server');
    });

    it('should update currentServer if it matches', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer]);
      const updatedServer = { ...mockServer, name: 'Updated Server' };
      mockApi.patch.mockResolvedValueOnce(updatedServer);
      
      const { currentServer, loadServers, updateServer } = await import('../stores/servers');
      await loadServers();
      currentServer.set(mockServer);
      
      await updateServer('server-1', { name: 'Updated Server' });
      
      expect(get(currentServer)?.name).toBe('Updated Server');
    });

    it('should not update currentServer if it does not match', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer, mockServer2]);
      const updatedServer = { ...mockServer, name: 'Updated Server' };
      mockApi.patch.mockResolvedValueOnce(updatedServer);
      
      const { currentServer, loadServers, updateServer } = await import('../stores/servers');
      await loadServers();
      currentServer.set(mockServer2);
      
      await updateServer('server-1', { name: 'Updated Server' });
      
      expect(get(currentServer)?.id).toBe('server-2');
    });

    it('should throw error on update failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.patch.mockRejectedValueOnce(new Error('Update failed'));
      
      const { updateServer } = await import('../stores/servers');
      
      await expect(updateServer('server-1', { name: 'New Name' })).rejects.toThrow('Update failed');
      consoleSpy.mockRestore();
    });
  });

  describe('updateServerIcon()', () => {
    it('should update server icon with FormData', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer]);
      const updatedServer = { ...mockServer, icon: 'new-icon-url' };
      mockApi.patch.mockResolvedValueOnce(updatedServer);
      
      const { loadServers, updateServerIcon } = await import('../stores/servers');
      await loadServers();
      
      const mockFile = new File([''], 'icon.png', { type: 'image/png' });
      const result = await updateServerIcon('server-1', mockFile);
      
      expect(mockApi.patch).toHaveBeenCalledWith('/servers/server-1', expect.any(FormData));
      expect(result).toEqual(updatedServer);
    });
  });

  describe('removeServerIcon()', () => {
    it('should remove server icon', async () => {
      const serverWithIcon = { ...mockServer, icon: 'icon-url' };
      mockApi.get.mockResolvedValueOnce([serverWithIcon]);
      const updatedServer = { ...mockServer, icon: null };
      mockApi.patch.mockResolvedValueOnce(updatedServer);
      
      const { servers, loadServers, removeServerIcon } = await import('../stores/servers');
      await loadServers();
      const result = await removeServerIcon('server-1');
      
      expect(mockApi.patch).toHaveBeenCalledWith('/servers/server-1', { icon: null });
      expect(result.icon).toBeNull();
      expect(get(servers)[0].icon).toBeNull();
    });
  });

  describe('deleteServer()', () => {
    it('should delete server from list', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer, mockServer2]);
      mockApi.delete.mockResolvedValueOnce({});
      
      const { servers, loadServers, deleteServer } = await import('../stores/servers');
      await loadServers();
      await deleteServer('server-1');
      
      expect(mockApi.delete).toHaveBeenCalledWith('/servers/server-1');
      expect(get(servers)).toHaveLength(1);
      expect(get(servers)[0].id).toBe('server-2');
    });

    it('should clear currentServer if it was deleted', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer]);
      mockApi.delete.mockResolvedValueOnce({});
      
      const { currentServer, loadServers, deleteServer } = await import('../stores/servers');
      await loadServers();
      currentServer.set(mockServer);
      
      await deleteServer('server-1');
      
      expect(get(currentServer)).toBeNull();
    });

    it('should throw error on delete failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.delete.mockRejectedValueOnce(new Error('Delete failed'));
      
      const { deleteServer } = await import('../stores/servers');
      
      await expect(deleteServer('server-1')).rejects.toThrow('Delete failed');
      consoleSpy.mockRestore();
    });
  });

  describe('leaveServer()', () => {
    it('should leave server and remove from list', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer, mockServer2]);
      mockApi.delete.mockResolvedValueOnce({});
      
      const { servers, loadServers, leaveServer } = await import('../stores/servers');
      await loadServers();
      await leaveServer('server-1');
      
      expect(mockApi.delete).toHaveBeenCalledWith('/servers/server-1/members/@me');
      expect(get(servers)).toHaveLength(1);
      expect(get(servers)[0].id).toBe('server-2');
    });

    it('should clear currentServer if it was left', async () => {
      mockApi.get.mockResolvedValueOnce([mockServer]);
      mockApi.delete.mockResolvedValueOnce({});
      
      const { currentServer, loadServers, leaveServer } = await import('../stores/servers');
      await loadServers();
      currentServer.set(mockServer);
      
      await leaveServer('server-1');
      
      expect(get(currentServer)).toBeNull();
    });

    it('should throw error on leave failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.delete.mockRejectedValueOnce(new Error('Leave failed'));
      
      const { leaveServer } = await import('../stores/servers');
      
      await expect(leaveServer('server-1')).rejects.toThrow('Leave failed');
      consoleSpy.mockRestore();
    });
  });

  describe('joinServer()', () => {
    it('should join server via invite code', async () => {
      mockApi.post.mockResolvedValueOnce(mockServer);
      
      const { servers, joinServer } = await import('../stores/servers');
      const result = await joinServer('ABC123');
      
      expect(mockApi.post).toHaveBeenCalledWith('/invites/ABC123');
      expect(result).toEqual(mockServer);
      expect(get(servers)).toContainEqual(mockServer);
    });

    it('should throw error on join failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.post.mockRejectedValueOnce(new Error('Invalid invite'));
      
      const { joinServer } = await import('../stores/servers');
      
      await expect(joinServer('INVALID')).rejects.toThrow('Invalid invite');
      consoleSpy.mockRestore();
    });
  });
});

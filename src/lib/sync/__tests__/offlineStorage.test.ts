/**
 * Tests for Offline Storage (IndexedDB wrapper)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  openDatabase,
  closeDatabase,
  storeMessage,
  storeMessages,
  getMessage,
  getChannelMessages,
  getUnsyncedMessages,
  markMessageSynced,
  deleteMessage,
  pruneMessages,
  storeChannel,
  getChannel,
  getAllChannels,
  storeUser,
  getUser,
  storeServer,
  getServer,
  setMetadata,
  getMetadata,
  clearAllOfflineData,
  getStorageStats,
  isIndexedDBAvailable
} from '../offlineStorage';
import type { Message, Channel, User, Server } from '$lib/types';

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

// Mock IndexedDB using fake-indexeddb
import 'fake-indexeddb/auto';

describe('Offline Storage', () => {
  beforeEach(async () => {
    // Clear database before each test
    closeDatabase();
    await openDatabase();
    await clearAllOfflineData();
  });
  
  afterEach(() => {
    closeDatabase();
  });
  
  describe('Database Operations', () => {
    it('should open database successfully', async () => {
      const db = await openDatabase();
      expect(db).toBeDefined();
      expect(db.name).toBe('hearth-offline');
    });
    
    it('should detect IndexedDB availability', () => {
      expect(isIndexedDBAvailable()).toBe(true);
    });
  });
  
  describe('Message Operations', () => {
    const mockMessage: Message = {
      id: 'msg-1',
      channel_id: 'ch-1',
      author_id: 'user-1',
      content: 'Hello, world!',
      encrypted: false,
      type: 'default',
      pinned: false,
      tts: false,
      mention_everyone: false,
      flags: 0,
      created_at: new Date().toISOString()
    };
    
    it('should store and retrieve a message', async () => {
      await storeMessage(mockMessage);
      
      const retrieved = await getMessage(mockMessage.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Hello, world!');
      expect(retrieved?._synced).toBe(true);
    });
    
    it('should store message as unsynced', async () => {
      await storeMessage(mockMessage, false);
      
      const retrieved = await getMessage(mockMessage.id);
      expect(retrieved?._synced).toBe(false);
    });
    
    it('should store multiple messages', async () => {
      const messages: Message[] = [
        { ...mockMessage, id: 'msg-1' },
        { ...mockMessage, id: 'msg-2' },
        { ...mockMessage, id: 'msg-3' }
      ];
      
      await storeMessages(messages);
      
      const msg1 = await getMessage('msg-1');
      const msg2 = await getMessage('msg-2');
      const msg3 = await getMessage('msg-3');
      
      expect(msg1).toBeDefined();
      expect(msg2).toBeDefined();
      expect(msg3).toBeDefined();
    });
    
    it('should get messages for a channel', async () => {
      const messages: Message[] = [
        { ...mockMessage, id: 'msg-1', channel_id: 'ch-1', created_at: '2024-01-01T10:00:00Z' },
        { ...mockMessage, id: 'msg-2', channel_id: 'ch-1', created_at: '2024-01-01T11:00:00Z' },
        { ...mockMessage, id: 'msg-3', channel_id: 'ch-2', created_at: '2024-01-01T12:00:00Z' }
      ];
      
      await storeMessages(messages);
      
      const channelMessages = await getChannelMessages('ch-1');
      expect(channelMessages).toHaveLength(2);
    });
    
    it('should respect limit when getting channel messages', async () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
        created_at: new Date(2024, 0, 1, i).toISOString()
      }));
      
      await storeMessages(messages);
      
      const limited = await getChannelMessages('ch-1', { limit: 5 });
      expect(limited).toHaveLength(5);
    });
    
    it('should get unsynced messages', async () => {
      await storeMessage({ ...mockMessage, id: 'msg-1' }, true);
      await storeMessage({ ...mockMessage, id: 'msg-2' }, false);
      await storeMessage({ ...mockMessage, id: 'msg-3' }, false);
      
      const unsynced = await getUnsyncedMessages();
      expect(unsynced).toHaveLength(2);
    });
    
    it('should mark message as synced', async () => {
      await storeMessage(mockMessage, false);
      
      const before = await getMessage(mockMessage.id);
      expect(before?._synced).toBe(false);
      
      await markMessageSynced(mockMessage.id);
      
      const after = await getMessage(mockMessage.id);
      expect(after?._synced).toBe(true);
    });
    
    it('should delete a message', async () => {
      await storeMessage(mockMessage);
      
      const before = await getMessage(mockMessage.id);
      expect(before).toBeDefined();
      
      await deleteMessage(mockMessage.id);
      
      const after = await getMessage(mockMessage.id);
      expect(after).toBeNull();
    });
    
    it('should prune old messages', async () => {
      const messages: Message[] = Array.from({ length: 300 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
        created_at: new Date(2024, 0, 1, 0, 0, i).toISOString()
      }));
      
      await storeMessages(messages);
      
      const pruned = await pruneMessages(100);
      expect(pruned).toBe(200);
      
      const remaining = await getChannelMessages('ch-1');
      expect(remaining).toHaveLength(100);
    });
  });
  
  describe('Channel Operations', () => {
    const mockChannel: Channel = {
      id: 'ch-1',
      server_id: 'srv-1',
      name: 'general',
      type: 'text',
      position: 0,
      created_at: new Date().toISOString()
    };
    
    it('should store and retrieve a channel', async () => {
      await storeChannel(mockChannel);
      
      const retrieved = await getChannel(mockChannel.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('general');
    });
    
    it('should get all channels', async () => {
      await storeChannel({ ...mockChannel, id: 'ch-1' });
      await storeChannel({ ...mockChannel, id: 'ch-2', name: 'random' });
      
      const channels = await getAllChannels();
      expect(channels).toHaveLength(2);
    });
  });
  
  describe('User Operations', () => {
    const mockUser: User = {
      id: 'user-1',
      username: 'testuser',
      display_name: 'Test User',
      avatar: null
    };
    
    it('should store and retrieve a user', async () => {
      await storeUser(mockUser);
      
      const retrieved = await getUser(mockUser.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.username).toBe('testuser');
    });
  });
  
  describe('Server Operations', () => {
    const mockServer: Server = {
      id: 'srv-1',
      name: 'Test Server',
      owner_id: 'user-1',
      created_at: new Date().toISOString()
    };
    
    it('should store and retrieve a server', async () => {
      await storeServer(mockServer);
      
      const retrieved = await getServer(mockServer.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Server');
    });
  });
  
  describe('Metadata Operations', () => {
    it('should set and get metadata', async () => {
      await setMetadata('last_sync', 1234567890);
      
      const value = await getMetadata<number>('last_sync');
      expect(value).toBe(1234567890);
    });
    
    it('should return null for missing metadata', async () => {
      const value = await getMetadata('nonexistent');
      expect(value).toBeNull();
    });
    
    it('should store complex metadata objects', async () => {
      const data = { foo: 'bar', count: 42, nested: { a: 1 } };
      await setMetadata('complex', data);
      
      const retrieved = await getMetadata<typeof data>('complex');
      expect(retrieved).toEqual(data);
    });
  });
  
  describe('Utility Functions', () => {
    it('should clear all offline data', async () => {
      const mockMessage: Message = {
        id: 'msg-1',
        channel_id: 'ch-1',
        author_id: 'user-1',
        content: 'Test',
        encrypted: false,
        type: 'default',
        pinned: false,
        tts: false,
        mention_everyone: false,
        flags: 0,
        created_at: new Date().toISOString()
      };
      
      await storeMessage(mockMessage);
      await setMetadata('test', 'value');
      
      await clearAllOfflineData();
      
      const msg = await getMessage('msg-1');
      const meta = await getMetadata('test');
      
      expect(msg).toBeNull();
      expect(meta).toBeNull();
    });
    
    it('should get storage statistics', async () => {
      const mockMessage: Message = {
        id: 'msg-1',
        channel_id: 'ch-1',
        author_id: 'user-1',
        content: 'Test',
        encrypted: false,
        type: 'default',
        pinned: false,
        tts: false,
        mention_everyone: false,
        flags: 0,
        created_at: new Date().toISOString()
      };
      
      await storeMessage(mockMessage);
      
      const stats = await getStorageStats();
      
      expect(stats.messages).toBe(1);
      expect(stats.channels).toBe(0);
      expect(stats.users).toBe(0);
      expect(stats.servers).toBe(0);
    });
  });
});

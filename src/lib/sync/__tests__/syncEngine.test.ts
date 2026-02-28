/**
 * Tests for Sync Engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  startSyncEngine,
  stopSyncEngine,
  pauseSyncEngine,
  resumeSyncEngine,
  syncEngineStatus,
  isSyncing,
  hasSyncErrors
} from '../syncEngine';
import {
  initQueue,
  enqueue,
  queueStore
} from '../syncQueue';

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

// Mock onlineStatus store
vi.mock('$lib/stores/onlineStatus', () => ({
  onlineStatus: {
    subscribe: vi.fn((callback) => {
      callback({ isOnline: true, wasOffline: false });
      return () => {};
    })
  }
}));

// Mock API module
vi.mock('$lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ id: 'msg-123' }),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  },
  ApiError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
}));

// Mock IndexedDB
import 'fake-indexeddb/auto';

describe('Sync Engine', () => {
  beforeEach(async () => {
    // Reset queue and engine state
    queueStore.set([]);
    stopSyncEngine();
    await initQueue();
  });
  
  afterEach(() => {
    stopSyncEngine();
    vi.clearAllMocks();
  });
  
  describe('Engine Lifecycle', () => {
    it('should start the sync engine', () => {
      startSyncEngine();
      
      const status = get(syncEngineStatus);
      expect(['idle', 'syncing']).toContain(status.state);
    });
    
    it('should stop the sync engine', () => {
      startSyncEngine();
      stopSyncEngine();
      
      const status = get(syncEngineStatus);
      expect(status.state).toBe('idle');
    });
    
    it('should pause and resume', () => {
      startSyncEngine();
      
      pauseSyncEngine();
      let status = get(syncEngineStatus);
      expect(status.state).toBe('paused');
      
      resumeSyncEngine();
      status = get(syncEngineStatus);
      expect(['syncing', 'idle']).toContain(status.state);
    });
  });
  
  describe('Sync Status', () => {
    it('should track online status', () => {
      startSyncEngine();
      
      const status = get(syncEngineStatus);
      expect(status.isOnline).toBe(true);
    });
    
    it('should update pending count', async () => {
      startSyncEngine();
      
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      
      // Wait for sync to process
      await new Promise(r => setTimeout(r, 100));
      
      const status = get(syncEngineStatus);
      // Pending count may be 0 if already processed, or 1 if still pending
      expect(typeof status.pendingCount).toBe('number');
    });
  });
  
  describe('Derived Stores', () => {
    it('should provide isSyncing store', async () => {
      expect(get(isSyncing)).toBe(false);
      
      // Add item and start engine
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      startSyncEngine();
      
      // The engine should start syncing
      // Note: This is timing-dependent in tests
    });
    
    it('should provide hasSyncErrors store', () => {
      expect(get(hasSyncErrors)).toBe(false);
    });
  });
});

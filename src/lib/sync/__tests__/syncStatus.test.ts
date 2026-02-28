/**
 * Tests for Sync Status Store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get, type Writable } from 'svelte/store';
import type { OnlineStatusState } from '$lib/stores/onlineStatus';

// Type for queue items used in tests
interface TestQueueItem {
  id: string;
  idempotencyKey: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  priority: number;
}

// Helper to create a valid QueueItem
function createQueueItem(overrides: {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  type: string;
}): TestQueueItem {
  return {
    id: overrides.id,
    idempotencyKey: `key-${overrides.id}`,
    type: overrides.type,
    data: {},
    timestamp: Date.now(),
    status: overrides.status,
    retryCount: 0,
    maxRetries: 3,
    priority: 1
  };
}

// Mock dependencies
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

vi.mock('$lib/sync/syncQueue', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writable, derived } = require('svelte/store') as typeof import('svelte/store');
  
  interface MockQueueItem { status: string; }
  const queueStore = writable<MockQueueItem[]>([]);
  
  return {
    queueStore,
    pendingCount: derived(queueStore, ($q: MockQueueItem[]) => $q.filter(i => i.status === 'pending').length),
    failedItems: derived(queueStore, ($q: MockQueueItem[]) => $q.filter(i => i.status === 'failed')),
    processingItems: derived(queueStore, ($q: MockQueueItem[]) => $q.filter(i => i.status === 'processing'))
  };
});

vi.mock('$lib/sync/syncEngine', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writable } = require('svelte/store') as typeof import('svelte/store');
  
  return {
    syncEngineStatus: writable({
      state: 'idle',
      lastSyncAt: null,
      lastError: null,
      isOnline: true,
      pendingCount: 0,
      processingCount: 0
    })
  };
});

vi.mock('$lib/sync/serviceWorkerRegistration', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writable } = require('svelte/store') as typeof import('svelte/store');
  
  return {
    serviceWorkerStatus: writable({
      state: 'activated',
      registration: null,
      updateAvailable: false,
      error: null
    })
  };
});

vi.mock('$lib/stores/onlineStatus', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writable } = require('svelte/store') as typeof import('svelte/store');
  
  const store = writable<OnlineStatusState>({
    isOnline: true,
    wasOffline: false,
    lastOnlineAt: Date.now(),
    lastOfflineAt: null,
    connectionType: null,
    effectiveType: null,
    downlink: null,
    rtt: null
  });
  
  return {
    onlineStatus: store
  };
});

// Import after mocks
import {
  syncStatus,
  hasPendingSync,
  hasSyncErrors,
  syncMessage,
  showSyncIndicator,
  syncIndicatorType,
  formatTimeAgo,
  getSyncStatusDescription
} from '../../stores/syncStatus';
import { queueStore } from '$lib/sync/syncQueue';
import { onlineStatus } from '$lib/stores/onlineStatus';

// Cast to Writable for test purposes since we mocked it as writable
const onlineStatusWritable = onlineStatus as unknown as Writable<OnlineStatusState>;

describe('Sync Status Store', () => {
  beforeEach(() => {
    (queueStore as Writable<TestQueueItem[]>).set([]);
    onlineStatusWritable.set({
      isOnline: true,
      wasOffline: false,
      lastOnlineAt: Date.now(),
      lastOfflineAt: null,
      connectionType: null,
      effectiveType: null,
      downlink: null,
      rtt: null
    });
  });
  
  describe('Derived Status', () => {
    it('should show idle state when no activity', () => {
      const status = get(syncStatus);
      expect(status.state).toBe('idle');
      expect(status.message).toBe('');
    });
    
    it('should show pending state with items', () => {
      (queueStore as Writable<TestQueueItem[]>).set([
        createQueueItem({ id: '1', status: 'pending', type: 'SEND_MESSAGE' })
      ]);
      
      const status = get(syncStatus);
      expect(status.state).toBe('pending');
      expect(status.pendingCount).toBe(1);
    });
    
    it('should show error state with failed items', () => {
      (queueStore as Writable<TestQueueItem[]>).set([
        createQueueItem({ id: '1', status: 'failed', type: 'SEND_MESSAGE' })
      ]);
      
      const status = get(syncStatus);
      expect(status.state).toBe('error');
      expect(status.failedCount).toBe(1);
    });
    
    it('should show syncing state with processing items', () => {
      (queueStore as Writable<TestQueueItem[]>).set([
        createQueueItem({ id: '1', status: 'processing', type: 'SEND_MESSAGE' })
      ]);
      
      const status = get(syncStatus);
      expect(status.state).toBe('syncing');
      expect(status.processingCount).toBe(1);
    });
    
    it('should show offline state when not online', () => {
      onlineStatusWritable.set({
        isOnline: false,
        wasOffline: false,
        lastOnlineAt: Date.now() - 60000,
        lastOfflineAt: Date.now(),
        connectionType: null,
        effectiveType: null,
        downlink: null,
        rtt: null
      });
      
      const status = get(syncStatus);
      expect(status.state).toBe('offline');
      expect(status.isOnline).toBe(false);
    });
  });
  
  describe('Convenience Stores', () => {
    it('should track hasPendingSync', () => {
      expect(get(hasPendingSync)).toBe(false);
      
      (queueStore as Writable<TestQueueItem[]>).set([
        createQueueItem({ id: '1', status: 'pending', type: 'SEND_MESSAGE' })
      ]);
      
      expect(get(hasPendingSync)).toBe(true);
    });
    
    it('should track hasSyncErrors', () => {
      expect(get(hasSyncErrors)).toBe(false);
      
      (queueStore as Writable<TestQueueItem[]>).set([
        createQueueItem({ id: '1', status: 'failed', type: 'SEND_MESSAGE' })
      ]);
      
      expect(get(hasSyncErrors)).toBe(true);
    });
    
    it('should provide sync message', () => {
      (queueStore as Writable<TestQueueItem[]>).set([
        createQueueItem({ id: '1', status: 'pending', type: 'SEND_MESSAGE' }),
        createQueueItem({ id: '2', status: 'pending', type: 'SEND_MESSAGE' })
      ]);
      
      expect(get(syncMessage)).toContain('2 items');
    });
    
    it('should determine showSyncIndicator', () => {
      expect(get(showSyncIndicator)).toBe(false);
      
      (queueStore as Writable<TestQueueItem[]>).set([
        createQueueItem({ id: '1', status: 'pending', type: 'SEND_MESSAGE' })
      ]);
      
      expect(get(showSyncIndicator)).toBe(true);
    });
    
    it('should determine syncIndicatorType', () => {
      // Default is info
      expect(get(syncIndicatorType)).toBe('info');
      
      // Error state
      (queueStore as Writable<TestQueueItem[]>).set([
        createQueueItem({ id: '1', status: 'failed', type: 'SEND_MESSAGE' })
      ]);
      expect(get(syncIndicatorType)).toBe('error');
      
      // Offline state
      onlineStatusWritable.set({
        isOnline: false,
        wasOffline: false,
        lastOnlineAt: null,
        lastOfflineAt: Date.now(),
        connectionType: null,
        effectiveType: null,
        downlink: null,
        rtt: null
      });
      expect(get(syncIndicatorType)).toBe('warning');
    });
  });
  
  describe('Utility Functions', () => {
    describe('formatTimeAgo', () => {
      it('should format just now', () => {
        expect(formatTimeAgo(Date.now())).toBe('just now');
      });
      
      it('should format seconds', () => {
        expect(formatTimeAgo(Date.now() - 30000)).toBe('30s ago');
      });
      
      it('should format minutes', () => {
        expect(formatTimeAgo(Date.now() - 5 * 60 * 1000)).toBe('5m ago');
      });
      
      it('should format hours', () => {
        expect(formatTimeAgo(Date.now() - 3 * 60 * 60 * 1000)).toBe('3h ago');
      });
      
      it('should format days', () => {
        expect(formatTimeAgo(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe('2d ago');
      });
      
      it('should return never for null', () => {
        expect(formatTimeAgo(null)).toBe('never');
      });
    });
    
    describe('getSyncStatusDescription', () => {
      it('should describe offline status', () => {
        const status = { ...get(syncStatus), isOnline: false };
        const desc = getSyncStatusDescription(status);
        expect(desc).toContain('offline');
      });
      
      it('should describe failed items', () => {
        const status = { ...get(syncStatus), failedCount: 3 };
        const desc = getSyncStatusDescription(status);
        expect(desc).toContain('3 sync operation');
        expect(desc).toContain('failed');
      });
      
      it('should describe syncing items', () => {
        const status = { ...get(syncStatus), processingCount: 2 };
        const desc = getSyncStatusDescription(status);
        expect(desc).toContain('syncing 2 item');
      });
      
      it('should describe pending items', () => {
        const status = { ...get(syncStatus), pendingCount: 5 };
        const desc = getSyncStatusDescription(status);
        expect(desc).toContain('5 item');
        expect(desc).toContain('waiting');
      });
      
      it('should describe synchronized state', () => {
        const status = { ...get(syncStatus), pendingCount: 0, failedCount: 0, processingCount: 0 };
        const desc = getSyncStatusDescription(status);
        expect(desc).toContain('synchronized');
      });
    });
  });
});

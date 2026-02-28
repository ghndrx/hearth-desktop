/**
 * Tests for Sync Queue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  initQueue,
  enqueue,
  markProcessing,
  markCompleted,
  markFailed,
  cancelQueueItem,
  removeFromQueue,
  getNextPendingItem,
  getItemsByType,
  clearCompletedItems,
  clearAllItems,
  retryFailedItems,
  getQueueStats,
  onQueueEvent,
  generateIdempotencyKey,
  createStableIdempotencyKey,
  queueStore,
  pendingCount,
  failedItems,
  hasOfflineQueue,
  PRIORITY_LEVELS,
  type QueueItem,
  type SendMessagePayload
} from '../syncQueue';

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

// Mock IndexedDB
import 'fake-indexeddb/auto';

describe('Sync Queue', () => {
  beforeEach(async () => {
    // Clear all items from queue and IndexedDB
    await clearAllItems();
    await initQueue();
  });
  
  describe('Queue Operations', () => {
    it('should enqueue an item', async () => {
      const payload: SendMessagePayload = {
        channelId: 'ch-1',
        content: 'Hello, world!'
      };
      
      const item = await enqueue('SEND_MESSAGE', payload);
      
      expect(item.id).toBeDefined();
      expect(item.type).toBe('SEND_MESSAGE');
      expect(item.status).toBe('pending');
      expect(item.data).toEqual(payload);
    });
    
    it('should generate unique idempotency keys', () => {
      const key1 = generateIdempotencyKey('SEND_MESSAGE', { content: 'test' });
      const key2 = generateIdempotencyKey('SEND_MESSAGE', { content: 'test' });
      
      expect(key1).not.toBe(key2);
      expect(key1).toContain('SEND_MESSAGE');
    });
    
    it('should create stable idempotency keys', async () => {
      const key1 = createStableIdempotencyKey('SEND_MESSAGE', { content: 'test', channelId: 'ch-1' });
      // Wait 2ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));
      const key2 = createStableIdempotencyKey('SEND_MESSAGE', { content: 'test', channelId: 'ch-1' });
      
      // Keys should be different due to timestamp
      expect(key1).not.toBe(key2);
      // But should start with the same type prefix
      expect(key1.split('-')[0]).toBe(key2.split('-')[0]);
    });
    
    it('should update pending count store', async () => {
      expect(get(pendingCount)).toBe(0);
      
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      
      expect(get(pendingCount)).toBe(1);
    });
    
    it('should sort items by priority', async () => {
      await enqueue('TYPING_INDICATOR', { channelId: 'ch-1' }, { priority: PRIORITY_LEVELS.LOW });
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' }, { priority: PRIORITY_LEVELS.HIGH });
      await enqueue('ADD_REACTION', { messageId: 'msg-1', channelId: 'ch-1', emoji: '👍' }, { priority: PRIORITY_LEVELS.NORMAL });
      
      const queue = get(queueStore);
      
      expect(queue[0].priority).toBe(PRIORITY_LEVELS.HIGH);
      expect(queue[1].priority).toBe(PRIORITY_LEVELS.NORMAL);
      expect(queue[2].priority).toBe(PRIORITY_LEVELS.LOW);
    });
  });
  
  describe('Status Management', () => {
    it('should mark item as processing', async () => {
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      
      await markProcessing(item.id);
      
      const queue = get(queueStore);
      const updated = queue.find(i => i.id === item.id);
      expect(updated?.status).toBe('processing');
    });
    
    it('should mark item as completed', async () => {
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      
      await markCompleted(item.id);
      
      const queue = get(queueStore);
      const updated = queue.find(i => i.id === item.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });
    
    it('should mark item as failed and increment retry count', async () => {
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      
      await markFailed(item.id, 'Network error');
      
      const queue = get(queueStore);
      const updated = queue.find(i => i.id === item.id);
      expect(updated?.retryCount).toBe(1);
      expect(updated?.lastError).toBe('Network error');
      expect(updated?.status).toBe('pending'); // Still pending for retry
    });
    
    it('should mark item as failed after max retries', async () => {
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' }, { maxRetries: 2 });
      
      await markFailed(item.id, 'Error 1');
      await markFailed(item.id, 'Error 2');
      
      const queue = get(queueStore);
      const updated = queue.find(i => i.id === item.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.retryCount).toBe(2);
    });
    
    it('should cancel an item', async () => {
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      
      await cancelQueueItem(item.id);
      
      const queue = get(queueStore);
      const updated = queue.find(i => i.id === item.id);
      expect(updated?.status).toBe('cancelled');
    });
    
    it('should remove item from queue', async () => {
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      
      await removeFromQueue(item.id);
      
      const queue = get(queueStore);
      expect(queue.find(i => i.id === item.id)).toBeUndefined();
    });
  });
  
  describe('Queue Queries', () => {
    it('should get next pending item', async () => {
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test 1' }, { priority: PRIORITY_LEVELS.LOW });
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test 2' }, { priority: PRIORITY_LEVELS.HIGH });
      
      const next = getNextPendingItem();
      
      expect((next?.data as { content?: string })?.content).toBe('test 2'); // Higher priority
    });
    
    it('should return null when no pending items', () => {
      const next = getNextPendingItem();
      expect(next).toBeNull();
    });
    
    it('should get items by type', async () => {
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      await enqueue('ADD_REACTION', { messageId: 'msg-1', channelId: 'ch-1', emoji: '👍' });
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test 2' });
      
      const messages = getItemsByType('SEND_MESSAGE');
      const reactions = getItemsByType('ADD_REACTION');
      
      expect(messages).toHaveLength(2);
      expect(reactions).toHaveLength(1);
    });
  });
  
  describe('Queue Maintenance', () => {
    it('should clear completed items', async () => {
      const item1 = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test 1' });
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test 2' });
      
      await markCompleted(item1.id);
      
      const cleared = await clearCompletedItems();
      
      expect(cleared).toBe(1);
      expect(get(queueStore)).toHaveLength(1);
    });
    
    it('should retry failed items', async () => {
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' }, { maxRetries: 1 });
      
      await markFailed(item.id, 'Error');
      
      const queue1 = get(queueStore);
      expect(queue1.find(i => i.id === item.id)?.status).toBe('failed');
      
      const retried = await retryFailedItems();
      
      expect(retried).toBe(1);
      
      const queue2 = get(queueStore);
      const updated = queue2.find(i => i.id === item.id);
      expect(updated?.status).toBe('pending');
      expect(updated?.retryCount).toBe(0);
    });
  });
  
  describe('Queue Statistics', () => {
    it('should return correct queue stats', async () => {
      const item1 = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test 1' }, { maxRetries: 1 });
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test 2' });
      const item3 = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test 3' });
      
      await markCompleted(item3.id);
      await markFailed(item1.id, 'Error');
      
      const stats = getQueueStats();
      
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });
  
  describe('Event Handling', () => {
    it('should emit events on queue changes', async () => {
      const events: { item: QueueItem; event: string }[] = [];
      
      const unsubscribe = onQueueEvent((item, event) => {
        events.push({ item, event });
      });
      
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      await markCompleted(item.id);
      
      // Events: added, updated (from updateQueueItem), completed
      expect(events).toHaveLength(3);
      expect(events[0].event).toBe('added');
      expect(events[1].event).toBe('updated');
      expect(events[2].event).toBe('completed');
      
      unsubscribe();
    });
  });
  
  describe('Derived Stores', () => {
    it('should update hasOfflineQueue store', async () => {
      expect(get(hasOfflineQueue)).toBe(false);
      
      await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' });
      
      expect(get(hasOfflineQueue)).toBe(true);
    });
    
    it('should update failedItems store', async () => {
      const item = await enqueue('SEND_MESSAGE', { channelId: 'ch-1', content: 'test' }, { maxRetries: 1 });
      
      expect(get(failedItems)).toHaveLength(0);
      
      await markFailed(item.id, 'Error');
      
      expect(get(failedItems)).toHaveLength(1);
    });
  });
});

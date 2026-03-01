/**
 * Sync Queue - Outbox queue for pending messages and actions
 * Manages offline operations with idempotency support
 */

import { browser } from '$app/environment';
import { writable, derived, type Readable, type Writable } from 'svelte/store';

/**
 * Generate a UUID v4 using crypto.randomUUID() with fallback
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Queue item types
export type QueueActionType = 
  | 'SEND_MESSAGE'
  | 'EDIT_MESSAGE'
  | 'DELETE_MESSAGE'
  | 'ADD_REACTION'
  | 'REMOVE_REACTION'
  | 'TYPING_INDICATOR';

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface QueueItem<T = unknown> {
  id: string;
  idempotencyKey: string;
  type: QueueActionType;
  data: T;
  timestamp: number;
  status: QueueItemStatus;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  completedAt?: number;
  priority: number; // Higher = more urgent
}

// Type-specific payloads
export interface SendMessagePayload {
  channelId: string;
  content: string;
  replyTo?: string;
  attachments?: string[];
  encrypted?: boolean;
  tempId?: string; // Client-side temp ID for optimistic UI
}

export interface EditMessagePayload {
  messageId: string;
  channelId: string;
  content: string;
}

export interface DeleteMessagePayload {
  messageId: string;
  channelId: string;
}

export interface ReactionPayload {
  messageId: string;
  channelId: string;
  emoji: string;
}

export interface TypingPayload {
  channelId: string;
}

// Queue configuration
const MAX_QUEUE_SIZE = 1000;
const DEFAULT_MAX_RETRIES = 5;
const PRIORITY_LEVELS = {
  HIGH: 3,
  NORMAL: 2,
  LOW: 1
};

// IndexedDB for persistent queue
const DB_NAME = 'hearth-sync';
const DB_VERSION = 2;
const QUEUE_STORE = 'outbox-queue';

let db: IDBDatabase | null = null;

/**
 * Open IndexedDB for queue persistence
 */
async function openQueueDB(): Promise<IDBDatabase> {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // Create outbox queue store if it doesn't exist
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        const store = database.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        store.createIndex('priority', 'priority', { unique: false });
      }
    };
  });
}

// Internal store
const queueStore: Writable<QueueItem[]> = writable([]);

// Derived stores
export const pendingItems: Readable<QueueItem[]> = derived(
  queueStore,
  $queue => $queue.filter(item => item.status === 'pending')
);

export const processingItems: Readable<QueueItem[]> = derived(
  queueStore,
  $queue => $queue.filter(item => item.status === 'processing')
);

export const failedItems: Readable<QueueItem[]> = derived(
  queueStore,
  $queue => $queue.filter(item => item.status === 'failed')
);

export const pendingCount: Readable<number> = derived(
  pendingItems,
  $pending => $pending.length
);

export const hasOfflineQueue: Readable<boolean> = derived(
  pendingCount,
  $count => $count > 0
);

// Event emitter for queue changes
type QueueEventType = 'added' | 'updated' | 'removed' | 'completed' | 'failed';
type QueueEventHandler = (item: QueueItem, event: QueueEventType) => void;
const eventHandlers: Set<QueueEventHandler> = new Set();

/**
 * Subscribe to queue events
 */
export function onQueueEvent(handler: QueueEventHandler): () => void {
  eventHandlers.add(handler);
  return () => eventHandlers.delete(handler);
}

function emitQueueEvent(item: QueueItem, event: QueueEventType): void {
  eventHandlers.forEach(handler => {
    try {
      handler(item, event);
    } catch (e) {
      console.error('[SyncQueue] Event handler error:', e);
    }
  });
}

/**
 * Generate idempotency key for an action
 */
export function generateIdempotencyKey(type: QueueActionType, data: unknown): string {
  // Use UUID v4 as base, but include type for debugging
  return `${type}-${generateUUID()}`;
}

/**
 * Create a stable idempotency key for duplicate detection
 */
export function createStableIdempotencyKey(type: QueueActionType, data: Record<string, unknown>): string {
  // Create a hash-like key from the action data
  const keyData = JSON.stringify({ type, ...data });
  let hash = 0;
  for (let i = 0; i < keyData.length; i++) {
    const char = keyData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${type}-${Math.abs(hash).toString(36)}-${Date.now()}`;
}

/**
 * Load queue from IndexedDB
 */
async function loadQueue(): Promise<QueueItem[]> {
  if (!browser) return [];
  
  try {
    const database = await openQueueDB();
    const tx = database.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const items = (request.result || []) as QueueItem[];
        // Filter out old completed items
        const active = items.filter(
          item => item.status !== 'completed' || 
                  (Date.now() - (item.completedAt || 0)) < 300000 // Keep completed for 5 min
        );
        resolve(active);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SyncQueue] Failed to load queue:', error);
    return [];
  }
}

/**
 * Persist queue item to IndexedDB
 */
async function persistQueueItem(item: QueueItem): Promise<void> {
  if (!browser) return;
  
  try {
    const database = await openQueueDB();
    const tx = database.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SyncQueue] Failed to persist item:', error);
  }
}

/**
 * Remove item from IndexedDB
 */
async function removePersistedItem(id: string): Promise<void> {
  if (!browser) return;
  
  try {
    const database = await openQueueDB();
    const tx = database.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SyncQueue] Failed to remove item:', error);
  }
}

/**
 * Check for duplicate idempotency key
 */
async function hasDuplicateKey(key: string): Promise<boolean> {
  if (!browser) return false;
  
  try {
    const database = await openQueueDB();
    const tx = database.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const index = store.index('idempotencyKey');
    
    return new Promise((resolve, reject) => {
      const request = index.get(key);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return false;
  }
}

/**
 * Initialize the queue from storage
 */
export async function initQueue(): Promise<void> {
  if (!browser) return;
  
  const items = await loadQueue();
  
  // Reset any items that were processing (interrupted by page close)
  const resetItems = items.map(item => 
    item.status === 'processing' ? { ...item, status: 'pending' as QueueItemStatus } : item
  );
  
  queueStore.set(resetItems);
  
  // Persist reset items
  for (const item of resetItems.filter(i => i.status === 'pending')) {
    await persistQueueItem(item);
  }
}

/**
 * Add item to the queue
 */
export async function enqueue<T>(
  type: QueueActionType,
  data: T,
  options: {
    idempotencyKey?: string;
    priority?: number;
    maxRetries?: number;
  } = {}
): Promise<QueueItem<T>> {
  const idempotencyKey = options.idempotencyKey || generateIdempotencyKey(type, data);
  
  // Check for duplicates
  if (await hasDuplicateKey(idempotencyKey)) {
    throw new Error(`Duplicate action with key: ${idempotencyKey}`);
  }
  
  const item: QueueItem<T> = {
    id: generateUUID(),
    idempotencyKey,
    type,
    data,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    priority: options.priority ?? PRIORITY_LEVELS.NORMAL
  };
  
  // Check queue size
  let currentQueue: QueueItem[] = [];
  queueStore.subscribe(q => currentQueue = q)();
  
  if (currentQueue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest completed/cancelled items
    const toRemove = currentQueue
      .filter(i => i.status === 'completed' || i.status === 'cancelled')
      .sort((a, b) => a.timestamp - b.timestamp);
    
    for (const old of toRemove.slice(0, Math.ceil(MAX_QUEUE_SIZE / 10))) {
      await removePersistedItem(old.id);
    }
  }
  
  // Add to store
  queueStore.update(queue => {
    const filtered = queue.filter(
      i => i.status !== 'completed' && i.status !== 'cancelled'
    );
    return [...filtered, item].sort((a, b) => b.priority - a.priority);
  });
  
  // Persist
  await persistQueueItem(item);
  
  emitQueueEvent(item, 'added');
  
  return item;
}

/**
 * Update item status
 */
export async function updateQueueItem(
  id: string,
  updates: Partial<QueueItem>
): Promise<QueueItem | null> {
  let updatedItem: QueueItem | null = null;
  
  queueStore.update(queue => {
    return queue.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates };
        return updatedItem;
      }
      return item;
    });
  });
  
  if (updatedItem) {
    await persistQueueItem(updatedItem);
    emitQueueEvent(updatedItem, 'updated');
  }
  
  return updatedItem;
}

/**
 * Mark item as processing
 */
export async function markProcessing(id: string): Promise<void> {
  await updateQueueItem(id, { status: 'processing' });
}

/**
 * Mark item as completed
 */
export async function markCompleted(id: string): Promise<void> {
  const item = await updateQueueItem(id, { 
    status: 'completed',
    completedAt: Date.now()
  });
  
  if (item) {
    emitQueueEvent(item, 'completed');
  }
}

/**
 * Mark item as failed
 */
export async function markFailed(id: string, error: string): Promise<void> {
  let foundItem: QueueItem | undefined;

  queueStore.subscribe(queue => {
    foundItem = queue.find(i => i.id === id);
  })();

  if (foundItem) {
    const currentItem = foundItem;
    const newRetryCount = currentItem.retryCount + 1;
    const shouldFail = newRetryCount >= currentItem.maxRetries;
    
    const item = await updateQueueItem(id, {
      status: shouldFail ? 'failed' : 'pending',
      retryCount: newRetryCount,
      lastError: error
    });
    
    if (item && shouldFail) {
      emitQueueEvent(item, 'failed');
    }
  }
}

/**
 * Cancel an item
 */
export async function cancelQueueItem(id: string): Promise<void> {
  await updateQueueItem(id, { status: 'cancelled' });
}

/**
 * Remove item from queue
 */
export async function removeFromQueue(id: string): Promise<void> {
  let removedItem: QueueItem | null = null;
  
  queueStore.update(queue => {
    const index = queue.findIndex(i => i.id === id);
    if (index >= 0) {
      removedItem = queue[index];
      return [...queue.slice(0, index), ...queue.slice(index + 1)];
    }
    return queue;
  });
  
  await removePersistedItem(id);
  
  if (removedItem) {
    emitQueueEvent(removedItem, 'removed');
  }
}

/**
 * Get next item to process
 */
export function getNextPendingItem(): QueueItem | null {
  let next: QueueItem | null = null;
  
  queueStore.subscribe(queue => {
    const pending = queue
      .filter(item => item.status === 'pending')
      .sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
    next = pending[0] || null;
  })();
  
  return next;
}

/**
 * Get all items of a specific type
 */
export function getItemsByType(type: QueueActionType): QueueItem[] {
  let items: QueueItem[] = [];
  
  queueStore.subscribe(queue => {
    items = queue.filter(item => item.type === type);
  })();
  
  return items;
}

/**
 * Clear completed items
 */
export async function clearCompletedItems(): Promise<number> {
  let count = 0;
  let completedIds: string[] = [];
  
  queueStore.update(queue => {
    completedIds = queue
      .filter(i => i.status === 'completed' || i.status === 'cancelled')
      .map(i => i.id);
    count = completedIds.length;
    return queue.filter(i => i.status !== 'completed' && i.status !== 'cancelled');
  });
  
  for (const id of completedIds) {
    await removePersistedItem(id);
  }
  
  return count;
}

/**
 * Retry failed items
 */
export async function retryFailedItems(): Promise<number> {
  let count = 0;
  let failedIds: string[] = [];
  
  queueStore.subscribe(queue => {
    failedIds = queue
      .filter(i => i.status === 'failed')
      .map(i => i.id);
    count = failedIds.length;
  })();
  
  for (const id of failedIds) {
    await updateQueueItem(id, { 
      status: 'pending',
      retryCount: 0,
      lastError: undefined
    });
  }
  
  return count;
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
} {
  const stats = {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  };
  
  queueStore.subscribe(queue => {
    stats.total = queue.length;
    stats.pending = queue.filter(i => i.status === 'pending').length;
    stats.processing = queue.filter(i => i.status === 'processing').length;
    stats.completed = queue.filter(i => i.status === 'completed').length;
    stats.failed = queue.filter(i => i.status === 'failed').length;
    stats.cancelled = queue.filter(i => i.status === 'cancelled').length;
  })();
  
  return stats;
}

/**
 * Clear all items from the queue
 */
export async function clearAllItems(): Promise<number> {
	let count = 0;
	let allIds: string[] = [];

	queueStore.update(queue => {
		allIds = queue.map(i => i.id);
		count = allIds.length;
		return [];
	});

	for (const id of allIds) {
		await removePersistedItem(id);
	}

	return count;
}

// Export store for direct subscription
export { queueStore };

// Export priority constants
export { PRIORITY_LEVELS };

/**
 * Sync Engine - Background sync scheduling and conflict resolution
 * Orchestrates the offline sync process
 */

import { browser } from '$app/environment';
import { writable, derived, type Readable, type Writable } from 'svelte/store';
import { 
  queueStore, 
  pendingItems,
  markProcessing, 
  markCompleted, 
  markFailed,
  getNextPendingItem,
  type QueueItem,
  type QueueActionType,
  type SendMessagePayload,
  type EditMessagePayload,
  type DeleteMessagePayload,
  type ReactionPayload,
  type TypingPayload
} from './syncQueue';
import { onlineStatus } from '$lib/stores/onlineStatus';
import { api, ApiError } from '$lib/api';
import { 
  storeMessage, 
  markMessageSynced,
  getUnsyncedMessages 
} from './offlineStorage';
import { onServiceWorkerMessage, requestSyncProcess } from './serviceWorkerRegistration';

// Sync engine state
export type SyncState = 'idle' | 'syncing' | 'paused' | 'error';

export interface SyncEngineStatus {
  state: SyncState;
  lastSyncAt: number | null;
  lastError: string | null;
  isOnline: boolean;
  pendingCount: number;
  processingCount: number;
}

// Sync configuration
const SYNC_INTERVAL = 5000; // 5 seconds
const RETRY_BACKOFF_BASE = 1000; // 1 second
const MAX_RETRY_BACKOFF = 60000; // 1 minute
const BATCH_SIZE = 10;
const CONFLICT_RESOLUTION_DELAY = 100;

// Internal state
let syncInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;
let retryBackoff = RETRY_BACKOFF_BASE;

// Stores
const statusStore: Writable<SyncEngineStatus> = writable({
  state: 'idle',
  lastSyncAt: null,
  lastError: null,
  isOnline: true,
  pendingCount: 0,
  processingCount: 0
});

export const syncEngineStatus: Readable<SyncEngineStatus> = statusStore;

// Derived sync state
export const isSyncing: Readable<boolean> = derived(
  statusStore,
  $status => $status.state === 'syncing'
);

export const hasSyncErrors: Readable<boolean> = derived(
  statusStore,
  $status => $status.state === 'error' || $status.lastError !== null
);

// Sync handlers for each action type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SyncHandler = (item: QueueItem<any>) => Promise<{ success: boolean; error?: string; data?: unknown }>;

const syncHandlers: Partial<Record<QueueActionType, SyncHandler>> = {
  SEND_MESSAGE: async (item: QueueItem<SendMessagePayload>) => {
    const payload = item.data;
    
    try {
      // Include idempotency key in request
      const response = await api.post<{ id: string; created_at: string }>(
        `/channels/${payload.channelId}/messages`,
        {
          content: payload.content,
          reply_to: payload.replyTo,
          idempotency_key: item.idempotencyKey
        }
      );
      
      // Update local storage with real message ID
      if (payload.tempId) {
        await markMessageSynced(payload.tempId);
      }
      
      return { success: true, data: response };
    } catch (error) {
      if (error instanceof ApiError) {
        // Check for duplicate (already processed)
        if (error.status === 409) {
          // Conflict - message already sent with this idempotency key
          return { success: true, data: { duplicate: true } };
        }
        
        // Client errors shouldn't be retried
        if (error.status >= 400 && error.status < 500 && error.status !== 408) {
          return { success: false, error: error.message };
        }
      }
      
      throw error;
    }
  },
  
  EDIT_MESSAGE: async (item: QueueItem<EditMessagePayload>) => {
    const payload = item.data;
    
    try {
      await api.patch(
        `/channels/${payload.channelId}/messages/${payload.messageId}`,
        { content: payload.content }
      );
      
      return { success: true };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Message was deleted - mark as success (nothing to edit)
        return { success: true, data: { notFound: true } };
      }
      throw error;
    }
  },
  
  DELETE_MESSAGE: async (item: QueueItem<DeleteMessagePayload>) => {
    const payload = item.data;
    
    try {
      await api.delete(`/channels/${payload.channelId}/messages/${payload.messageId}`);
      return { success: true };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already deleted
        return { success: true };
      }
      throw error;
    }
  },
  
  ADD_REACTION: async (item: QueueItem<ReactionPayload>) => {
    const payload = item.data;
    
    try {
      await api.post(`/messages/${payload.messageId}/reactions`, {
        emoji: payload.emoji
      });
      return { success: true };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Message was deleted
        return { success: false, error: 'Message not found' };
      }
      throw error;
    }
  },
  
  REMOVE_REACTION: async (item: QueueItem<ReactionPayload>) => {
    const payload = item.data;
    
    try {
      await api.delete(
        `/messages/${payload.messageId}/reactions/${encodeURIComponent(payload.emoji)}`
      );
      return { success: true };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already removed or message deleted
        return { success: true };
      }
      throw error;
    }
  },
  
  TYPING_INDICATOR: async (item: QueueItem<TypingPayload>) => {
    // Typing indicators are ephemeral - if offline, just skip
    const payload = item.data;
    
    // Check if indicator is still relevant (within last 10 seconds)
    if (Date.now() - item.timestamp > 10000) {
      return { success: true, data: { stale: true } };
    }
    
    try {
      await api.post(`/channels/${payload.channelId}/typing`);
      return { success: true };
    } catch {
      // Typing failures are not critical
      return { success: true };
    }
  }
};

/**
 * Process a single queue item
 */
async function processQueueItem(item: QueueItem): Promise<boolean> {
  const handler = syncHandlers[item.type];
  
  if (!handler) {
    console.warn(`[SyncEngine] No handler for action type: ${item.type}`);
    await markCompleted(item.id);
    return true;
  }
  
  try {
    await markProcessing(item.id);
    
    const result = await handler(item as QueueItem<unknown>);
    
    if (result.success) {
      await markCompleted(item.id);
      return true;
    } else {
      await markFailed(item.id, result.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Network errors should trigger retry
    if (error instanceof TypeError && error.message.includes('fetch')) {
      await markFailed(item.id, 'Network error');
      statusStore.update(s => ({ ...s, isOnline: false }));
    } else {
      await markFailed(item.id, message);
    }
    
    return false;
  }
}

/**
 * Process pending queue items
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  
  // Check if online
  let online = true;
  onlineStatus.subscribe(s => online = s.isOnline)();
  
  if (!online) {
    statusStore.update(s => ({ ...s, state: 'paused', isOnline: false }));
    return;
  }
  
  isProcessing = true;
  statusStore.update(s => ({ ...s, state: 'syncing', isOnline: true }));
  
  let processed = 0;
  let failed = 0;
  
  try {
    // Process up to BATCH_SIZE items
    while (processed < BATCH_SIZE) {
      const item = getNextPendingItem();
      
      if (!item) break;
      
      const success = await processQueueItem(item);
      
      if (success) {
        processed++;
        retryBackoff = RETRY_BACKOFF_BASE; // Reset backoff on success
      } else {
        failed++;
        // Exponential backoff on failures
        retryBackoff = Math.min(retryBackoff * 2, MAX_RETRY_BACKOFF);
        
        // Add delay to avoid hammering failing endpoints
        await new Promise(r => setTimeout(r, CONFLICT_RESOLUTION_DELAY));
      }
    }
    
    // Update status
    let pendingCount = 0;
    let processingCount = 0;
    
    queueStore.subscribe(queue => {
      pendingCount = queue.filter(i => i.status === 'pending').length;
      processingCount = queue.filter(i => i.status === 'processing').length;
    })();
    
    statusStore.update(s => ({
      ...s,
      state: pendingCount > 0 ? 'syncing' : 'idle',
      lastSyncAt: Date.now(),
      lastError: failed > 0 ? `${failed} items failed to sync` : null,
      pendingCount,
      processingCount
    }));
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    statusStore.update(s => ({
      ...s,
      state: 'error',
      lastError: message
    }));
  } finally {
    isProcessing = false;
  }
}

/**
 * Sync unsynced messages from offline storage
 */
async function syncOfflineMessages(): Promise<void> {
  try {
    const unsyncedMessages = await getUnsyncedMessages();
    
    for (const message of unsyncedMessages) {
      try {
        // Re-send the message
        await api.post(`/channels/${message.channel_id}/messages`, {
          content: message.content,
          idempotency_key: `msg-${message.id}`
        });
        
        await markMessageSynced(message.id);
      } catch (error) {
        console.error('[SyncEngine] Failed to sync message:', message.id, error);
      }
    }
  } catch (error) {
    console.error('[SyncEngine] Failed to sync offline messages:', error);
  }
}

/**
 * Handle service worker sync completion
 */
function handleServiceWorkerSync(_data: unknown): void {
  console.log('[SyncEngine] Service worker sync complete:', _data);
  
  // Refresh our queue state
  processQueue();
}

/**
 * Start the sync engine
 */
export function startSyncEngine(): void {
  if (!browser) return;
  
  if (syncInterval) {
    console.warn('[SyncEngine] Already running');
    return;
  }
  
  console.log('[SyncEngine] Starting...');
  
  // Listen for online status changes
  onlineStatus.subscribe(status => {
    statusStore.update(s => ({ ...s, isOnline: status.isOnline }));
    
    if (status.isOnline) {
      // Trigger immediate sync when coming online
      processQueue();
    }
  });
  
  // Listen for queue changes
  pendingItems.subscribe(items => {
    statusStore.update(s => ({ ...s, pendingCount: items.length }));
    
    // Trigger sync if we have pending items
    if (items.length > 0) {
      processQueue();
    }
  });
  
  // Listen for service worker sync events
  onServiceWorkerMessage('SYNC_COMPLETE', handleServiceWorkerSync);
  
  // Start periodic sync
  syncInterval = setInterval(() => {
    processQueue();
  }, SYNC_INTERVAL);
  
  // Initial sync
  processQueue();
  
  // Also sync any offline messages
  syncOfflineMessages();
}

/**
 * Stop the sync engine
 */
export function stopSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  statusStore.update(s => ({ ...s, state: 'idle' }));
  console.log('[SyncEngine] Stopped');
}

/**
 * Pause syncing (e.g., for battery saving)
 */
export function pauseSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  statusStore.update(s => ({ ...s, state: 'paused' }));
}

/**
 * Resume syncing
 */
export function resumeSyncEngine(): void {
  if (!syncInterval && browser) {
    syncInterval = setInterval(processQueue, SYNC_INTERVAL);
    processQueue(); // Immediate sync
    statusStore.update(s => ({ ...s, state: 'syncing' }));
  }
}

/**
 * Force an immediate sync
 */
export function forcSync(): void {
  // Request service worker to process sync queue
  requestSyncProcess();
  
  // Also process our local queue
  processQueue();
}

/**
 * Register a custom sync handler
 */
export function registerSyncHandler(
  type: QueueActionType,
  handler: SyncHandler
): void {
  syncHandlers[type] = handler;
}

/**
 * Conflict resolution strategies
 */
export type ConflictStrategy = 'server-wins' | 'client-wins' | 'merge' | 'manual';

export interface ConflictInfo {
  itemId: string;
  type: QueueActionType;
  localData: unknown;
  serverData: unknown;
}

// Conflict handlers
type ConflictHandler = (conflict: ConflictInfo) => Promise<'local' | 'server' | 'merge' | unknown>;
let conflictHandler: ConflictHandler | null = null;

/**
 * Set custom conflict handler
 */
export function setConflictHandler(handler: ConflictHandler): void {
  conflictHandler = handler;
}

/**
 * Handle a sync conflict
 */
export async function handleConflict(conflict: ConflictInfo): Promise<void> {
  if (conflictHandler) {
    try {
      const resolution = await conflictHandler(conflict);
      console.log('[SyncEngine] Conflict resolved:', resolution);
    } catch (error) {
      console.error('[SyncEngine] Conflict handler error:', error);
    }
  } else {
    // Default: server wins
    console.log('[SyncEngine] Conflict - server wins (default)');
  }
}

/**
 * Get sync engine statistics
 */
export function getSyncStats(): {
  state: SyncState;
  lastSync: Date | null;
  uptime: number | null;
  totalSynced: number;
  totalFailed: number;
} {
  let status: SyncEngineStatus = {
    state: 'idle',
    lastSyncAt: null,
    lastError: null,
    isOnline: true,
    pendingCount: 0,
    processingCount: 0
  };
  
  statusStore.subscribe(s => status = s)();
  
  return {
    state: status.state,
    lastSync: status.lastSyncAt ? new Date(status.lastSyncAt) : null,
    uptime: syncInterval ? Date.now() - (status.lastSyncAt || Date.now()) : null,
    totalSynced: 0, // Would need additional tracking
    totalFailed: 0
  };
}

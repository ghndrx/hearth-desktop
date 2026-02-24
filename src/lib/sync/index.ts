/**
 * Sync Module - Exports for offline sync functionality
 */

// Service Worker
export {
  registerServiceWorker,
  initServiceWorker,
  serviceWorkerStatus,
  serviceWorkerMessages,
  checkForUpdates,
  skipWaitingAndReload,
  unregisterServiceWorker,
  sendToServiceWorker,
  onServiceWorkerMessage,
  requestSyncProcess,
  requestSyncQueue,
  clearServiceWorkerCache,
  preCacheUrls,
  type ServiceWorkerState,
  type ServiceWorkerStatus
} from './serviceWorkerRegistration';

// Offline Storage
export {
  openDatabase,
  closeDatabase,
  isIndexedDBAvailable,
  // Messages
  storeMessage,
  storeMessages,
  getMessage,
  getChannelMessages,
  getUnsyncedMessages,
  markMessageSynced,
  deleteMessage,
  pruneMessages,
  // Channels
  storeChannel,
  storeChannels,
  getChannel,
  getAllChannels,
  getServerChannels,
  deleteChannel,
  // Users
  storeUser,
  storeUsers,
  getUser,
  getAllUsers,
  // Servers
  storeServer,
  storeServers,
  getServer,
  getAllServers,
  // Metadata
  setMetadata,
  getMetadata,
  deleteMetadata,
  // Utilities
  clearAllOfflineData,
  getStorageStats,
  STORES,
  type StoredMessage,
  type StoredChannel,
  type StoredUser,
  type StoredServer,
  type StorageMetadata
} from './offlineStorage';

// Sync Queue
export {
  initQueue,
  enqueue,
  updateQueueItem,
  markProcessing,
  markCompleted,
  markFailed,
  cancelQueueItem,
  removeFromQueue,
  getNextPendingItem,
  getItemsByType,
  clearCompletedItems,
  retryFailedItems,
  getQueueStats,
  onQueueEvent,
  generateIdempotencyKey,
  createStableIdempotencyKey,
  queueStore,
  pendingItems,
  processingItems,
  failedItems,
  pendingCount,
  hasOfflineQueue,
  PRIORITY_LEVELS,
  type QueueItem,
  type QueueActionType,
  type QueueItemStatus,
  type SendMessagePayload,
  type EditMessagePayload,
  type DeleteMessagePayload,
  type ReactionPayload,
  type TypingPayload
} from './syncQueue';

// Sync Engine
export {
  startSyncEngine,
  stopSyncEngine,
  pauseSyncEngine,
  resumeSyncEngine,
  forcSync,
  registerSyncHandler,
  setConflictHandler,
  handleConflict,
  getSyncStats,
  syncEngineStatus,
  isSyncing,
  hasSyncErrors,
  type SyncState,
  type SyncEngineStatus,
  type ConflictStrategy,
  type ConflictInfo
} from './syncEngine';

// API Integration
export {
  initApiIntegration,
  queueMessageEdit,
  queueMessageDelete,
  queueAddReaction,
  queueRemoveReaction,
  queueTypingIndicator
} from './apiIntegration';

// Convenience function to initialize all sync functionality
import { browser } from '$app/environment';
import { initServiceWorker } from './serviceWorkerRegistration';
import { initQueue } from './syncQueue';
import { startSyncEngine } from './syncEngine';
import { initApiIntegration } from './apiIntegration';

/**
 * Initialize all sync functionality
 * Call this once on app startup
 */
export async function initSync(): Promise<void> {
  if (!browser) return;
  
  console.log('[Sync] Initializing offline sync...');
  
  try {
    // Initialize service worker
    initServiceWorker();
    
    // Initialize sync queue
    await initQueue();
    
    // Initialize API integration (connects queue with api.ts)
    initApiIntegration();
    
    // Start sync engine
    startSyncEngine();
    
    console.log('[Sync] Offline sync initialized');
  } catch (error) {
    console.error('[Sync] Failed to initialize:', error);
  }
}

/**
 * Sync Status Store - Sync progress and pending items count
 * Aggregates status from sync engine and queue for UI consumption
 */

import { browser } from '$app/environment';
import { writable, derived, type Readable } from 'svelte/store';
import { queueStore, type QueueItem } from '$lib/sync/syncQueue';
import { syncEngineStatus } from '$lib/sync/syncEngine';
import { serviceWorkerStatus } from '$lib/sync/serviceWorkerRegistration';
import { onlineStatus } from './onlineStatus';

/**
 * Combined sync status for UI display
 */
export interface SyncStatus {
  // Overall state
  state: SyncStatusState;
  message: string;
  
  // Queue stats
  pendingCount: number;
  failedCount: number;
  processingCount: number;
  
  // Online status
  isOnline: boolean;
  wasOffline: boolean;
  
  // Service worker status
  serviceWorkerState: string;
  updateAvailable: boolean;
  
  // Timestamps
  lastSyncAt: number | null;
  lastOnlineAt: number | null;
  
  // Progress (for batch operations)
  progress: number | null; // 0-100
  
  // Recent failed items
  recentFailures: QueueItem[];
}

export type SyncStatusState = 
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'pending'
  | 'success';

// Create derived store that combines all sync-related state
export const syncStatus: Readable<SyncStatus> = derived(
  [queueStore, syncEngineStatus, serviceWorkerStatus, onlineStatus],
  ([$queue, $engine, $sw, $online]) => {
    const pending = $queue.filter(i => i.status === 'pending').length;
    const failed = $queue.filter(i => i.status === 'failed').length;
    const processing = $queue.filter(i => i.status === 'processing').length;
    
    // Determine overall state
    let state: SyncStatusState = 'idle';
    let message = '';
    
    if (!$online.isOnline) {
      state = 'offline';
      message = 'You are offline. Changes will sync when reconnected.';
    } else if (failed > 0) {
      state = 'error';
      message = `${failed} item${failed === 1 ? '' : 's'} failed to sync`;
    } else if (processing > 0 || $engine.state === 'syncing') {
      state = 'syncing';
      message = processing > 1 
        ? `Syncing ${processing} items...`
        : 'Syncing...';
    } else if (pending > 0) {
      state = 'pending';
      message = `${pending} item${pending === 1 ? '' : 's'} waiting to sync`;
    } else if ($online.wasOffline) {
      state = 'success';
      message = 'Back online! All changes synced.';
    } else {
      state = 'idle';
      message = '';
    }
    
    // Calculate progress for batch operations
    const total = pending + processing + failed;
    const completed = $queue.filter(i => i.status === 'completed').length;
    const progress = total > 0 ? Math.round((completed / (total + completed)) * 100) : null;
    
    // Get recent failures
    const recentFailures = $queue
      .filter(i => i.status === 'failed')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
    
    return {
      state,
      message,
      pendingCount: pending,
      failedCount: failed,
      processingCount: processing,
      isOnline: $online.isOnline,
      wasOffline: $online.wasOffline,
      serviceWorkerState: $sw.state,
      updateAvailable: $sw.updateAvailable,
      lastSyncAt: $engine.lastSyncAt,
      lastOnlineAt: $online.lastOnlineAt,
      progress,
      recentFailures
    };
  }
);

// Convenience derived stores
export const hasPendingSync: Readable<boolean> = derived(
  syncStatus,
  $status => $status.pendingCount > 0 || $status.processingCount > 0
);

export const hasSyncErrors: Readable<boolean> = derived(
  syncStatus,
  $status => $status.failedCount > 0
);

export const syncMessage: Readable<string> = derived(
  syncStatus,
  $status => $status.message
);

export const showSyncIndicator: Readable<boolean> = derived(
  syncStatus,
  $status => $status.state !== 'idle' && $status.state !== 'success'
);

export const syncIndicatorType: Readable<'info' | 'warning' | 'error' | 'success'> = derived(
  syncStatus,
  $status => {
    switch ($status.state) {
      case 'offline':
        return 'warning';
      case 'error':
        return 'error';
      case 'success':
        return 'success';
      default:
        return 'info';
    }
  }
);

/**
 * Notification preferences for sync events
 */
export interface SyncNotificationPrefs {
  notifyOnSync: boolean;
  notifyOnError: boolean;
  notifyOnReconnect: boolean;
  showToasts: boolean;
  playSound: boolean;
}

const defaultPrefs: SyncNotificationPrefs = {
  notifyOnSync: false,
  notifyOnError: true,
  notifyOnReconnect: true,
  showToasts: true,
  playSound: false
};

const prefsStore = writable<SyncNotificationPrefs>(defaultPrefs);

/**
 * Load notification preferences from localStorage
 */
export function loadSyncNotificationPrefs(): void {
  if (!browser) return;
  
  try {
    const stored = localStorage.getItem('hearth-sync-prefs');
    if (stored) {
      const prefs = JSON.parse(stored);
      prefsStore.set({ ...defaultPrefs, ...prefs });
    }
  } catch (e) {
    console.error('[SyncStatus] Failed to load preferences:', e);
  }
}

/**
 * Save notification preferences to localStorage
 */
export function saveSyncNotificationPrefs(prefs: Partial<SyncNotificationPrefs>): void {
  if (!browser) return;
  
  prefsStore.update(current => {
    const updated = { ...current, ...prefs };
    try {
      localStorage.setItem('hearth-sync-prefs', JSON.stringify(updated));
    } catch (e) {
      console.error('[SyncStatus] Failed to save preferences:', e);
    }
    return updated;
  });
}

export const syncNotificationPrefs: Readable<SyncNotificationPrefs> = prefsStore;

/**
 * Format time ago for display
 */
export function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return 'never';
  
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Get a human-readable sync status description
 */
export function getSyncStatusDescription(status: SyncStatus): string {
  if (!status.isOnline) {
    return 'You are currently offline. Your changes will be saved locally and synced when you reconnect.';
  }
  
  if (status.failedCount > 0) {
    return `${status.failedCount} sync operation${status.failedCount === 1 ? '' : 's'} failed. You can retry them from settings.`;
  }
  
  if (status.processingCount > 0) {
    return `Currently syncing ${status.processingCount} item${status.processingCount === 1 ? '' : 's'}...`;
  }
  
  if (status.pendingCount > 0) {
    return `${status.pendingCount} item${status.pendingCount === 1 ? '' : 's'} waiting to be synced.`;
  }
  
  if (status.lastSyncAt) {
    return `Last synced ${formatTimeAgo(status.lastSyncAt)}.`;
  }
  
  return 'All data is synchronized.';
}

// Auto-load preferences on module load
if (browser) {
  loadSyncNotificationPrefs();
}

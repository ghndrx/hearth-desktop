/**
 * TypeScript API client for the Rust notification manager backend.
 * Provides typed wrappers around Tauri invoke commands.
 */
import { invoke } from '@tauri-apps/api/core';
import { browser } from '$app/environment';
import type {
  NotificationData,
  NotificationCategory,
  NotificationPriority
} from './types.js';

// --- Backend types (matching Rust serde output) ---

export interface BackendNotificationStats {
  pendingCount: number;
  pendingByCategory: Record<string, number>;
  batchesPending: number;
  totalSent: number;
  totalBatched: number;
}

export interface BackendCategorySettings {
  enabled: boolean;
  priority: NotificationPriority;
  sound: boolean;
  batchingEnabled: boolean;
  batchDelayMs: number;
}

export interface BackendQuietHoursSettings {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface BackendNotificationSettings {
  enabled: boolean;
  categories: Record<string, BackendCategorySettings>;
  quietHours: BackendQuietHoursSettings;
  maxBatchSize: number;
  batchingDelayMs: number;
}

export type QueueResult =
  | 'sentImmediately'
  | 'queued'
  | 'disabled'
  | 'categoryDisabled'
  | 'quietHours';

// --- Backend notification data (camelCase to match Rust serde) ---

interface BackendNotificationData {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  timestamp: number;
  sourceId?: string;
  userId?: string;
  serverId?: string;
  channelId?: string;
  actions?: { id: string; title: string; actionTypeId?: string }[];
  icon?: string;
  sound: boolean;
  persistent: boolean;
  expiresAt?: number;
}

function toBackendNotification(data: NotificationData): BackendNotificationData {
  return {
    id: data.id,
    title: data.title,
    body: data.body,
    category: data.category,
    priority: data.priority,
    timestamp: data.timestamp,
    sourceId: data.sourceId,
    userId: data.userId,
    serverId: data.serverId,
    channelId: data.channelId,
    actions: data.actions,
    icon: data.icon,
    sound: data.sound ?? false,
    persistent: data.persistent ?? false,
    expiresAt: data.expiresAt
  };
}

// --- API Client ---

/**
 * Queue a notification through the Rust notification manager.
 * The backend handles batching and priority queuing automatically.
 */
export async function queueNotification(notification: NotificationData): Promise<QueueResult> {
  if (!browser) return 'disabled';

  try {
    return await invoke<QueueResult>('queue_notification', {
      notification: toBackendNotification(notification)
    });
  } catch (error) {
    console.error('Failed to queue notification via backend:', error);
    throw error;
  }
}

/**
 * Manually flush ready notifications (the backend also runs a periodic flush).
 */
export async function flushNotifications(): Promise<number> {
  if (!browser) return 0;

  try {
    return await invoke<number>('flush_notifications');
  } catch (error) {
    console.error('Failed to flush notifications:', error);
    throw error;
  }
}

/**
 * Get notification manager statistics from the backend.
 */
export async function getNotificationStats(): Promise<BackendNotificationStats> {
  if (!browser) {
    return {
      pendingCount: 0,
      pendingByCategory: {},
      batchesPending: 0,
      totalSent: 0,
      totalBatched: 0
    };
  }

  try {
    return await invoke<BackendNotificationStats>('get_notification_stats');
  } catch (error) {
    console.error('Failed to get notification stats:', error);
    throw error;
  }
}

/**
 * Update notification settings in the backend.
 */
export async function updateBackendSettings(settings: BackendNotificationSettings): Promise<void> {
  if (!browser) return;

  try {
    await invoke('update_notification_settings', { settings });
  } catch (error) {
    console.error('Failed to update notification settings:', error);
    throw error;
  }
}

/**
 * Get current notification settings from the backend.
 */
export async function getBackendSettings(): Promise<BackendNotificationSettings> {
  if (!browser) {
    return {
      enabled: true,
      categories: {},
      quietHours: { enabled: false, startHour: 22, startMinute: 0, endHour: 8, endMinute: 0 },
      maxBatchSize: 5,
      batchingDelayMs: 2000
    };
  }

  try {
    return await invoke<BackendNotificationSettings>('get_notification_settings');
  } catch (error) {
    console.error('Failed to get notification settings:', error);
    throw error;
  }
}

/**
 * Clear all pending notifications in the backend.
 */
export async function clearBackendNotifications(): Promise<void> {
  if (!browser) return;

  try {
    await invoke('clear_notifications');
  } catch (error) {
    console.error('Failed to clear notifications:', error);
    throw error;
  }
}

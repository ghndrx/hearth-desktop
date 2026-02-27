/**
 * Notification Center API - Rich notification management for Hearth Desktop
 *
 * Provides advanced notification features:
 * - Scheduled/delayed notifications
 * - Notification history and management
 * - Action buttons and callbacks
 * - Notification grouping
 * - Badge integration
 * - Do Not Disturb awareness
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** Notification priority levels */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** A notification action button */
export interface NotificationAction {
  id: string;
  label: string;
  destructive?: boolean;
}

/** Configuration for creating a notification */
export interface NotificationConfig {
  id: string;
  title: string;
  body?: string;
  group?: string;
  priority?: NotificationPriority;
  actions?: NotificationAction[];
  silent?: boolean;
  /** Delay in milliseconds before showing (for scheduled notifications) */
  schedule_ms?: number;
  /** Arbitrary data to attach to the notification */
  data?: Record<string, unknown>;
}

/** A stored notification record */
export interface NotificationRecord {
  id: string;
  title: string;
  body?: string;
  group?: string;
  priority: NotificationPriority;
  timestamp: number;
  read: boolean;
  data?: Record<string, unknown>;
}

/** Event payloads */
export type NotificationEventPayloads = {
  'notification:sent': string;
  'notification:scheduled': string;
  'notification:scheduled-sent': string;
  'notification:read': string;
  'notification:all-read': number;
  'notification:history-cleared': number;
  'notification:dnd-changed': boolean;
};

/**
 * Send a notification immediately
 * @param config Notification configuration
 * @returns The notification ID
 */
export async function sendNotification(config: NotificationConfig): Promise<string> {
  return invoke<string>('send_notification', { config });
}

/**
 * Schedule a notification for later delivery
 * @param config Notification configuration (must include schedule_ms)
 * @returns The notification ID
 */
export async function scheduleNotification(config: NotificationConfig): Promise<string> {
  return invoke<string>('schedule_notification', { config });
}

/**
 * Cancel a scheduled notification
 * @param id Notification ID to cancel
 * @returns True if the notification was found and cancelled
 */
export async function cancelScheduledNotification(id: string): Promise<boolean> {
  return invoke<boolean>('cancel_scheduled_notification', { id });
}

/**
 * Get all scheduled notifications
 * @returns Array of scheduled notification configs
 */
export async function getScheduledNotifications(): Promise<NotificationConfig[]> {
  return invoke<NotificationConfig[]>('get_scheduled_notifications');
}

/**
 * Get notification history
 * @param limit Maximum number of notifications to return (default: 50)
 * @returns Array of notification records (newest first)
 */
export async function getNotificationHistory(limit?: number): Promise<NotificationRecord[]> {
  return invoke<NotificationRecord[]>('get_notification_history', { limit });
}

/**
 * Mark a notification as read
 * @param id Notification ID
 * @returns True if the notification was found
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  return invoke<boolean>('mark_notification_read', { id });
}

/**
 * Mark all notifications as read
 * @returns Number of notifications marked as read
 */
export async function markAllNotificationsRead(): Promise<number> {
  return invoke<number>('mark_all_notifications_read');
}

/**
 * Clear notification history
 * @returns Number of notifications cleared
 */
export async function clearNotificationHistory(): Promise<number> {
  return invoke<number>('clear_notification_history');
}

/**
 * Get unread notification count
 * @returns Number of unread notifications
 */
export async function getUnreadNotificationCount(): Promise<number> {
  return invoke<number>('get_unread_notification_count');
}

/**
 * Set DND status for notification center
 * @param active Whether DND should be active
 * @returns The new DND status
 */
export async function setNotificationDnd(active: boolean): Promise<boolean> {
  return invoke<boolean>('set_notification_dnd', { active });
}

/**
 * Get notifications grouped by category
 * @returns Map of group name to notification records
 */
export async function getGroupedNotifications(): Promise<Record<string, NotificationRecord[]>> {
  return invoke<Record<string, NotificationRecord[]>>('get_grouped_notifications');
}

/**
 * Listen for notification events
 * @param event Event name
 * @param callback Event callback
 * @returns Unsubscribe function
 */
export async function onNotificationEvent<K extends keyof NotificationEventPayloads>(
  event: K,
  callback: (payload: NotificationEventPayloads[K]) => void
): Promise<UnlistenFn> {
  return listen<NotificationEventPayloads[K]>(event, (e) => callback(e.payload));
}

/**
 * Generate a unique notification ID
 * @param prefix Optional prefix
 * @returns Unique notification ID
 */
export function generateNotificationId(prefix = 'notif'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Helper to create a simple notification
 */
export function createNotification(
  title: string,
  body?: string,
  options?: Partial<Omit<NotificationConfig, 'id' | 'title' | 'body'>>
): NotificationConfig {
  return {
    id: generateNotificationId(),
    title,
    body,
    ...options,
  };
}

/**
 * Helper to schedule a notification with a delay
 * @param title Notification title
 * @param body Notification body
 * @param delayMs Delay in milliseconds
 * @param options Additional options
 */
export async function notifyAfter(
  title: string,
  body?: string,
  delayMs?: number,
  options?: Partial<Omit<NotificationConfig, 'id' | 'title' | 'body' | 'schedule_ms'>>
): Promise<string> {
  const config = createNotification(title, body, {
    ...options,
    schedule_ms: delayMs,
  });
  return delayMs ? scheduleNotification(config) : sendNotification(config);
}

export default {
  sendNotification,
  scheduleNotification,
  cancelScheduledNotification,
  getScheduledNotifications,
  getNotificationHistory,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotificationHistory,
  getUnreadNotificationCount,
  setNotificationDnd,
  getGroupedNotifications,
  onNotificationEvent,
  generateNotificationId,
  createNotification,
  notifyAfter,
};

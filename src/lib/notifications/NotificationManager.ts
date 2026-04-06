import {
  sendNotification,
  isPermissionGranted,
  requestPermission
} from '@tauri-apps/plugin-notification';
import { browser } from '$app/environment';
import type {
  NotificationData,
  NotificationBatch,
  NotificationSettings,
  NotificationPriority,
  NotificationCategory
} from './types.js';
import { defaultNotificationSettings } from './types.js';

export class NotificationManager {
  private pendingQueue: Map<string, NotificationData> = new Map();
  private batches: Map<string, NotificationBatch> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private settings: NotificationSettings;
  private permissionGranted: boolean = false;

  constructor(settings: NotificationSettings = defaultNotificationSettings) {
    this.settings = settings;
    this.init();
  }

  private async init() {
    if (!browser) return;

    try {
      this.permissionGranted = await isPermissionGranted();
      if (!this.permissionGranted) {
        const permission = await requestPermission();
        this.permissionGranted = permission === 'granted';
      }
    } catch (error) {
      console.warn('Failed to request notification permissions:', error);
    }
  }

  /**
   * Queue a notification for processing with smart batching and priority handling
   */
  async queue(notification: NotificationData): Promise<void> {
    if (!this.settings.enabled || !this.settings.categories[notification.category]?.enabled) {
      return;
    }

    // Check quiet hours
    if (this.isQuietHours()) {
      return;
    }

    // Generate unique ID if not provided
    if (!notification.id) {
      notification.id = this.generateId();
    }

    // Handle urgent notifications immediately
    if (notification.priority === 'urgent') {
      await this.sendImmediately(notification);
      return;
    }

    // Check if batching is enabled for this category
    const categorySettings = this.settings.categories[notification.category];
    if (!categorySettings.batchingEnabled) {
      await this.sendImmediately(notification);
      return;
    }

    // Add to pending queue
    this.pendingQueue.set(notification.id, notification);

    // Find or create batch
    const batchKey = this.getBatchKey(notification);
    let batch = this.batches.get(batchKey);

    if (!batch) {
      batch = this.createBatch(notification);
      this.batches.set(batchKey, batch);
    }

    // Add notification to batch
    batch.notifications.push(notification);

    // Schedule batch processing
    this.scheduleBatch(batch, categorySettings.batchDelay);
  }

  /**
   * Send a notification immediately without batching
   */
  private async sendImmediately(notification: NotificationData): Promise<void> {
    if (!this.permissionGranted || !browser) {
      return;
    }

    try {
      await sendNotification({
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        sound: this.settings.categories[notification.category]?.sound ? 'Default' : undefined,
        ...(notification.actions && { actions: notification.actions })
      });

      console.log('Notification sent:', notification.title);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Process a batch of notifications
   */
  private async processBatch(batch: NotificationBatch): Promise<void> {
    if (batch.notifications.length === 0) {
      return;
    }

    // Sort by priority and timestamp
    const sortedNotifications = this.sortNotificationsByPriority(batch.notifications);

    if (sortedNotifications.length === 1) {
      // Send single notification
      await this.sendImmediately(sortedNotifications[0]);
    } else if (sortedNotifications.length <= this.settings.maxBatchSize) {
      // Send as a batched notification
      await this.sendBatchedNotification(batch, sortedNotifications);
    } else {
      // Split large batches and send most important ones
      const priorityBatches = this.splitByPriority(sortedNotifications);
      for (const priorityBatch of priorityBatches) {
        if (priorityBatch.length <= this.settings.maxBatchSize) {
          await this.sendBatchedNotification(batch, priorityBatch.slice(0, this.settings.maxBatchSize));
        } else {
          // Send highest priority notifications individually
          for (const notification of priorityBatch.slice(0, this.settings.maxBatchSize)) {
            await this.sendImmediately(notification);
          }
        }
      }
    }

    // Clean up
    this.batches.delete(batch.id);
    batch.notifications.forEach(n => this.pendingQueue.delete(n.id));
  }

  /**
   * Send a batched notification
   */
  private async sendBatchedNotification(batch: NotificationBatch, notifications: NotificationData[]): Promise<void> {
    if (!this.permissionGranted || !browser) {
      return;
    }

    const title = this.generateBatchTitle(batch, notifications);
    const body = this.generateBatchBody(batch, notifications);

    try {
      await sendNotification({
        title,
        body,
        icon: notifications[0]?.icon,
        sound: this.settings.categories[batch.category]?.sound ? 'Default' : undefined
      });

      console.log('Batched notification sent:', title);
    } catch (error) {
      console.error('Failed to send batched notification:', error);
    }
  }

  /**
   * Generate a batch key for grouping related notifications
   */
  private getBatchKey(notification: NotificationData): string {
    const parts: string[] = [notification.category];

    if (notification.sourceId) {
      parts.push(notification.sourceId);
    } else if (notification.channelId) {
      parts.push(notification.channelId);
    } else if (notification.serverId) {
      parts.push(notification.serverId);
    }

    return parts.join('|');
  }

  /**
   * Create a new notification batch
   */
  private createBatch(notification: NotificationData): NotificationBatch {
    const now = Date.now();
    return {
      id: this.generateId(),
      category: notification.category,
      priority: notification.priority,
      notifications: [],
      createdAt: now,
      scheduledAt: now + this.settings.categories[notification.category].batchDelay,
      sourceId: notification.sourceId,
      title: '',
      body: ''
    };
  }

  /**
   * Schedule batch processing with debouncing
   */
  private scheduleBatch(batch: NotificationBatch, delay: number): void {
    // Clear existing timer
    const existingTimer = this.timers.get(batch.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processBatch(batch);
      this.timers.delete(batch.id);
    }, delay);

    this.timers.set(batch.id, timer);
  }

  /**
   * Sort notifications by priority (urgent > high > normal > low) and timestamp
   */
  private sortNotificationsByPriority(notifications: NotificationData[]): NotificationData[] {
    const priorityOrder: Record<NotificationPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3
    };

    return [...notifications].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp; // Earlier timestamps first
    });
  }

  /**
   * Split notifications by priority level
   */
  private splitByPriority(notifications: NotificationData[]): NotificationData[][] {
    const groups: Record<NotificationPriority, NotificationData[]> = {
      urgent: [],
      high: [],
      normal: [],
      low: []
    };

    notifications.forEach(notification => {
      groups[notification.priority].push(notification);
    });

    return Object.values(groups).filter(group => group.length > 0);
  }

  /**
   * Generate batch notification title
   */
  private generateBatchTitle(batch: NotificationBatch, notifications: NotificationData[]): string {
    const count = notifications.length;
    const category = batch.category;

    switch (category) {
      case 'message':
        return count === 1 ? notifications[0].title : `${count} new messages`;
      case 'mention':
        return count === 1 ? notifications[0].title : `${count} new mentions`;
      case 'system':
        return count === 1 ? notifications[0].title : `${count} system notifications`;
      case 'server_update':
        return count === 1 ? notifications[0].title : `${count} server updates`;
      default:
        return count === 1 ? notifications[0].title : `${count} notifications`;
    }
  }

  /**
   * Generate batch notification body
   */
  private generateBatchBody(batch: NotificationBatch, notifications: NotificationData[]): string {
    if (notifications.length === 1) {
      return notifications[0].body;
    }

    if (notifications.length <= 3) {
      return notifications.map(n => `• ${n.body}`).join('\n');
    }

    const firstTwo = notifications.slice(0, 2);
    const remaining = notifications.length - 2;
    return firstTwo.map(n => `• ${n.body}`).join('\n') + `\n• and ${remaining} more...`;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(): boolean {
    if (!this.settings.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();

    const [startHour, startMin] = this.settings.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = this.settings.quietHours.end.split(':').map(Number);

    const startTime = startHour * 100 + startMin;
    const endTime = endHour * 100 + endMin;

    if (startTime <= endTime) {
      // Same day quiet hours (e.g., 22:00 - 08:00 next day)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours (e.g., 22:00 - 08:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update notification settings
   */
  updateSettings(newSettings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Clear all pending notifications
   */
  clearAll(): void {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Clear all batches and queue
    this.batches.clear();
    this.pendingQueue.clear();
  }

  /**
   * Get pending notification count
   */
  getPendingCount(): number {
    return this.pendingQueue.size;
  }

  /**
   * Get pending notifications by category
   */
  getPendingByCategory(): Record<NotificationCategory, number> {
    const counts: Record<NotificationCategory, number> = {
      message: 0,
      voice_call: 0,
      mention: 0,
      system: 0,
      friend_request: 0,
      server_update: 0
    };

    for (const notification of this.pendingQueue.values()) {
      counts[notification.category]++;
    }

    return counts;
  }
}
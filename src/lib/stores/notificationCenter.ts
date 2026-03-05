import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { browser } from '$app/environment';

// Types matching the Rust backend
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationAction {
  id: string;
  label: string;
  destructive?: boolean;
}

export interface NotificationConfig {
  id: string;
  title: string;
  body?: string;
  group?: string;
  priority?: NotificationPriority;
  actions?: NotificationAction[];
  silent?: boolean;
  scheduleMs?: number;
  data?: Record<string, unknown>;
}

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

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  desktopNotificationsEnabled: boolean;
  showPreview: boolean;
  groupNotifications: boolean;
  dndEnabled: boolean;
  dndUntil?: number;
}

interface NotificationCenterState {
  notifications: NotificationRecord[];
  scheduled: NotificationConfig[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  settings: NotificationSettings;
  isOpen: boolean;
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  desktopNotificationsEnabled: true,
  showPreview: true,
  groupNotifications: true,
  dndEnabled: false
};

const initialState: NotificationCenterState = {
  notifications: [],
  scheduled: [],
  unreadCount: 0,
  loading: false,
  error: null,
  settings: defaultSettings,
  isOpen: false
};

// Notification Center Store
function createNotificationCenterStore() {
  const { subscribe, set, update } = writable<NotificationCenterState>(initialState);
  
  let eventUnlisteners: UnlistenFn[] = [];
  let initialized = false;

  return {
    subscribe,

    // Initialize the notification center
    async init() {
      if (!browser || initialized) return;
      
      try {
        update(s => ({ ...s, loading: true }));
        
        // Load notification history
        await this.refreshHistory();
        
        // Load scheduled notifications
        await this.refreshScheduled();
        
        // Load unread count
        await this.refreshUnreadCount();
        
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('notification_center_settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          update(s => ({ ...s, settings: { ...defaultSettings, ...settings } }));
        }

        // Listen for notification events from backend
        const unlistenSent = await listen<string>('notification:sent', (event) => {
          this.refreshHistory();
          this.refreshUnreadCount();
        });
        
        const unlistenScheduled = await listen<string>('notification:scheduled', (event) => {
          this.refreshScheduled();
        });
        
        const unlistenScheduledSent = await listen<string>('notification:scheduled-sent', (event) => {
          this.refreshScheduled();
          this.refreshHistory();
        });
        
        const unlistenRead = await listen<string>('notification:read', (event) => {
          this.refreshHistory();
          this.refreshUnreadCount();
        });
        
        const unlistenAllRead = await listen<number>('notification:all-read', (event) => {
          this.refreshHistory();
          this.refreshUnreadCount();
        });
        
        const unlistenCleared = await listen<number>('notification:history-cleared', (event) => {
          this.refreshHistory();
          this.refreshUnreadCount();
        });
        
        const unlistenDndChanged = await listen<boolean>('notification:dnd-changed', (event) => {
          update(s => ({ 
            ...s, 
            settings: { ...s.settings, dndEnabled: event.payload } 
          }));
        });

        eventUnlisteners = [
          unlistenSent,
          unlistenScheduled,
          unlistenScheduledSent,
          unlistenRead,
          unlistenAllRead,
          unlistenCleared,
          unlistenDndChanged
        ];
        
        initialized = true;
        update(s => ({ ...s, loading: false }));
        
      } catch (error) {
        console.error('Failed to initialize notification center:', error);
        update(s => ({ 
          ...s, 
          loading: false, 
          error: error instanceof Error ? error.message : 'Failed to initialize' 
        }));
      }
    },

    // Refresh notification history
    async refreshHistory(limit?: number) {
      if (!browser) return;
      
      try {
        const notifications = await invoke<NotificationRecord[]>(
          'get_notification_history',
          { limit: limit ?? 50 }
        );
        update(s => ({ ...s, notifications }));
      } catch (error) {
        console.error('Failed to refresh notification history:', error);
      }
    },

    // Refresh scheduled notifications
    async refreshScheduled() {
      if (!browser) return;
      
      try {
        const scheduled = await invoke<NotificationConfig[]>('get_scheduled_notifications');
        update(s => ({ ...s, scheduled }));
      } catch (error) {
        console.error('Failed to refresh scheduled notifications:', error);
      }
    },

    // Refresh unread count
    async refreshUnreadCount() {
      if (!browser) return;
      
      try {
        const unreadCount = await invoke<number>('get_unread_notification_count');
        update(s => ({ ...s, unreadCount }));
      } catch (error) {
        console.error('Failed to refresh unread count:', error);
      }
    },

    // Send a native notification
    async sendNotification(config: NotificationConfig): Promise<string | null> {
      if (!browser) return null;
      
      const state = get({ subscribe });
      if (!state.settings.enabled || state.settings.dndEnabled) {
        return null;
      }

      try {
        const id = await invoke<string>('send_notification', { config });
        
        // Play sound if enabled
        if (state.settings.soundEnabled) {
          playNotificationSound();
        }
        
        return id;
      } catch (error) {
        console.error('Failed to send notification:', error);
        return null;
      }
    },

    // Schedule a notification for later
    async scheduleNotification(config: NotificationConfig): Promise<string | null> {
      if (!browser) return null;
      
      try {
        const id = await invoke<string>('schedule_notification', { config });
        await this.refreshScheduled();
        return id;
      } catch (error) {
        console.error('Failed to schedule notification:', error);
        return null;
      }
    },

    // Cancel a scheduled notification
    async cancelScheduledNotification(id: string): Promise<boolean> {
      if (!browser) return false;
      
      try {
        const cancelled = await invoke<boolean>('cancel_scheduled_notification', { id });
        if (cancelled) {
          await this.refreshScheduled();
        }
        return cancelled;
      } catch (error) {
        console.error('Failed to cancel scheduled notification:', error);
        return false;
      }
    },

    // Mark a notification as read
    async markAsRead(id: string): Promise<boolean> {
      if (!browser) return false;
      
      try {
        const marked = await invoke<boolean>('mark_notification_read', { id });
        if (marked) {
          await this.refreshHistory();
          await this.refreshUnreadCount();
        }
        return marked;
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        return false;
      }
    },

    // Mark all notifications as read
    async markAllAsRead(): Promise<number> {
      if (!browser) return 0;
      
      try {
        const count = await invoke<number>('mark_all_notifications_read');
        await this.refreshHistory();
        await this.refreshUnreadCount();
        return count;
      } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        return 0;
      }
    },

    // Clear notification history
    async clearHistory(): Promise<number> {
      if (!browser) return 0;
      
      try {
        const count = await invoke<number>('clear_notification_history');
        await this.refreshHistory();
        await this.refreshUnreadCount();
        return count;
      } catch (error) {
        console.error('Failed to clear notification history:', error);
        return 0;
      }
    },

    // Toggle Do Not Disturb
    async toggleDnd(): Promise<boolean> {
      if (!browser) return false;
      
      try {
        const state = get({ subscribe });
        const newState = !state.settings.dndEnabled;
        
        await invoke<boolean>('set_notification_dnd', { active: newState });
        
        update(s => ({ 
          ...s, 
          settings: { ...s.settings, dndEnabled: newState } 
        }));
        
        // Save settings
        this.saveSettings();
        
        return newState;
      } catch (error) {
        console.error('Failed to toggle DND:', error);
        return false;
      }
    },

    // Set DND state explicitly
    async setDnd(active: boolean): Promise<boolean> {
      if (!browser) return false;
      
      try {
        await invoke<boolean>('set_notification_dnd', { active });
        
        update(s => ({ 
          ...s, 
          settings: { ...s.settings, dndEnabled: active } 
        }));
        
        this.saveSettings();
        return active;
      } catch (error) {
        console.error('Failed to set DND:', error);
        return false;
      }
    },

    // Get grouped notifications
    async getGroupedNotifications(): Promise<Record<string, NotificationRecord[]>> {
      if (!browser) return {};
      
      try {
        return await invoke<Record<string, NotificationRecord[]>>('get_grouped_notifications');
      } catch (error) {
        console.error('Failed to get grouped notifications:', error);
        return {};
      }
    },

    // Toggle notification center visibility
    toggle() {
      update(s => ({ ...s, isOpen: !s.isOpen }));
    },

    // Open notification center
    open() {
      update(s => ({ ...s, isOpen: true }));
    },

    // Close notification center
    close() {
      update(s => ({ ...s, isOpen: false }));
    },

    // Update settings
    updateSettings(settings: Partial<NotificationSettings>) {
      update(s => {
        const newSettings = { ...s.settings, ...settings };
        localStorage.setItem('notification_center_settings', JSON.stringify(newSettings));
        return { ...s, settings: newSettings };
      });
    },

    // Save settings to localStorage
    saveSettings() {
      const state = get({ subscribe });
      localStorage.setItem('notification_center_settings', JSON.stringify(state.settings));
    },

    // Cleanup event listeners
    cleanup() {
      eventUnlisteners.forEach(unlisten => unlisten());
      eventUnlisteners = [];
      initialized = false;
    }
  };
}

// Notification sound
let notificationAudio: HTMLAudioElement | null = null;

function playNotificationSound() {
  if (!browser) return;
  
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio('/sounds/notification.mp3');
      notificationAudio.volume = 0.5;
    }
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {
      // Ignore autoplay errors
    });
  } catch {
    // Ignore audio errors
  }
}

// Create the store instance
export const notificationCenter = createNotificationCenterStore();

// Derived stores
export const unreadNotificationCount = derived(
  notificationCenter, 
  $center => $center.unreadCount
);

export const hasUnreadNotifications = derived(
  notificationCenter, 
  $center => $center.unreadCount > 0
);

export const isNotificationCenterOpen = derived(
  notificationCenter, 
  $center => $center.isOpen
);

export const notificationSettings = derived(
  notificationCenter, 
  $center => $center.settings
);

export const isDndEnabled = derived(
  notificationCenter, 
  $center => $center.settings.dndEnabled
);

export const groupedNotifications = derived(
  notificationCenter,
  $center => {
    const grouped: Record<string, NotificationRecord[]> = {};
    
    for (const notification of $center.notifications) {
      const group = notification.group || 'default';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(notification);
    }
    
    return grouped;
  }
);

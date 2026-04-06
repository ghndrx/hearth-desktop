import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { NotificationManager } from './NotificationManager.js';
import type { NotificationData, NotificationSettings, NotificationCategory } from './types.js';
import { defaultNotificationSettings } from './types.js';

// Load settings from localStorage
function loadNotificationSettings(): NotificationSettings {
  if (!browser) return defaultNotificationSettings;

  try {
    const saved = localStorage.getItem('hearth_notification_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultNotificationSettings, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load notification settings:', error);
  }

  return defaultNotificationSettings;
}

// Save settings to localStorage
function saveNotificationSettings(settings: NotificationSettings): void {
  if (!browser) return;

  try {
    localStorage.setItem('hearth_notification_settings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save notification settings:', error);
  }
}

interface NotificationState {
  manager: NotificationManager | null;
  settings: NotificationSettings;
  pendingCount: number;
  pendingByCategory: Record<NotificationCategory, number>;
  isInitialized: boolean;
}

const initialState: NotificationState = {
  manager: null,
  settings: loadNotificationSettings(),
  pendingCount: 0,
  pendingByCategory: {
    message: 0,
    voice_call: 0,
    mention: 0,
    system: 0,
    friend_request: 0,
    server_update: 0
  },
  isInitialized: false
};

function createNotificationStore() {
  const { subscribe, set, update } = writable<NotificationState>(initialState);

  let manager: NotificationManager | null = null;
  let updateInterval: NodeJS.Timeout | null = null;

  return {
    subscribe,

    async init() {
      if (!browser) return;

      const settings = loadNotificationSettings();
      manager = new NotificationManager(settings);

      // Start periodic updates for pending counts
      updateInterval = setInterval(() => {
        if (manager) {
          const pendingCount = manager.getPendingCount();
          const pendingByCategory = manager.getPendingByCategory();

          update(state => ({
            ...state,
            pendingCount,
            pendingByCategory
          }));
        }
      }, 1000);

      update(state => ({
        ...state,
        manager,
        settings,
        isInitialized: true
      }));
    },

    async send(notification: Omit<NotificationData, 'id' | 'timestamp'>) {
      if (!manager) return;

      const fullNotification: NotificationData = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };

      await manager.queue(fullNotification);
    },

    updateSettings(newSettings: Partial<NotificationSettings>) {
      update(state => {
        const updatedSettings = { ...state.settings, ...newSettings };

        if (manager) {
          manager.updateSettings(updatedSettings);
        }

        saveNotificationSettings(updatedSettings);

        return {
          ...state,
          settings: updatedSettings
        };
      });
    },

    updateCategorySettings(category: NotificationCategory, settings: Partial<NotificationSettings['categories'][NotificationCategory]>) {
      update(state => {
        const updatedSettings = {
          ...state.settings,
          categories: {
            ...state.settings.categories,
            [category]: {
              ...state.settings.categories[category],
              ...settings
            }
          }
        };

        if (manager) {
          manager.updateSettings(updatedSettings);
        }

        saveNotificationSettings(updatedSettings);

        return {
          ...state,
          settings: updatedSettings
        };
      });
    },

    clearAll() {
      if (manager) {
        manager.clearAll();
      }

      update(state => ({
        ...state,
        pendingCount: 0,
        pendingByCategory: {
          message: 0,
          voice_call: 0,
          mention: 0,
          system: 0,
          friend_request: 0,
          server_update: 0
        }
      }));
    },

    destroy() {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }

      if (manager) {
        manager.clearAll();
        manager = null;
      }

      update(state => ({
        ...state,
        manager: null,
        isInitialized: false
      }));
    }
  };
}

export const notificationStore = createNotificationStore();

// Derived stores for convenience
export const notificationSettings = derived(notificationStore, $store => $store.settings);
export const pendingNotificationCount = derived(notificationStore, $store => $store.pendingCount);
export const pendingNotificationsByCategory = derived(notificationStore, $store => $store.pendingByCategory);
export const isNotificationManagerReady = derived(notificationStore, $store => $store.isInitialized && $store.manager !== null);

// Convenience functions
export function sendNotification(notification: Omit<NotificationData, 'id' | 'timestamp'>) {
  return notificationStore.send(notification);
}

export function sendMessage(title: string, body: string, options?: {
  userId?: string;
  serverId?: string;
  channelId?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  sound?: boolean;
}) {
  return sendNotification({
    title,
    body,
    category: 'message',
    priority: options?.priority || 'normal',
    userId: options?.userId,
    serverId: options?.serverId,
    channelId: options?.channelId,
    sourceId: options?.channelId || options?.serverId,
    sound: options?.sound
  });
}

export function sendMention(title: string, body: string, options?: {
  userId?: string;
  serverId?: string;
  channelId?: string;
  sound?: boolean;
}) {
  return sendNotification({
    title,
    body,
    category: 'mention',
    priority: 'high',
    userId: options?.userId,
    serverId: options?.serverId,
    channelId: options?.channelId,
    sourceId: options?.channelId || options?.serverId,
    sound: options?.sound !== false
  });
}

export function sendVoiceCall(title: string, body: string, options?: {
  userId?: string;
  serverId?: string;
  channelId?: string;
  actions?: { id: string; title: string }[];
}) {
  return sendNotification({
    title,
    body,
    category: 'voice_call',
    priority: 'urgent',
    userId: options?.userId,
    serverId: options?.serverId,
    channelId: options?.channelId,
    sourceId: options?.channelId || options?.serverId,
    actions: options?.actions,
    sound: true,
    persistent: true
  });
}

export function sendSystemNotification(title: string, body: string, options?: {
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  sound?: boolean;
}) {
  return sendNotification({
    title,
    body,
    category: 'system',
    priority: options?.priority || 'normal',
    sound: options?.sound || false
  });
}

export function sendFriendRequest(title: string, body: string, options?: {
  userId?: string;
  actions?: { id: string; title: string }[];
}) {
  return sendNotification({
    title,
    body,
    category: 'friend_request',
    priority: 'normal',
    userId: options?.userId,
    sourceId: options?.userId,
    actions: options?.actions,
    sound: true
  });
}

export function sendServerUpdate(title: string, body: string, options?: {
  serverId?: string;
  sound?: boolean;
}) {
  return sendNotification({
    title,
    body,
    category: 'server_update',
    priority: 'low',
    serverId: options?.serverId,
    sourceId: options?.serverId,
    sound: options?.sound || false
  });
}
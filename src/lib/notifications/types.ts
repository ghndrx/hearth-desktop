export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

export type NotificationCategory =
  | 'message'
  | 'voice_call'
  | 'mention'
  | 'system'
  | 'friend_request'
  | 'server_update';

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  timestamp: number;
  sourceId?: string; // For batching related notifications
  userId?: string;
  serverId?: string;
  channelId?: string;
  actions?: NotificationAction[];
  icon?: string;
  sound?: boolean;
  persistent?: boolean;
  expiresAt?: number;
}

export interface NotificationAction {
  id: string;
  title: string;
  actionTypeId?: string;
}

export interface NotificationBatch {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  notifications: NotificationData[];
  createdAt: number;
  scheduledAt: number;
  sourceId?: string;
  title: string;
  body: string;
}

export interface NotificationSettings {
  enabled: boolean;
  categories: Record<NotificationCategory, {
    enabled: boolean;
    priority: NotificationPriority;
    sound: boolean;
    batchingEnabled: boolean;
    batchDelay: number; // milliseconds
  }>;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  maxBatchSize: number;
  batchingDelay: number; // milliseconds
}

export const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  categories: {
    message: {
      enabled: true,
      priority: 'normal',
      sound: true,
      batchingEnabled: true,
      batchDelay: 2000
    },
    voice_call: {
      enabled: true,
      priority: 'urgent',
      sound: true,
      batchingEnabled: false,
      batchDelay: 0
    },
    mention: {
      enabled: true,
      priority: 'high',
      sound: true,
      batchingEnabled: true,
      batchDelay: 1000
    },
    system: {
      enabled: true,
      priority: 'normal',
      sound: false,
      batchingEnabled: true,
      batchDelay: 5000
    },
    friend_request: {
      enabled: true,
      priority: 'normal',
      sound: true,
      batchingEnabled: false,
      batchDelay: 0
    },
    server_update: {
      enabled: true,
      priority: 'low',
      sound: false,
      batchingEnabled: true,
      batchDelay: 10000
    }
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00'
  },
  maxBatchSize: 5,
  batchingDelay: 2000
};
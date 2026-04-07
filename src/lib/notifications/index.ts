// Core types
export type {
  NotificationData,
  NotificationBatch,
  NotificationSettings,
  NotificationPriority,
  NotificationCategory,
  NotificationAction
} from './types.js';

export { defaultNotificationSettings } from './types.js';

// Notification manager
export { NotificationManager } from './NotificationManager.js';

// Store and convenience functions
export {
  notificationStore,
  notificationSettings,
  pendingNotificationCount,
  pendingNotificationsByCategory,
  isNotificationManagerReady,
  sendNotification,
  sendMessage,
  sendMention,
  sendVoiceCall,
  sendSystemNotification,
  sendFriendRequest,
  sendServerUpdate
} from './store.js';

// Backend API client (Rust notification manager)
export {
  queueNotification,
  flushNotifications,
  getNotificationStats,
  updateBackendSettings,
  getBackendSettings,
  clearBackendNotifications
} from './backend.js';

export type {
  BackendNotificationStats,
  BackendCategorySettings,
  BackendQuietHoursSettings,
  BackendNotificationSettings,
  QueueResult
} from './backend.js';
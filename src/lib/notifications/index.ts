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
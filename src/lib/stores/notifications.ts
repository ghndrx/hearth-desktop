import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { appSettings } from "./settings";
import { user } from "./auth";
import { currentChannel } from "./channels";

export interface NotificationState {
  permissionGranted: boolean;
  permissionRequested: boolean;
}

interface MessageNotification {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  channelId: string;
  channelName: string;
  serverName?: string;
  timestamp: number;
}

const initialState: NotificationState = {
  permissionGranted: false,
  permissionRequested: false,
};

function createNotificationStore() {
  const { subscribe, update, set } = writable<NotificationState>(initialState);
  const recentNotifications = writable<Map<string, number>>(new Map());

  // Deduplication window in milliseconds
  const DEDUPE_WINDOW = 5000;

  async function checkPermission(): Promise<boolean> {
    if (!browser) return false;

    try {
      const granted = await isPermissionGranted();
      update((s) => ({
        ...s,
        permissionGranted: granted,
        permissionRequested: true,
      }));
      return granted;
    } catch (error) {
      console.error("Failed to check notification permission:", error);
      return false;
    }
  }

  async function requestNotificationPermission(): Promise<boolean> {
    if (!browser) return false;

    try {
      const granted = await requestPermission();
      update((s) => ({
        ...s,
        permissionGranted: granted === "granted",
        permissionRequested: true,
      }));
      return granted === "granted";
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  }

  function shouldShowNotification(message: MessageNotification): boolean {
    const settings = get(appSettings);
    const currentUserData = get(user);
    const activeChannel = get(currentChannel);

    // Check if notifications are enabled
    if (!settings.notificationsEnabled) return false;

    // Don't notify for own messages
    if (currentUserData && message.authorName === currentUserData.username)
      return false;

    // Don't notify for messages in the currently focused channel
    // (assuming the app is visible - this is a basic check)
    if (
      activeChannel &&
      activeChannel.id === message.channelId &&
      document.visibilityState === "visible"
    ) {
      return false;
    }

    return true;
  }

  function isDuplicate(messageId: string): boolean {
    const recent = get(recentNotifications);
    const lastSent = recent.get(messageId);

    if (lastSent && Date.now() - lastSent < DEDUPE_WINDOW) {
      return true;
    }

    // Add to recent and schedule cleanup
    recentNotifications.update((r) => {
      r.set(messageId, Date.now());
      return r;
    });

    // Cleanup old entries after dedupe window
    setTimeout(() => {
      recentNotifications.update((r) => {
        r.delete(messageId);
        return r;
      });
    }, DEDUPE_WINDOW);

    return false;
  }

  function truncateContent(content: string, maxLength: number = 150): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + "...";
  }

  async function showMessageNotification(
    message: MessageNotification,
  ): Promise<void> {
    const state = get({ subscribe });

    if (!state.permissionGranted) {
      // Try to request permission if not yet requested
      if (!state.permissionRequested) {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      } else {
        return;
      }
    }

    if (!shouldShowNotification(message)) return;
    if (isDuplicate(message.id)) return;

    const title = message.serverName
      ? `${message.authorName} (${message.serverName})`
      : message.authorName;

    const body = truncateContent(message.content);

    try {
      sendNotification({
        title,
        body,
        // icon: message.authorAvatar || 'icons/icon.png'
      });
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }

  async function showDirectNotification(
    title: string,
    body: string,
  ): Promise<void> {
    const state = get({ subscribe });

    if (!state.permissionGranted) {
      if (!state.permissionRequested) {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      } else {
        return;
      }
    }

    try {
      sendNotification({ title, body });
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }

  // Initialize permission check on store creation
  if (browser) {
    checkPermission();
  }

  return {
    subscribe,
    checkPermission,
    requestPermission: requestNotificationPermission,
    showMessage: showMessageNotification,
    show: showDirectNotification,
  };
}

export const notificationStore = createNotificationStore();
export const isNotificationPermissionGranted = derived(
  notificationStore,
  ($s) => $s.permissionGranted,
);

export type { MessageNotification };

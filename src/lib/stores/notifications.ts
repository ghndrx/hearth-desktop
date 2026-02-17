import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import { api } from "$lib/api";
import { onGatewayEvent } from "./gateway";
import {
  sendNotification,
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";

export interface Notification {
  id: string;
  user_id: string;
  type:
    | "mention"
    | "reply"
    | "direct_message"
    | "friend_request"
    | "friend_accept"
    | "server_invite"
    | "server_join"
    | "reaction"
    | "system";
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, unknown>;
  actor_id?: string;
  actor_username?: string;
  actor_avatar?: string;
  server_id?: string;
  server_name?: string;
  channel_id?: string;
  channel_name?: string;
  message_id?: string;
  created_at: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
}

export interface ReadStateUpdate {
  channel_id: string;
  last_message_id?: string;
  mention_count: number;
}

interface NotificationState {
  notifications: Notification[];
  stats: NotificationStats;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  offset: number;
}

const initialState: NotificationState = {
  notifications: [],
  stats: { total: 0, unread: 0 },
  loading: false,
  error: null,
  hasMore: true,
  offset: 0,
};

function createNotificationStore() {
  const { subscribe, set, update } = writable<NotificationState>(initialState);

  // Subscribe to gateway events
  if (browser) {
    onGatewayEvent("NOTIFICATION_CREATE", (data) => {
      const notification = data as Notification;
      update((state) => ({
        ...state,
        notifications: [notification, ...state.notifications],
        stats: {
          ...state.stats,
          total: state.stats.total + 1,
          unread: state.stats.unread + 1,
        },
      }));

      // Play notification sound
      playNotificationSound();

      // Show desktop notification if permitted
      showDesktopNotification(notification);
    });

    onGatewayEvent("NOTIFICATION_UPDATE", (data) => {
      const notification = data as Notification;
      update((state) => {
        const idx = state.notifications.findIndex(
          (n) => n.id === notification.id,
        );
        if (idx !== -1) {
          const notifications = [...state.notifications];
          const wasUnread = !notifications[idx].read;
          const isNowRead = notification.read;
          notifications[idx] = notification;

          return {
            ...state,
            notifications,
            stats:
              wasUnread && isNowRead
                ? {
                    ...state.stats,
                    unread: Math.max(0, state.stats.unread - 1),
                  }
                : state.stats,
          };
        }
        return state;
      });
    });
  }

  async function loadNotifications(reset = false) {
    const state = get({ subscribe });
    if (state.loading) return;
    if (!reset && !state.hasMore) return;

    update((s) => ({ ...s, loading: true, error: null }));

    const offset = reset ? 0 : state.offset;
    const limit = 50;

    try {
      const response = await api.get<{
        notifications: Notification[];
        total: number;
        unread: number;
      }>(`/users/@me/notifications?limit=${limit}&offset=${offset}`);

      update((s) => ({
        ...s,
        notifications: reset
          ? response.notifications
          : [...s.notifications, ...response.notifications],
        stats: { total: response.total, unread: response.unread },
        loading: false,
        hasMore: response.notifications.length === limit,
        offset: offset + response.notifications.length,
      }));
    } catch (err) {
      update((s) => ({
        ...s,
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to load notifications",
      }));
    }
  }

  async function loadStats() {
    try {
      const stats = await api.get<NotificationStats>(
        "/users/@me/notifications/stats",
      );
      update((s) => ({ ...s, stats }));
    } catch {
      // Silently fail for stats
    }
  }

  async function markAsRead(id: string) {
    try {
      await api.post(`/users/@me/notifications/${id}/read`);
      update((state) => {
        const idx = state.notifications.findIndex((n) => n.id === id);
        if (idx !== -1 && !state.notifications[idx].read) {
          const notifications = [...state.notifications];
          notifications[idx] = { ...notifications[idx], read: true };
          return {
            ...state,
            notifications,
            stats: {
              ...state.stats,
              unread: Math.max(0, state.stats.unread - 1),
            },
          };
        }
        return state;
      });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }

  async function markAllAsRead() {
    try {
      await api.post("/users/@me/notifications/read-all");
      update((state) => ({
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        stats: { ...state.stats, unread: 0 },
      }));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  }

  async function deleteNotification(id: string) {
    try {
      await api.delete(`/users/@me/notifications/${id}`);
      update((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        const wasUnread = notification && !notification.read;
        return {
          ...state,
          notifications: state.notifications.filter((n) => n.id !== id),
          stats: {
            total: state.stats.total - 1,
            unread: wasUnread ? state.stats.unread - 1 : state.stats.unread,
          },
        };
      });
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  }

  async function deleteAllRead() {
    try {
      await api.delete("/users/@me/notifications/read");
      update((state) => ({
        ...state,
        notifications: state.notifications.filter((n) => !n.read),
        stats: { ...state.stats, total: state.stats.unread },
      }));
    } catch (err) {
      console.error("Failed to delete read notifications:", err);
    }
  }

  function reset() {
    set(initialState);
  }

  function getState() {
    let currentState: NotificationState = initialState;
    subscribe((s) => {
      currentState = s;
    })();
    return currentState;
  }

  return {
    subscribe,
    loadNotifications,
    loadStats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    reset,
    getState,
  };
}

export const notifications = createNotificationStore();

// Derived stores
export const unreadCount = derived(notifications, ($n) => $n.stats.unread);
export const hasUnread = derived(notifications, ($n) => $n.stats.unread > 0);
export const isLoading = derived(notifications, ($n) => $n.loading);

// Channel read state store
interface ChannelReadState {
  [channelId: string]: {
    lastMessageId?: string;
    mentionCount: number;
    hasUnread: boolean;
  };
}

function createReadStateStore() {
  const { subscribe, set, update } = writable<ChannelReadState>({});

  // Subscribe to gateway events
  if (browser) {
    onGatewayEvent("READ_STATE_UPDATE", (data) => {
      const readState = data as ReadStateUpdate;
      update((state) => ({
        ...state,
        [readState.channel_id]: {
          lastMessageId: readState.last_message_id,
          mentionCount: readState.mention_count,
          hasUnread: readState.mention_count > 0,
        },
      }));
    });

    onGatewayEvent("MESSAGE_CREATE", (data) => {
      const message = data as {
        channel_id: string;
        id: string;
        author_id: string;
      };
      // Check if this is a message from someone else (would cause unread)
      // We'll handle this in the component level for now
    });
  }

  async function markChannelAsRead(channelId: string, messageId?: string) {
    try {
      await api.post(`/channels/${channelId}/ack`, { message_id: messageId });
      update((state) => ({
        ...state,
        [channelId]: {
          lastMessageId: messageId,
          mentionCount: 0,
          hasUnread: false,
        },
      }));
    } catch (err) {
      console.error("Failed to mark channel as read:", err);
    }
  }

  function getChannelMentionCount(channelId: string): number {
    const state = get({ subscribe });
    return state[channelId]?.mentionCount ?? 0;
  }

  function reset() {
    set({});
  }

  return {
    subscribe,
    markChannelAsRead,
    getChannelMentionCount,
    reset,
  };
}

export const readState = createReadStateStore();

// Notification sound
let notificationAudio: HTMLAudioElement | null = null;

function playNotificationSound() {
  if (!browser) return;

  try {
    if (!notificationAudio) {
      notificationAudio = new Audio("/sounds/notification.mp3");
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

// Desktop notifications
async function showDesktopNotification(notification: Notification) {
  if (!browser) return;

  // Check if we're in Tauri desktop environment
  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  if (isTauri) {
    // Use native Tauri notifications
    try {
      const hasPermission = await isPermissionGranted();
      if (!hasPermission) {
        const permission = await requestPermission();
        if (permission !== "granted") return;
      }

      // Send native notification
      sendNotification({
        title: notification.title,
        body: notification.body,
      });

      // Request window attention
      await invoke("request_window_attention");
    } catch (err) {
      console.error("Failed to show native notification:", err);
    }
  } else {
    // Use web notifications as fallback
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.hasFocus()) return; // Don't show if tab is focused

    try {
      const desktopNotif = new Notification(notification.title, {
        body: notification.body,
        icon: notification.actor_avatar || "/icons/icon-192.png",
        tag: notification.id,
        silent: true, // We play our own sound
      });

      desktopNotif.onclick = () => {
        window.focus();
        // Navigate to the relevant content
        if (notification.channel_id) {
          if (notification.server_id) {
            window.location.href = `/channels/${notification.server_id}/${notification.channel_id}`;
          } else {
            window.location.href = `/channels/@me/${notification.channel_id}`;
          }
        }
        desktopNotif.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => desktopNotif.close(), 5000);
    } catch {
      // Ignore notification errors
    }
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!browser) return false;
  if (!("Notification" in window)) return false;

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

// Check notification permission
export function getNotificationPermission():
  | "granted"
  | "denied"
  | "default"
  | "unsupported" {
  if (!browser) return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

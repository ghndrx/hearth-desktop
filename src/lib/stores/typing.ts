import { writable, derived } from "svelte/store";
import { gateway } from "./gateway";

export interface TypingUser {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  startedAt: number;
}

// Map of channel_id -> Map of user_id -> TypingUser
const typingState = writable<Map<string, Map<string, TypingUser>>>(new Map());

// Typing indicator timeout (10 seconds as per Discord spec)
const TYPING_TIMEOUT_MS = 10000;

// Cleanup interval
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function createTypingStore() {
  // Start cleanup interval
  if (typeof window !== "undefined" && !cleanupInterval) {
    cleanupInterval = setInterval(cleanupExpired, 1000);
  }

  // Subscribe to gateway typing events
  gateway.on("TYPING_START", (data) => {
    const event = data as {
      channel_id: string;
      user_id: string;
      member?: {
        user?: {
          username: string;
          display_name?: string;
          avatar?: string;
        };
      };
      timestamp?: number;
    };

    // Don't show our own typing
    const currentUserId = getCurrentUserId();
    if (event.user_id === currentUserId) return;

    const username = event.member?.user?.username || "Someone";
    const displayName = event.member?.user?.display_name;
    const avatar = event.member?.user?.avatar;

    typingState.update((state) => {
      const channelTyping = state.get(event.channel_id) || new Map();
      channelTyping.set(event.user_id, {
        userId: event.user_id,
        username,
        displayName,
        avatar,
        startedAt: Date.now(),
      });
      state.set(event.channel_id, channelTyping);
      return new Map(state);
    });
  });

  // Clear typing when user sends a message
  gateway.on("MESSAGE_CREATE", (data) => {
    const message = data as { channel_id: string; author_id: string };
    clearUserTyping(message.channel_id, message.author_id);
  });

  function cleanupExpired() {
    const now = Date.now();
    typingState.update((state) => {
      let changed = false;
      for (const [channelId, channelTyping] of state) {
        for (const [userId, user] of channelTyping) {
          if (now - user.startedAt > TYPING_TIMEOUT_MS) {
            channelTyping.delete(userId);
            changed = true;
          }
        }
        if (channelTyping.size === 0) {
          state.delete(channelId);
          changed = true;
        }
      }
      return changed ? new Map(state) : state;
    });
  }

  function clearUserTyping(channelId: string, userId: string) {
    typingState.update((state) => {
      const channelTyping = state.get(channelId);
      if (channelTyping?.has(userId)) {
        channelTyping.delete(userId);
        if (channelTyping.size === 0) {
          state.delete(channelId);
        }
        return new Map(state);
      }
      return state;
    });
  }

  function getTypingUsers(channelId: string): TypingUser[] {
    let users: TypingUser[] = [];
    typingState.subscribe((state) => {
      const channelTyping = state.get(channelId);
      users = channelTyping ? Array.from(channelTyping.values()) : [];
    })();
    return users;
  }

  // Create a derived store for a specific channel
  function forChannel(channelId: string) {
    return derived(typingState, ($state) => {
      const channelTyping = $state.get(channelId);
      return channelTyping ? Array.from(channelTyping.values()) : [];
    });
  }

  return {
    subscribe: typingState.subscribe,
    getTypingUsers,
    forChannel,
    clearUserTyping,
  };
}

// Current user ID - set externally to avoid circular deps
let currentUserId: string | null = null;

export function setCurrentUserId(userId: string | null) {
  currentUserId = userId;
}

// Helper to get current user ID
function getCurrentUserId(): string | null {
  return currentUserId;
}

export const typingStore = createTypingStore();

// Helper to format typing indicator text
export function formatTypingText(users: TypingUser[]): string {
  if (users.length === 0) return "";

  const names = users.map((u) => u.displayName || u.username);

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }

  if (names.length === 3) {
    return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
  }

  return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing...`;
}

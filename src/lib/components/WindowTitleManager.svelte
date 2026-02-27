<script lang="ts">
  /**
   * WindowTitleManager - Dynamically updates window title based on application context
   * 
   * Features:
   * - Updates title based on current server, channel, or DM
   * - Shows unread message count in title
   * - Supports focus indicators and typing status
   * - Customizable title format patterns
   * - Badge integration for unread counts
   */
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived, get } from 'svelte/store';

  // Props
  export let appName: string = 'Hearth';
  export let separator: string = ' — ';
  export let showUnreadCount: boolean = true;
  export let showTypingIndicator: boolean = true;
  export let maxTitleLength: number = 100;
  export let updateInterval: number = 1000;
  export let titlePattern: 'full' | 'compact' | 'minimal' = 'full';

  // Stores for current context
  const currentServer = writable<{ id: string; name: string } | null>(null);
  const currentChannel = writable<{ id: string; name: string; type: 'text' | 'voice' | 'dm' } | null>(null);
  const currentDM = writable<{ id: string; username: string; displayName?: string } | null>(null);
  const unreadCount = writable<number>(0);
  const mentionCount = writable<number>(0);
  const typingUsers = writable<string[]>([]);
  const isFocused = writable<boolean>(true);
  const isConnected = writable<boolean>(true);
  const customStatus = writable<string | null>(null);

  // Derived store for computed title
  const windowTitle = derived(
    [currentServer, currentChannel, currentDM, unreadCount, mentionCount, typingUsers, isFocused, isConnected, customStatus],
    ([$server, $channel, $dm, $unread, $mentions, $typing, $focused, $connected, $status]) => {
      return computeTitle($server, $channel, $dm, $unread, $mentions, $typing, $focused, $connected, $status);
    }
  );

  // Title computation logic
  function computeTitle(
    server: { id: string; name: string } | null,
    channel: { id: string; name: string; type: 'text' | 'voice' | 'dm' } | null,
    dm: { id: string; username: string; displayName?: string } | null,
    unread: number,
    mentions: number,
    typing: string[],
    focused: boolean,
    connected: boolean,
    status: string | null
  ): string {
    const parts: string[] = [];

    // Connection status prefix
    if (!connected) {
      parts.push('🔴 Disconnected');
    }

    // Unread/mention badges
    if (showUnreadCount && !focused) {
      if (mentions > 0) {
        parts.push(`(${mentions})`);
      } else if (unread > 0) {
        parts.push(`(${unread})`);
      }
    }

    // Main context
    switch (titlePattern) {
      case 'full':
        if (dm) {
          const name = dm.displayName || dm.username;
          parts.push(`@${name}`);
        } else if (channel && server) {
          parts.push(`#${channel.name}`);
          parts.push(server.name);
        } else if (server) {
          parts.push(server.name);
        }
        break;

      case 'compact':
        if (dm) {
          parts.push(`@${dm.username}`);
        } else if (channel) {
          parts.push(`#${channel.name}`);
        }
        break;

      case 'minimal':
        // Just app name with badges
        break;
    }

    // Typing indicator
    if (showTypingIndicator && typing.length > 0 && channel) {
      if (typing.length === 1) {
        parts.push(`${typing[0]} is typing...`);
      } else if (typing.length <= 3) {
        parts.push(`${typing.join(', ')} are typing...`);
      } else {
        parts.push('Several people are typing...');
      }
    }

    // Custom status
    if (status) {
      parts.push(`• ${status}`);
    }

    // App name (always last)
    parts.push(appName);

    // Build final title
    let title = parts.join(separator);

    // Truncate if too long
    if (title.length > maxTitleLength) {
      title = title.substring(0, maxTitleLength - 3) + '...';
    }

    return title;
  }

  // Update browser/Tauri window title
  async function updateWindowTitle(title: string): Promise<void> {
    try {
      // Check if running in Tauri
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        await appWindow.setTitle(title);
      } else if (typeof document !== 'undefined') {
        // Fallback for browser
        document.title = title;
      }
    } catch (error) {
      console.warn('Failed to update window title:', error);
      // Fallback
      if (typeof document !== 'undefined') {
        document.title = title;
      }
    }
  }

  // Public API methods
  export function setServer(server: { id: string; name: string } | null): void {
    currentServer.set(server);
  }

  export function setChannel(channel: { id: string; name: string; type: 'text' | 'voice' | 'dm' } | null): void {
    currentChannel.set(channel);
    if (channel?.type !== 'dm') {
      currentDM.set(null);
    }
  }

  export function setDM(dm: { id: string; username: string; displayName?: string } | null): void {
    currentDM.set(dm);
    if (dm) {
      currentChannel.set(null);
      currentServer.set(null);
    }
  }

  export function setUnreadCount(count: number): void {
    unreadCount.set(Math.max(0, count));
  }

  export function setMentionCount(count: number): void {
    mentionCount.set(Math.max(0, count));
  }

  export function setTypingUsers(users: string[]): void {
    typingUsers.set(users);
  }

  export function setConnectionStatus(connected: boolean): void {
    isConnected.set(connected);
  }

  export function setCustomStatus(status: string | null): void {
    customStatus.set(status);
  }

  export function clearContext(): void {
    currentServer.set(null);
    currentChannel.set(null);
    currentDM.set(null);
    typingUsers.set([]);
    customStatus.set(null);
  }

  export function getCurrentTitle(): string {
    return get(windowTitle);
  }

  export function forceUpdate(): void {
    updateWindowTitle(get(windowTitle));
  }

  // Event handlers
  function handleFocus(): void {
    isFocused.set(true);
  }

  function handleBlur(): void {
    isFocused.set(false);
  }

  function handleVisibilityChange(): void {
    isFocused.set(!document.hidden);
  }

  // Lifecycle
  let titleUnsubscribe: (() => void) | null = null;
  let updateTimer: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    // Subscribe to title changes
    titleUnsubscribe = windowTitle.subscribe((title) => {
      updateWindowTitle(title);
    });

    // Listen for window focus/blur
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Initial focus state
      isFocused.set(document.hasFocus());
    }

    // Periodic title refresh for typing indicators, etc.
    if (updateInterval > 0) {
      updateTimer = setInterval(() => {
        // Force reactive update for time-sensitive elements
        typingUsers.update((u) => [...u]);
      }, updateInterval);
    }

    // Initial title set
    updateWindowTitle(get(windowTitle));
  });

  onDestroy(() => {
    if (titleUnsubscribe) {
      titleUnsubscribe();
    }

    if (updateTimer) {
      clearInterval(updateTimer);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  // Reactive statement to handle prop changes
  $: if (appName || separator || showUnreadCount || showTypingIndicator || maxTitleLength || titlePattern) {
    forceUpdate();
  }
</script>

<!-- This is a headless component - no visible UI -->
<slot 
  title={$windowTitle}
  server={$currentServer}
  channel={$currentChannel}
  dm={$currentDM}
  unread={$unreadCount}
  mentions={$mentionCount}
  typing={$typingUsers}
  focused={$isFocused}
  connected={$isConnected}
/>

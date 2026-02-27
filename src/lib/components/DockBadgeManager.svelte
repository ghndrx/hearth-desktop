<script lang="ts">
  /**
   * DockBadgeManager - Manages dock/taskbar badge for unread counts
   * Shows unread message count on the app icon (macOS dock, Windows taskbar)
   */
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  // Props
  export let unreadCount: number = 0;
  export let enabled: boolean = true;
  export let showZero: boolean = false;
  export let maxDisplayCount: number = 99;
  export let mentionCount: number = 0;
  export let prioritizeMentions: boolean = true;

  // State
  let currentBadgeValue: string | null = null;
  let platform: string = '';
  let isSupported: boolean = false;
  let unlisten: UnlistenFn | null = null;
  let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Computed display count
  $: displayCount = prioritizeMentions && mentionCount > 0 ? mentionCount : unreadCount;
  $: badgeText = getBadgeText(displayCount);

  function getBadgeText(count: number): string | null {
    if (!enabled) return null;
    if (count === 0 && !showZero) return null;
    if (count > maxDisplayCount) return `${maxDisplayCount}+`;
    return count.toString();
  }

  async function detectPlatform(): Promise<void> {
    try {
      platform = await invoke<string>('get_platform');
      isSupported = platform === 'macos' || platform === 'windows' || platform === 'linux';
    } catch (err) {
      console.warn('[DockBadgeManager] Platform detection failed:', err);
      // Fallback detection
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('mac')) platform = 'macos';
      else if (userAgent.includes('win')) platform = 'windows';
      else if (userAgent.includes('linux')) platform = 'linux';
      isSupported = true;
    }
  }

  async function updateBadge(text: string | null): Promise<void> {
    if (currentBadgeValue === text) return;

    // Debounce rapid updates
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
    }

    updateDebounceTimer = setTimeout(async () => {
      try {
        if (text === null) {
          await clearBadge();
        } else {
          await setBadge(text);
        }
        currentBadgeValue = text;
      } catch (err) {
        console.error('[DockBadgeManager] Failed to update badge:', err);
      }
    }, 100);
  }

  async function setBadge(text: string): Promise<void> {
    try {
      // Try Tauri's native badge API
      await invoke('set_badge_count', { count: parseInt(text) || 0, label: text });
    } catch {
      // Fallback: try platform-specific commands
      try {
        if (platform === 'macos') {
          await invoke('set_macos_dock_badge', { badge: text });
        } else if (platform === 'windows') {
          await invoke('set_windows_taskbar_badge', { count: parseInt(text) || 0 });
        } else if (platform === 'linux') {
          await invoke('set_linux_unity_badge', { count: parseInt(text) || 0 });
        }
      } catch (fallbackErr) {
        // Final fallback: update window title
        updateWindowTitle(text);
      }
    }
  }

  async function clearBadge(): Promise<void> {
    try {
      await invoke('clear_badge');
    } catch {
      try {
        if (platform === 'macos') {
          await invoke('set_macos_dock_badge', { badge: '' });
        } else if (platform === 'windows') {
          await invoke('clear_windows_taskbar_badge');
        } else if (platform === 'linux') {
          await invoke('set_linux_unity_badge', { count: 0 });
        }
      } catch {
        updateWindowTitle(null);
      }
    }
  }

  function updateWindowTitle(badge: string | null): void {
    const baseTitle = 'Hearth';
    if (badge && parseInt(badge) > 0) {
      document.title = `(${badge}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }

  // React to count changes
  $: if (isSupported) {
    updateBadge(badgeText);
  }

  onMount(async () => {
    await detectPlatform();

    // Listen for unread count updates from other parts of the app
    try {
      unlisten = await listen<{ unread: number; mentions: number }>('unread-count-changed', (event) => {
        unreadCount = event.payload.unread;
        mentionCount = event.payload.mentions;
      });
    } catch (err) {
      console.warn('[DockBadgeManager] Event listener setup failed:', err);
    }

    // Initial badge update
    if (isSupported) {
      await updateBadge(badgeText);
    }
  });

  onDestroy(async () => {
    if (unlisten) {
      unlisten();
    }
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
    }
    // Clear badge on component destroy
    await clearBadge();
  });

  // Public API for external control
  export function setBadgeCount(count: number): void {
    unreadCount = count;
  }

  export function setMentionCount(count: number): void {
    mentionCount = count;
  }

  export function clearAllBadges(): void {
    unreadCount = 0;
    mentionCount = 0;
  }

  export function forceRefresh(): void {
    currentBadgeValue = null;
    updateBadge(badgeText);
  }
</script>

<!-- 
  DockBadgeManager is a headless component - no visible UI.
  It manages the app's dock/taskbar badge showing unread counts.
-->

{#if $$slots.default}
  <slot 
    {unreadCount}
    {mentionCount}
    {displayCount}
    {badgeText}
    {platform}
    {isSupported}
    {enabled}
  />
{/if}

<style>
  /* No styles needed - headless component */
</style>

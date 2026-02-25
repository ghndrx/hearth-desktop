<script lang="ts">
  /**
   * BadgeManager - Syncs unread count to native dock/taskbar badge
   * 
   * This component runs invisibly and keeps the native badge count
   * synchronized with the application's unread message count.
   * 
   * Features:
   * - Updates dock badge on macOS
   * - Updates taskbar badge on Windows
   * - Updates system tray tooltip
   * - Flashes window on new messages (when unfocused)
   */
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { unreadCount, hasUnread } from '$lib/stores/notifications';
  import type { Unsubscriber } from 'svelte/store';
  
  /** Whether to flash the taskbar/dock on new messages */
  export let flashOnNew = true;
  
  /** Whether to play a sound on new messages */
  export let soundEnabled = false;
  
  /** Debounce interval for badge updates (ms) */
  export let debounceMs = 100;
  
  let isTauri = false;
  let isWindowFocused = true;
  let previousCount = 0;
  let unsubscribe: Unsubscriber;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  onMount(async () => {
    // Check if running in Tauri
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      isTauri = true;
      
      // Track window focus state
      window.addEventListener('focus', handleWindowFocus);
      window.addEventListener('blur', handleWindowBlur);
      
      // Subscribe to unread count changes
      unsubscribe = unreadCount.subscribe(handleUnreadChange);
      
      // Load saved preferences
      await loadPreferences();
    }
  });
  
  onDestroy(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    if (unsubscribe) {
      unsubscribe();
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
    }
    
    // Clear badge on unmount
    if (isTauri) {
      clearBadge();
    }
  });
  
  async function loadPreferences() {
    try {
      const Store = (await import('@tauri-apps/plugin-store')).Store;
      const store = await Store.load('settings.json');
      
      const flash = await store.get<boolean>('badge.flashOnNew');
      if (flash !== null && flash !== undefined) {
        flashOnNew = flash;
      }
      
      const sound = await store.get<boolean>('badge.soundEnabled');
      if (sound !== null && sound !== undefined) {
        soundEnabled = sound;
      }
    } catch (e) {
      console.debug('BadgeManager: Could not load preferences', e);
    }
  }
  
  function handleWindowFocus() {
    isWindowFocused = true;
  }
  
  function handleWindowBlur() {
    isWindowFocused = false;
  }
  
  function handleUnreadChange(count: number) {
    // Debounce rapid updates
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      updateBadge(count);
    }, debounceMs);
  }
  
  async function updateBadge(count: number) {
    if (!isTauri) return;
    
    try {
      // Update dock/taskbar badge
      await invoke('set_badge_count', { count });
      
      // Update tray badge
      await invoke('update_tray_badge', { count });
      
      // Flash window if count increased and window is not focused
      if (flashOnNew && count > previousCount && !isWindowFocused) {
        await flashWindow();
      }
      
      previousCount = count;
    } catch (e) {
      console.error('BadgeManager: Failed to update badge', e);
    }
  }
  
  async function clearBadge() {
    if (!isTauri) return;
    
    try {
      await invoke('set_badge_count', { count: 0 });
      await invoke('update_tray_badge', { count: 0 });
    } catch (e) {
      console.debug('BadgeManager: Failed to clear badge', e);
    }
  }
  
  async function flashWindow() {
    if (!isTauri) return;
    
    try {
      await invoke('flash_window', { urgent: false });
    } catch (e) {
      // flash_window might not exist on all platforms
      console.debug('BadgeManager: flash_window not available', e);
    }
  }
  
  /**
   * Force refresh the badge count
   */
  export async function refresh() {
    if (!isTauri) return;
    
    const count = $unreadCount;
    await updateBadge(count);
  }
  
  /**
   * Toggle flash on new messages preference
   */
  export async function setFlashOnNew(enabled: boolean) {
    flashOnNew = enabled;
    
    try {
      const Store = (await import('@tauri-apps/plugin-store')).Store;
      const store = await Store.load('settings.json');
      await store.set('badge.flashOnNew', enabled);
      await store.save();
    } catch (e) {
      console.error('BadgeManager: Failed to save flash preference', e);
    }
  }
  
  /**
   * Toggle sound on new messages preference
   */
  export async function setSoundEnabled(enabled: boolean) {
    soundEnabled = enabled;
    
    try {
      const Store = (await import('@tauri-apps/plugin-store')).Store;
      const store = await Store.load('settings.json');
      await store.set('badge.soundEnabled', enabled);
      await store.save();
    } catch (e) {
      console.error('BadgeManager: Failed to save sound preference', e);
    }
  }
</script>

<!-- BadgeManager is invisible - it only manages the native badge -->

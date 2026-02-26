<script lang="ts">
  /**
   * DesktopIntegration.svelte
   *
   * Root-level component that initializes all native desktop integrations.
   * Mount this once in the app layout to enable Tauri-specific features.
   */
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { isAuthenticated } from '$lib/stores/auth';
  import { secureKeychain } from '$lib/stores/secureKeychain';
  import WindowStateManager from './WindowStateManager.svelte';
  import BadgeManager from './BadgeManager.svelte';
  import TrayMenuManager from './TrayMenuManager.svelte';
  import NativeNotificationManager from './NativeNotificationManager.svelte';
  import DeepLinkHandler from './DeepLinkHandler.svelte';

  export let enableNotifications: boolean = true;
  export let enableTray: boolean = true;
  export let enableDeepLinks: boolean = true;
  export let enableBadge: boolean = true;

  let isTauri = false;
  let initialized = false;

  async function detectTauri(): Promise<boolean> {
    if (!browser) return false;
    try {
      // Check for Tauri API availability
      return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
    } catch {
      return false;
    }
  }

  onMount(async () => {
    isTauri = await detectTauri();
    if (!isTauri) return;

    // Initialize secure keychain
    await secureKeychain.init();

    initialized = true;
  });
</script>

{#if initialized && isTauri}
  <!-- Window state persistence -->
  <WindowStateManager />

  <!-- App badge with unread count -->
  {#if enableBadge}
    <BadgeManager />
  {/if}

  <!-- System tray -->
  {#if enableTray}
    <TrayMenuManager />
  {/if}

  <!-- Native notifications -->
  {#if enableNotifications && $isAuthenticated}
    <NativeNotificationManager />
  {/if}

  <!-- Deep link handling (hearth://) -->
  {#if enableDeepLinks}
    <DeepLinkHandler />
  {/if}
{/if}

<!-- Always render children -->
<slot />

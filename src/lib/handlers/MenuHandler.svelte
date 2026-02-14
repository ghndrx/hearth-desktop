<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { goto } from '$app/navigation';
  import { ui } from '$lib/stores/ui';

  let unlisteners: UnlistenFn[] = [];

  onMount(async () => {
    // Menu event handlers
    unlisteners.push(
      await listen('menu:new_chat', () => {
        goto('/new/chat');
      })
    );

    unlisteners.push(
      await listen('menu:new_room', () => {
        goto('/new/room');
      })
    );

    unlisteners.push(
      await listen('menu:settings', () => {
        goto('/settings');
      })
    );

    unlisteners.push(
      await listen('menu:toggle_sidebar', () => {
        ui.toggleSidebar();
      })
    );

    unlisteners.push(
      await listen('menu:check_updates', () => {
        // Will be handled by updater component
        window.dispatchEvent(new CustomEvent('check-updates'));
      })
    );

    unlisteners.push(
      await listen('menu:about', () => {
        goto('/about');
      })
    );
  });

  onDestroy(() => {
    unlisteners.forEach(fn => fn());
  });
</script>

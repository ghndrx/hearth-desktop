<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { goto } from '$app/navigation';

  interface DeepLinkPayload {
    action: string;
    target: string | null;
    params: Record<string, string>;
  }

  let unlisten: UnlistenFn | null = null;

  onMount(async () => {
    unlisten = await listen<DeepLinkPayload>('deeplink', (event) => {
      handleDeepLink(event.payload);
    });
  });

  onDestroy(() => {
    if (unlisten) {
      unlisten();
    }
  });

  function handleDeepLink(payload: DeepLinkPayload) {
    console.log('Deep link received:', payload);

    switch (payload.action) {
      case 'chat':
        if (payload.target) {
          goto(`/chat/${payload.target}`);
        }
        break;

      case 'room':
        if (payload.target) {
          goto(`/room/${payload.target}`);
        }
        break;

      case 'invite':
        if (payload.target) {
          goto(`/invite/${payload.target}`);
        }
        break;

      case 'settings':
        if (payload.target) {
          goto(`/settings/${payload.target}`);
        } else {
          goto('/settings');
        }
        break;

      case 'call':
        if (payload.target) {
          // Join a call directly
          goto(`/call/${payload.target}`);
        }
        break;

      default:
        console.warn('Unknown deep link action:', payload.action);
    }
  }
</script>

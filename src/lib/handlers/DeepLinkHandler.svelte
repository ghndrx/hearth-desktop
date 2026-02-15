<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- Tauri deep links use absolute paths */
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
        // Open DM with a specific user
        if (payload.target) {
          goto(`/chat/${payload.target}`);
        }
        break;

      case 'room':
        // Navigate to a room (legacy support)
        if (payload.target) {
          goto(`/room/${payload.target}`);
        }
        break;

      case 'channel':
        // Navigate to a specific channel
        // Format: hearth://channel/:channelId
        if (payload.target) {
          goto(`/channels/${payload.target}`);
        }
        break;

      case 'server':
        // Navigate to a specific server, optionally to a channel within it
        // Format: hearth://server/:serverId or hearth://server/:serverId/:channelId
        if (payload.target) {
          const channelId = payload.params?.channel;
          if (channelId) {
            // Navigate to server + channel
            goto(`/servers/${payload.target}/channels/${channelId}`);
          } else {
            // Navigate to server (default channel)
            goto(`/servers/${payload.target}`);
          }
        }
        break;

      case 'invite':
        // Accept an invite
        // Format: hearth://invite/:code or hearth://invite/:code?server=:serverId
        if (payload.target) {
          const serverParam = payload.params?.server ? `?server=${payload.params.server}` : '';
          goto(`/invite/${payload.target}${serverParam}`);
        }
        break;

      case 'settings':
        // Open settings or a specific settings section
        if (payload.target) {
          goto(`/settings/${payload.target}`);
        } else {
          goto('/settings');
        }
        break;

      case 'call':
        // Join a voice call directly
        if (payload.target) {
          goto(`/call/${payload.target}`);
        }
        break;

      default:
        console.warn('Unknown deep link action:', payload.action);
    }
  }
</script>

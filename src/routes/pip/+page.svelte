<script lang="ts">
  import { onMount } from 'svelte';
  import PipVoiceOverlay from '$lib/components/PipVoiceOverlay.svelte';

  // Set up the PiP window styling and behavior
  onMount(async () => {
    // Make the body transparent and remove default styling
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = 'transparent';
    document.body.style.overflow = 'hidden';

    // Set up window-specific styling
    const html = document.documentElement;
    html.style.background = 'transparent';
    html.style.overflow = 'hidden';

    // Disable text selection for better dragging experience
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  });
</script>

<svelte:head>
  <title>Voice Channel - Hearth</title>
  <meta name="description" content="Voice channel picture-in-picture overlay" />
</svelte:head>

<main>
  <PipVoiceOverlay />
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    background: transparent !important;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }

  main {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    background: transparent;
  }
</style>
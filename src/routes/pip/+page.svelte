<script lang="ts">
	import { onMount } from 'svelte';
	import PiPVoiceChannel from '$lib/components/PiPVoiceChannel.svelte';
	import { windowActions } from '$lib/stores/window';
	import { transcriptionActions } from '$lib/stores/voice';

	onMount(() => {
		// Initialize stores when PiP window loads
		windowActions.init();
		transcriptionActions.init();

		// Set up window-specific styles for PiP
		if (typeof document !== 'undefined') {
			document.body.style.margin = '0';
			document.body.style.padding = '0';
			document.body.style.overflow = 'hidden';
			document.body.style.background = 'transparent';
		}
	});
</script>

<svelte:head>
	<title>Hearth Voice - Picture in Picture</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="pip-window">
	<PiPVoiceChannel channelName="General Voice" />
</div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: transparent;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.pip-window {
		width: 100vw;
		height: 100vh;
		display: flex;
		background: transparent;
	}

	/* Disable text selection for better dragging experience */
	:global(body) {
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
</style>
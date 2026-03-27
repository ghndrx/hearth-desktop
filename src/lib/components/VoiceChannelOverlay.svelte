<script lang="ts">
	/**
	 * VoiceChannelOverlay.svelte
	 * MW-002: Basic picture-in-picture voice channel overlay wrapper
	 *
	 * This component serves as the main entry point for the voice channel overlay
	 * and wraps the VoicePiPOverlay component for use in the overlay route.
	 */
	import { onMount } from 'svelte';
	import VoicePiPOverlay from './VoicePiPOverlay.svelte';
	import { voicePiPActions, isPiPActive } from '$lib/stores/voicePiP';
	import { isInVoice } from '$lib/stores/voice';

	let overlayRef: VoicePiPOverlay;

	// Auto-enter PiP mode when the overlay component mounts
	onMount(() => {
		if ($isInVoice && !$isPiPActive) {
			voicePiPActions.enter('bottom-right');
		}
	});

	function handlePiPModeChanged(event: CustomEvent<{ active: boolean }>) {
		// Handle PiP mode changes if needed
		console.log('PiP mode changed:', event.detail.active);
	}

	function handleToggleFullView() {
		// This could navigate back to the main app or open a larger voice view
		// For now, we'll just log it as this is the basic implementation
		console.log('Toggle full view requested');
	}

	function handleExit() {
		// Exit the overlay
		voicePiPActions.exit();
	}
</script>

<VoicePiPOverlay
	bind:this={overlayRef}
	on:pipModeChanged={handlePiPModeChanged}
	on:toggleFullView={handleToggleFullView}
	on:exit={handleExit}
/>
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { app, isLoading } from '$lib/stores/app';
	import { activityStore } from '$lib/stores/activity';
	import { pushToTalk } from '$lib/stores/pushToTalk';
	import { screenShare } from '$lib/stores/screenShare';
	import { MenuHandler, DeepLinkHandler, KeyboardHandler } from '$lib';
	import { ToastContainer, SearchModal, HelpModal, ScreenShareModal, ScreenSharePreview } from '$lib/components';
	import '$lib/styles/theme.css';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		app.init();
		
		// Start activity detection for rich presence
		activityStore.startPolling();
		
		// Initialize push-to-talk hotkey handler
		pushToTalk.init();
	});

	onDestroy(() => {
		// Clean up activity polling on unmount
		activityStore.stopPolling();
		
		// Clean up push-to-talk handler
		pushToTalk.destroy();
		
		// Clean up screen sharing
		screenShare.reset();
	});
</script>

<!-- Desktop event handlers (invisible) -->
<MenuHandler />
<DeepLinkHandler />
<KeyboardHandler />

<!-- Global modals -->
<SearchModal />
<HelpModal />
<ScreenShareModal />

<!-- Screen share floating preview -->
<ScreenSharePreview />

<!-- Toast notifications -->
<ToastContainer position="bottom-right" />

<svelte:head>
	<title>Hearth</title>
	<meta name="description" content="Hearth Desktop - Native chat client" />
</svelte:head>

{#if $isLoading}
	<div class="loading">
		<div class="spinner"></div>
		<p>Loading...</p>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		background: var(--bg-tertiary);
		color: var(--text-muted);
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 3px solid var(--bg-modifier-accent);
		border-top-color: var(--brand-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading p {
		margin-top: 16px;
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { app, isLoading } from '$lib/stores/app';
	import { MenuHandler, DeepLinkHandler } from '$lib';
	import '$lib/styles/theme.css';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		app.init();
	});
</script>

<!-- Desktop event handlers (invisible) -->
<MenuHandler />
<DeepLinkHandler />

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
